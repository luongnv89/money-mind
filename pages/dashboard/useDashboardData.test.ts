import { describe, expect, it } from 'vitest';
import { filterByTimeRange, formatDateRange, summarizeTransactions } from './useDashboardData';
import { Transaction, TransactionCategory } from '../../types';

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  date: '2026-01-15',
  description: 'STARBUCKS #12345',
  amount: -5.75,
  category: TransactionCategory.Uncategorized,
  confidence: 0,
  ...overrides,
});

describe('summarizeTransactions (issue #40, F-PERF-007)', () => {
  it('replaces the four per-render full-array scans with one pass', () => {
    const counts = summarizeTransactions([
      tx({ id: 'a', category: TransactionCategory.Uncategorized, reason: 'ok', isApproved: true }),
      tx({
        id: 'b',
        category: TransactionCategory.MustHave,
        reason: 'Failed: 429',
        isApproved: false,
      }),
      tx({
        id: 'c',
        category: TransactionCategory.Waste,
        reason: 'Error: network',
        isApproved: false,
      }),
      tx({
        id: 'd',
        category: TransactionCategory.NiceToHave,
        reason: 'Categorized',
        isApproved: false,
      }),
    ]);

    expect(counts).toEqual({
      uncategorizedCount: 1,
      failedCount: 2,
      unapprovedCount: 3,
    });
  });

  it('counts nothing for an empty month', () => {
    expect(summarizeTransactions([])).toEqual({
      uncategorizedCount: 0,
      failedCount: 0,
      unapprovedCount: 0,
    });
  });
});

describe('filterByTimeRange uses a reduce-based max (issue #40, F-PERF-011)', () => {
  it('keeps only transactions inside the window ending at the newest one', () => {
    const newest = tx({ id: 'new', date: '2026-06-15' });
    const old = tx({ id: 'old', date: '2026-01-01' });
    const near = tx({ id: 'near', date: '2026-06-01' });

    expect(filterByTimeRange([old, newest, near], 'month')).toEqual([newest, near]);
    expect(filterByTimeRange([old, newest, near], 'week')).toEqual([newest]);
    expect(filterByTimeRange([old, newest, near], 'all')).toEqual([old, newest, near]);
  });
});

describe('formatDateRange survives datasets large enough to break spread (issue #40, F-PERF-011)', () => {
  it('does not blow the call stack on 200k transactions', () => {
    // Math.max(...timestamps) throws RangeError at this size; the reduce
    // implementation must format the same range without throwing.
    const start = Date.UTC(2026, 0, 1);
    const big = Array.from({ length: 200_000 }, (_, i) =>
      tx({ id: `tx-${i}`, date: new Date(start + i * 60_000).toISOString() })
    );

    const expected = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(start + 199_999 * 60_000));

    expect(() => formatDateRange(big)).not.toThrow();
    expect(formatDateRange(big)).toBe(`Jan 1, 2026 - ${expected}`);
  });
});
