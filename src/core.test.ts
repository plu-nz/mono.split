import { describe, expect, it } from 'vitest';
import { formatMoney, parseMoney, splitBill } from './core';

describe('money', () => {
  it('parses decimal strings exactly', () => {
    expect(parseMoney('12,50')).toBe(1250);
    expect(parseMoney('0.01')).toBe(1);
    expect(parseMoney('12.345')).toBeNull();
    expect(parseMoney('-1')).toBeNull();
    expect(formatMoney(1250)).toBe('12.50');
  });
});

describe('bill allocation', () => {
  it('reconciles an uneven split by participant order', () => {
    const people = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    const result = splitBill([{ id: 'x', name: 'Shared', quantity: 1, unitCents: 100, assignedTo: ['a', 'b', 'c'] }], people);
    expect(result.totals).toEqual({ a: 34, b: 33, c: 33 });
    expect(Object.values(result.totals).reduce((a,b) => a+b, 0)).toBe(result.totalCents);
  });
  it('reports unassigned lines without inventing a completed total', () => {
    expect(splitBill([{ id: 'x', name: 'Tea', quantity: 2, unitCents: 299, assignedTo: [] }], [{ id: 'a', name: 'A' }])).toEqual({ totals: { a: 0 }, unassigned: ['x'], totalCents: 598 });
  });
});
