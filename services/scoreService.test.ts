import { describe, expect, it } from 'vitest';
import { calculateFinancialScore } from './scoreService';
import { Transaction, TransactionCategory } from '../types';

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: Math.random().toString(36).slice(2),
  date: '2025-03-09',
  description: 'Test',
  amount: -20,
  category: TransactionCategory.MustHave,
  confidence: 1,
  ...overrides,
});

const spend = (count: number, overrides: Partial<Transaction> = {}) =>
  Array.from({ length: count }, () => tx(overrides));

describe('calculateFinancialScore', () => {
  it('reports insufficient data below five expenses', () => {
    const result = calculateFinancialScore(spend(4));

    expect(result.hasEnoughData).toBe(false);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('-');
    expect(result.tips.length).toBeGreaterThan(0);
  });

  it('ignores internal transfers when counting expenses', () => {
    const transfers = spend(10, { category: TransactionCategory.InternalTransfer });
    expect(calculateFinancialScore(transfers).hasEnoughData).toBe(false);
  });

  it('ignores income when counting expenses', () => {
    const income = spend(10, { amount: 500, category: TransactionCategory.Income });
    expect(calculateFinancialScore(income).hasEnoughData).toBe(false);
  });

  it('scores a populated history within 0-100 and grades it', () => {
    const transactions = [
      ...spend(6),
      ...spend(3, { amount: -50, category: TransactionCategory.NiceToHave }),
      ...spend(2, { amount: -30, category: TransactionCategory.Waste }),
      tx({ amount: 3000, category: TransactionCategory.Income }),
    ];

    const result = calculateFinancialScore(transactions);

    expect(result.hasEnoughData).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.grade).not.toBe('-');
    expect(result.breakdown.length).toBeGreaterThan(0);
  });

  it('survives unparseable dates without throwing', () => {
    expect(() => calculateFinancialScore(spend(8, { date: 'not-a-date' }))).not.toThrow();
  });

  // characterization — Task 2.1 inverted this
  // Before Task 2.1, non-ISO dates (e.g. US '03/09/2025') were stored raw and
  // never matched the ISO currentMonthKey ('2025-03'), so the whole set was
  // silently treated as history (no 'History' first-month label). Now dates
  // are normalized to YYYY-MM-DD in the parser, so both inputs produce the
  // same result — both are first-month (no real history).
  it('classifies normalized non-ISO dates the same as ISO dates', () => {
    const iso = spend(8, { date: '2025-03-09' });
    const nonIso = spend(8, { date: '03/09/2025' });

    const isoResult = calculateFinancialScore(iso);
    const nonIsoResult = calculateFinancialScore(nonIso);

    expect(isoResult.hasEnoughData).toBe(true);
    expect(nonIsoResult.hasEnoughData).toBe(true);
    // Both should be first-month (no history) — both show 'History' first-month label
    // The bug was that non-ISO had NO 'History' label because all tx were misclassified
    expect(isoResult.breakdown.some((b) => b.label === 'History')).toBe(true);
    expect(nonIsoResult.breakdown.some((b) => b.label === 'History')).toBe(true);
    // Both should produce the same grade
    expect(isoResult.grade).toBe(nonIsoResult.grade);
    expect(isoResult.score).toBe(nonIsoResult.score);
  });
});
