// Local Hebrew transcription with whisper.cpp and the ivrit.ai model. Free, and the
// audio never leaves the machine. Falls back to OpenAI only when local is missing.
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const HOME = os.homedir();
export const DEFAULT_WHISPER_CLI = path.join(HOME, 'whisper.cpp/build/bin/whisper-cli');
export const DEFAULT_WHISPER_MODEL = path.join(HOME, 'models/ivrit-turbo.bin');

function run(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(cmd)}: ${(stderr || err.message).slice(-300)}`));
      else resolve(stdout);
    });
  });
}

export function localWhisperPaths(config = {}) {
  const cli = config.whisperCli || DEFAULT_WHISPER_CLI;
  const model = config.whisperModel || DEFAULT_WHISPER_MODEL;
  return fs.existsSync(cli) && fs.existsSync(model) ? { cli, model } : null;
}

// The encoder always pays for a 30s window. For a short note, shrink the window to the
// clip's length: about 3x faster with the same text. Long audio keeps the full window.
export function whisperArgs({ model, wav, seconds, threads }) {
  const args = ['-m', model, '-l', 'he', '-nt', '-np', '-bs', '1', '-bo', '1', '-t', String(threads), '-f', wav];
  if (seconds > 0 && seconds < 28) args.push('-ac', String(Math.min(1500, Math.ceil((seconds / 30) * 1500) + 128)));
  return args;
}

export function cleanTranscript(stdout = '') {
  return stdout.split('\n').map(l => l.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export async function transcribeLocal(audioPath, { cli, model }) {
  const wav = `${audioPath}.wav`;
  try {
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', audioPath, '-ar', '16000', '-ac', '1', wav], 60_000);
    const seconds = Math.max(0, (fs.statSync(wav).size - 44) / 32000);
    const threads = Math.max(1, os.cpus().length);
    const out = await run(cli, whisperArgs({ model, wav, seconds, threads }), 10 * 60_000);
    const text = cleanTranscript(out);
    if (!text) throw new Error('התמליל יצא ריק');
    return text;
  } finally {
    fs.rmSync(wav, { force: true });
  }
}

// ---------- long recordings (calls, meetings) ----------
export async function audioSeconds(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], 30_000);
  return Math.max(0, Number(String(out).trim()) || 0);
}

// Re-encode to small mono Opus and cut into 20-minute pieces, so every piece stays
// far under the API's upload and duration limits.
export async function splitForUpload(file, { segmentSeconds = 1200 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-c:a', 'libopus', '-b:a', '24k',
    '-f', 'segment', '-segment_time', String(segmentSeconds), path.join(dir, 'part-%03d.ogg')], 30 * 60_000);
  const parts = fs.readdirSync(dir).filter(f => f.endsWith('.ogg')).sort().map(f => path.join(dir, f));
  return { dir, parts };
}

export async function transcribeOpenAI(file, { apiKey, model = 'gpt-4o-transcribe', fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('חסר מפתח OpenAI לתמלול הקלטה ארוכה');
  const { dir, parts } = await splitForUpload(file);
  try {
    const texts = [];
    for (const part of parts) {
      const form = new FormData();
      form.append('model', model);
      form.append('language', 'he');
      form.append('file', new Blob([fs.readFileSync(part)], { type: 'audio/ogg' }), path.basename(part));
      const res = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(10 * 60_000),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`תמלול OpenAI נכשל: ${body?.error?.message || res.status}`);
      texts.push(String(body.text || '').trim());
    }
    return texts.filter(Boolean).join('\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
