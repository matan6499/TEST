import test from 'node:test';
import assert from 'node:assert/strict';
import { generateImage, imagesPrompt } from '../lib/images.js';

test('generateImage posts the prompt and decodes the image', async () => {
  let sent;
  const fetchImpl = async (url, opts) => { sent = { url, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ data: [{ b64_json: Buffer.from('png').toString('base64') }] }) }; };
  const buf = await generateImage({ apiKey: 'k', prompt: 'a cat', size: 'weird', fetchImpl });
  assert.equal(buf.toString(), 'png');
  assert.match(sent.url, /images\/generations/);
  assert.equal(sent.body.size, '1024x1024');
});

test('generateImage explains a billing failure', async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Billing hard limit has been reached' } }) });
  await assert.rejects(generateImage({ apiKey: 'k', prompt: 'x', fetchImpl }), /קרדיט/);
});

test('imagesPrompt offers editing only with a photo', () => {
  assert.doesNotMatch(imagesPrompt({ remaining: 5, hasPhoto: false }), /image_edit/);
  assert.match(imagesPrompt({ remaining: 5, hasPhoto: true }), /image_edit/);
});
