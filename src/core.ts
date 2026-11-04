export interface BillItem {
  id: string;
  name: string;
  quantity: number;
  unitCents: number;
  assignedTo: string[];
}

export interface Participant {
  id: string;
  name: string;
}

export interface SplitResult {
  totals: Record<string, number>;
  unassigned: string[];
  totalCents: number;
}

export function parseMoney(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

export function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function splitBill(items: BillItem[], participants: Participant[]): SplitResult {
  const totals: Record<string, number> = Object.fromEntries(participants.map(person => [person.id, 0]));
  const unassigned: string[] = [];
  let totalCents = 0;
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isSafeInteger(item.unitCents) || item.unitCents < 0) continue;
    const lineCents = item.quantity * item.unitCents;
    if (!Number.isSafeInteger(lineCents)) continue;
    totalCents += lineCents;
    const selected = participants.filter(person => item.assignedTo.includes(person.id));
    if (selected.length === 0) { unassigned.push(item.id); continue; }
    const base = Math.floor(lineCents / selected.length);
    const remainder = lineCents % selected.length;
    selected.forEach((person, index) => { totals[person.id] += base + (index < remainder ? 1 : 0); });
  }
  return { totals, unassigned, totalCents };
}
