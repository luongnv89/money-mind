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

  // characterization — Task 2.1 will invert this
  // Today the current-month bucket matches the raw date string against the ISO
  // currentMonthKey ('2025-03'), so valid non-ISO dates (e.g. US '03/09/2025')
  // never match and the whole set is silently treated as history. Both inputs
  // are the same eight March-2025 expenses; only the string format differs.
  // When Task 2.1 normalizes date handling, the non-ISO result must match the
  // ISO result — flip the second assertion back to `toBe(true)`.
  it('misclassifies non-ISO dates as history instead of the current month', () => {
    const iso = spend(8, { date: '2025-03-09' });
    const nonIso = spend(8, { date: '03/09/2025' });

    const isoResult = calculateFinancialScore(iso);
    const nonIsoResult = calculateFinancialScore(nonIso);

    expect(isoResult.hasEnoughData).toBe(true);
    expect(isoResult.breakdown.some((b) => b.label === 'History')).toBe(true);
    expect(nonIsoResult.breakdown.some((b) => b.label === 'History')).toBe(false);
  });
});
