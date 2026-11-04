import { Hono } from 'hono';
import { imageMime, parseScanAnswer } from './scan';

interface Env {
  AI: Ai;
  SCAN_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const app = new Hono<{ Bindings: Env }>();
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

async function readLimited(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST_BYTES) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return all;
}

app.get('/api/healthz', c => c.json({ ok: true }));
app.post('/api/scan', async c => {
  const rate = await c.env.SCAN_LIMIT.limit({ key: c.req.header('cf-connecting-ip') ?? 'unknown' });
  if (!rate.success) return c.json({ error: 'Too many scans. Please wait a minute or enter items manually.' }, 429, { 'Cache-Control': 'no-store', 'Retry-After': '60' });
  const contentType = c.req.header('content-type');
  if (!contentType?.startsWith('multipart/form-data')) return c.json({ error: 'Upload an image.' }, 415);
  const body = await readLimited(c.req.raw);
  if (!body) return c.json({ error: 'Image must be smaller than 4 MB.' }, 413);
  const buffer = new ArrayBuffer(body.byteLength);
  new Uint8Array(buffer).set(body);
  const form = await new Request(c.req.url, { method: 'POST', headers: { 'content-type': contentType }, body: buffer }).formData().catch(() => null);
  const image = form?.get('image');
  if (!(image instanceof File)) return c.json({ error: 'Choose a receipt image.' }, 400);
  if (image.size > MAX_IMAGE_BYTES || image.size === 0) return c.json({ error: 'Image must be smaller than 4 MB.' }, 413);
  const bytes = new Uint8Array(await image.arrayBuffer());
  const mime = imageMime(bytes);
  if (!mime) return c.json({ error: 'Use a JPEG, PNG, or WebP image.' }, 415);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  try {
    const output = await c.env.AI.run('@cf/moondream/moondream3.1-9B-A2B', {
      task: 'query', image: `data:${mime};base64,${btoa(binary)}`, reasoning: false, temperature: 0, max_tokens: 2500,
      question: 'Read this restaurant bill or receipt. Return ONLY JSON in this shape: {"items":[{"name":"item description","quantity":1,"unitPrice":"12.34"}]}. Include actual purchased line items and explicit service/tax lines if separately charged. Do not invent missing lines, quantities, or prices. Use decimal point and exactly two decimal places for unitPrice. If a line is unclear, omit it. Do not include totals, subtotals, payment lines, card details, personal data, or commentary.',
    });
    const answer = 'answer' in output && typeof output.answer === 'string' ? output.answer : '';
    return c.json(parseScanAnswer(answer), 200, { 'Cache-Control': 'no-store' });
  } catch {
    return c.json({ error: 'Could not read this receipt. Try another image or enter items manually.' }, 503, { 'Cache-Control': 'no-store' });
  }
});
app.all('/api/*', c => c.json({ error: 'not_found' }, 404));
app.get('*', c => c.env.ASSETS.fetch(c.req.raw));

export default { fetch: app.fetch } satisfies ExportedHandler<Env>;
