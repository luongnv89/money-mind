import { beforeEach, describe, expect, it } from 'vitest';
import { computeBudgetMetrics } from './budgetMetrics';
import { Transaction, TransactionCategory } from '../types';

const tx = (
  id: string,
  date: string,
  category: TransactionCategory,
  amount: number
): Transaction => ({
  id,
  date,
  description: `Tx ${id}`,
  amount,
  category,
  confidence: 0,
});

describe('computeBudgetMetrics (issue #37, F-BUG-012)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const all = [
    tx('jan-1', '2026-01-05', TransactionCategory.MustHave, -100),
    tx('jan-2', '2026-01-20', TransactionCategory.NiceToHave, -50),
    tx('feb-1', '2026-02-05', TransactionCategory.MustHave, -200),
    tx('mar-1', '2026-03-05', TransactionCategory.MustHave, -300),
    tx('mar-2', '2026-03-25', TransactionCategory.Save, -80),
  ];

  it('derives the current month from the filtered transactions, not all history', () => {
    const janOnly = all.filter((t) => t.date.startsWith('2026-01'));

    const metrics = computeBudgetMetrics(janOnly, all);

    expect(metrics).not.toBeNull();
    expect(metrics?.monthLabel).toMatch(/January/);
    expect(metrics?.current.mustHave).toBe(100);
    expect(metrics?.current.niceToHave).toBe(50);
  });

  it('falls back to all transactions when the filter matches nothing', () => {
    const metrics = computeBudgetMetrics([], all);

    expect(metrics).not.toBeNull();
    expect(metrics?.monthLabel).toMatch(/March/);
    expect(metrics?.current.mustHave).toBe(300);
  });

  it('returns null when there is no data at all', () => {
    expect(computeBudgetMetrics([], [])).toBeNull();
  });
});
