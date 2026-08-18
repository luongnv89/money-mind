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
});
