import { parseMoney } from './core';

export interface ScanCandidate { name: string; quantity: number; unitCents: number }
export interface ScanResult { items: ScanCandidate[]; warnings: string[] }

export function parseScanAnswer(answer: string): ScanResult {
  const text = answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No structured receipt data returned');
  const parsed: unknown = JSON.parse(text.slice(start, end + 1));
  if (!parsed || typeof parsed !== 'object' || !('items' in parsed) || !Array.isArray(parsed.items)) throw new Error('Invalid receipt data');
  const warnings: string[] = [];
  const items: ScanCandidate[] = [];
  for (const [index, raw] of parsed.items.slice(0, 100).entries()) {
    if (!raw || typeof raw !== 'object') { warnings.push(`Line ${index + 1} needs manual review.`); continue; }
    const line = raw as Record<string, unknown>;
    const name = typeof line.name === 'string' ? line.name.trim().slice(0, 120) : '';
    const quantity = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity);
    const unitCents = typeof line.unitPrice === 'string' || typeof line.unitPrice === 'number' ? parseMoney(String(line.unitPrice)) : null;
    if (!name || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000 || unitCents === null || unitCents > 100_000_000) {
      warnings.push(`Line ${index + 1} could not be read reliably.`);
      continue;
    }
    items.push({ name, quantity, unitCents });
  }
  if (parsed.items.length > 100) warnings.push('Only the first 100 lines were read.');
  if (items.length === 0) warnings.push('No reliable items found. Enter the bill manually or try another image.');
  return { items, warnings };
}

export function imageMime(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export function answerFromAiStream(streamText: string): string {
  let answer = '';
  for (const line of streamText.split('\n')) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
    let event: unknown;
    try { event = JSON.parse(line.slice(6)); } catch { continue; }
    if (!event || typeof event !== 'object') continue;
    const payload = event as Record<string, unknown>;
    if (payload.chunk && typeof payload.chunk === 'object') {
      const chunk = payload.chunk as Record<string, unknown>;
      if (typeof chunk.answer === 'string') answer = chunk.answer;
    }
    if (Array.isArray(payload.output)) {
      const last = payload.output.at(-1);
      if (last && typeof last === 'object' && typeof (last as Record<string, unknown>).answer === 'string') answer = (last as Record<string, unknown>).answer as string;
    }
  }
  return answer;
}
