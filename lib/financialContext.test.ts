import { beforeEach, describe, expect, it } from 'vitest';
import { buildFinancialContext, selectRecentTransactions } from './financialContext';
import { Transaction, TransactionCategory } from '../types';

const tx = (id: string, date: string, description: string): Transaction => ({
  id,
  date,
  description,
  amount: -10,
  category: TransactionCategory.Uncategorized,
  confidence: 0,
});

describe('financialContext (issue #37, F-BUG-010)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('selectRecentTransactions returns the newest transactions by date, not input order', () => {
    const txs = [
      tx('a', '2026-03-01', 'Oldest'),
      tx('b', '2026-03-20', 'Newest'),
      tx('c', '2026-03-10', 'Middle'),
    ];

    expect(selectRecentTransactions(txs, 2).map((t) => t.id)).toEqual(['b', 'c']);
  });

  it('buildFinancialContext lists the five MOST RECENT month transactions as "Last 5"', () => {
    // Dataset in chronological (oldest-first) order, all within the latest month.
    const txs = Array.from({ length: 8 }, (_, i) =>
      tx(`tx-${i + 1}`, `2026-03-0${i + 1}`, `Payment ${i + 1}`)
    );

    const context = buildFinancialContext(txs);

    expect(context).toContain('Payment 8');
    expect(context).toContain('Payment 4');
    expect(context).not.toContain('Payment 1');
    expect(context).not.toContain('Payment 3');
  });
});
