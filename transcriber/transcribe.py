#!/usr/bin/env python3
"""Download (if a link) and transcribe a video or audio file with faster-whisper.

Usage:
    python transcribe.py <url-or-file> [--model MODEL] [--language he]

Writes output/<name>/raw.txt (plain transcript) and raw_timestamps.txt.
Claude then organizes raw.txt into transcript.md without changing wording.
"""
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output"

HEBREW_MODEL = "ivrit-ai/whisper-large-v3-turbo-ct2"
DEFAULT_MODEL = "large-v3-turbo"


def slug(text: str) -> str:
    text = re.sub(r"[^\w֐-׿-]+", "_", text).strip("_")
    return text[:60] or "video"


def is_url(s: str) -> bool:
    return s.startswith(("http://", "https://"))


def download(url: str, workdir: Path) -> tuple[Path, str]:
    workdir.mkdir(parents=True, exist_ok=True)
    title = subprocess.run(
        ["yt-dlp", "--no-playlist", "--print", "%(title)s", url],
        capture_output=True, text=True, check=True,
    ).stdout.strip().splitlines()[0]
    subprocess.run(
        ["yt-dlp", "--no-playlist", "-x", "--audio-format", "wav",
         "--postprocessor-args", "-ar 16000 -ac 1",
         "-o", str(workdir / "audio.%(ext)s"), url],
        check=True,
    )
    return workdir / "audio.wav", title


def to_wav(src: Path, workdir: Path) -> Path:
    workdir.mkdir(parents=True, exist_ok=True)
    dst = workdir / "audio.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
         "-ar", "16000", "-ac", "1", str(dst)],
        check=True,
    )
    return dst


def fmt(t: float) -> str:
    m, s = divmod(int(t), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("source", help="link (YouTube/TikTok/Instagram/...), YouTube playlist link, or local file path")
    ap.add_argument("--model", help="faster-whisper model name (default: auto by language)")
    ap.add_argument("--language", help="language code, e.g. he / en (default: auto-detect)")
    args = ap.parse_args()

    if is_url(args.source) and "list=" in args.source:
        entries = playlist_entries(args.source)
        print(f"Playlist: {len(entries)} videos")
        for idx, url, title in entries:
            done = OUT / f"{idx:02d}_{slug(title)}" / "raw.txt"
            if done.exists():
                print(f"Skip {idx:02d} (already done)")
                continue
            print(f"\n=== {idx:02d}/{len(entries)}: {title} ===")
            try:
                transcribe_one(url, args, prefix=f"{idx:02d}_")
            except subprocess.CalledProcessError as e:
                print(f"FAILED {idx:02d}: {e}")
    else:
        transcribe_one(args.source, args)


_models = {}


def get_model(name):
    from faster_whisper import WhisperModel
    if name not in _models:
        print(f"Loading model: {name}")
        _models[name] = WhisperModel(name, device="auto", compute_type="int8")
    return _models[name]


def playlist_entries(url):
    out = subprocess.run(
        ["yt-dlp", "--flat-playlist", "--yes-playlist", "--print",
         "%(playlist_index)s\t%(id)s\t%(title)s", url],
        capture_output=True, text=True, check=True,
    ).stdout.strip().splitlines()
    entries = []
    for line in out:
        idx, vid, title = line.split("\t", 2)
        entries.append((int(idx), f"https://www.youtube.com/watch?v={vid}", title))
    return entries


def transcribe_one(source, args, prefix=""):
    if is_url(source):
        tmp = OUT / "_downloading"
        if tmp.exists():
            shutil.rmtree(tmp)
        _, title = download(source, tmp)
        workdir = OUT / f"{prefix}{slug(title)}"
        if workdir.exists():
            shutil.rmtree(workdir)
        tmp.rename(workdir)
        audio = workdir / "audio.wav"
    else:
        src = Path(source).expanduser().resolve()
        if not src.exists():
            sys.exit(f"File not found: {src}")
        title = src.stem
        workdir = OUT / f"{prefix}{slug(title)}"
        audio = to_wav(src, workdir)

    language = args.language
    model_name = args.model
    if not model_name:
        if language is None:
            # quick language detection with a small model
            _, info = get_model("base").transcribe(str(audio), beam_size=1)
            language = info.language
            print(f"Detected language: {language} ({info.language_probability:.0%})")
        model_name = HEBREW_MODEL if language == "he" else DEFAULT_MODEL

    segments, info = get_model(model_name).transcribe(
        str(audio), language=language, beam_size=5, vad_filter=True,
        condition_on_previous_text=False,
    )

    lines, stamped = [], []
    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue
        lines.append(text)
        stamped.append(f"[{fmt(seg.start)}] {text}")
        print(stamped[-1], flush=True)

    header = f"Title: {title}\nSource: {source}\nLanguage: {info.language}\nDuration: {fmt(info.duration)}\n"
    (workdir / "raw.txt").write_text(header + "\n" + "\n".join(lines) + "\n", encoding="utf-8")
    (workdir / "raw_timestamps.txt").write_text(header + "\n" + "\n".join(stamped) + "\n", encoding="utf-8")
    audio.unlink(missing_ok=True)
    print(f"DONE: {workdir / 'raw.txt'}")


if __name__ == "__main__":
    main()
