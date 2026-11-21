import { afterEach, expect, it, vi } from 'vitest';
import worker from './worker';

const env = { GEMINI_API_KEY: 'test-key', SCAN_LIMIT: { limit: async () => ({ success: true }) }, ASSETS: { fetch: async () => new Response() } };
const request = () => {
  const form = new FormData();
  form.set('image', new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], 'receipt.jpg', { type: 'image/jpeg' }));
  return new Request('https://example.com/api/scan', { method: 'POST', body: form });
};
const run = (bindings = env) => worker.fetch(request(), bindings as never, {} as never) as Promise<Response>;
afterEach(() => vi.unstubAllGlobals());

it('sends the receipt to Gemini and validates its response', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"items":[{"name":"Tea","quantity":2,"unitPrice":"3.50"}]}' }] } }] })));
  vi.stubGlobal('fetch', fetchMock);
  const response = await run();
  expect(await response.json()).toEqual({ items: [{ name: 'Tea', quantity: 2, unitCents: 350 }], warnings: [] });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toContain('gemini-3.1-flash-lite:generateContent');
  expect(options.headers['x-goog-api-key']).toBe('test-key');
  expect(JSON.parse(options.body).contents[0].parts[1].inlineData.mimeType).toBe('image/jpeg');
});

it('returns a useful error when the free quota is exhausted', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));
  const response = await run();
  expect(response.status).toBe(429);
  expect((await response.json() as { error: string }).error).toContain('free quota');
});

it('keeps scanning unavailable without a configured key', async () => {
  const response = await run({ ...env, GEMINI_API_KEY: '' });
  expect(response.status).toBe(503);
});
