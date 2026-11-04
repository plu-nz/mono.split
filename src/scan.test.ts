import { expect, it } from 'vitest';
import { answerFromAiStream, imageMime, parseScanAnswer } from './scan';

it('accepts structured candidate lines and flags malformed lines', () => {
  expect(parseScanAnswer('```json\n{"items":[{"name":"Tea","quantity":2,"unitPrice":"3.50"},{"name":"Bad","quantity":0,"unitPrice":"9.00"}]}\n```')).toEqual({ items: [{ name: 'Tea', quantity: 2, unitCents: 350 }], warnings: ['Line 2 could not be read reliably.'] });
});
it('rejects invalid image data', () => { expect(imageMime(new Uint8Array([1,2,3]))).toBeNull(); });

it('reads the last answer from Workers AI streaming events', () => { expect(answerFromAiStream('data: {\"chunk\":{\"answer\":\"{\"}}\n\ndata: {\"chunk\":{\"answer\":\"{\\\"items\\\":[]}\"}}\n\ndata: [DONE]')).toBe('{\"items\":[]}'); });
