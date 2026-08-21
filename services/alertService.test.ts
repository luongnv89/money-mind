import { describe, expect, it } from 'vitest';
import { checkFinancialHealth } from './alertService';
import { Transaction, TransactionCategory } from '../types';

const tx = (
  id: string,
  date: string,
  amount: number,
  category: TransactionCategory
): Transaction => ({
  id,
  date,
  description: `tx-${id}`,
  amount,
  category,
  confidence: 1,
});

describe('checkFinancialHealth alert ranking', () => {
  it('ranks a 200% drift above a 25% drift regardless of quip length', () => {
    const transactions: Transaction[] = [
      // High-drift category: history 100/month for 2 months, current 300 => 200%
      tx('a1', '2026-06-01', -100, TransactionCategory.Waste),
      tx('a2', '2026-07-01', -100, TransactionCategory.Waste),
      tx('a3', '2026-08-01', -300, TransactionCategory.Waste),
      // Low-drift category: history 100/month for 2 months, current 125 => 25%
      tx('b1', '2026-06-01', -100, TransactionCategory.NiceToHave),
      tx('b2', '2026-07-01', -100, TransactionCategory.NiceToHave),
      tx('b3', '2026-08-01', -125, TransactionCategory.NiceToHave),
      // Padding to clear the 10-expense minimum
      tx('c1', '2026-06-05', -20, TransactionCategory.MustHave),
      tx('c2', '2026-06-20', -20, TransactionCategory.MustHave),
      tx('c3', '2026-07-05', -20, TransactionCategory.MustHave),
      tx('c4', '2026-07-20', -20, TransactionCategory.MustHave),
      tx('c5', '2026-08-05', -20, TransactionCategory.MustHave),
      tx('c6', '2026-08-20', -20, TransactionCategory.MustHave),
    ];

    const alerts = checkFinancialHealth(transactions);

    expect(alerts).toHaveLength(2);
    // The 200% drift (Waste) must rank first even if its quip is shorter.
    expect(alerts[0]?.message).toMatch(/^Waste is up 200%/);
    expect(alerts[1]?.message).toMatch(/^Nice-to-have is up 25%/);
    // Drift ordering is strictly descending.
    expect(alerts[0].drift).toBeGreaterThan(alerts[1].drift);
    expect(alerts[0].drift).toBe(200);
    expect(alerts[1].drift).toBe(25);
  });
});
