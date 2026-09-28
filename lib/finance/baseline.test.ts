import { describe, expect, it } from 'vitest';
import { Transaction, TransactionCategory as C } from '../../types';
import { compare, computeBaseline } from './baseline';
import { buildLedger } from './ledger';
import { periodContaining } from './periods';
import { summarizePeriod } from './summary';

let seq = 0;
const tx = (
  date: string,
  amount: number,
  category: C,
  subCategory: string,
  description = subCategory
): Transaction => ({
  id: `b${++seq}`,
  date,
  description,
  amount,
  category,
  subCategory,
  confidence: 1,
  isApproved: true,
});

const month = (m: string, dining: number): Transaction[] => [
  tx(`2026-${m}-01`, -1000, C.MustHave, 'Housing'),
  tx(`2026-${m}-15`, -200, C.MustHave, 'Food & Groceries'),
  tx(`2026-${m}-25`, -dining, C.NiceToHave, 'Dining Out'),
  tx(`2026-${m}-28`, 3000, C.Income, 'Salary'),
];

// Jan–Apr complete; May in progress through the 20th.
const ledger = buildLedger([
  ...month('01', 100),
  ...month('02', 100),
  ...month('03', 100),
  ...month('04', 400),
  tx('2026-05-01', -1000, C.MustHave, 'Housing'),
  tx('2026-05-15', -200, C.MustHave, 'Food & Groceries'),
  tx('2026-05-20', -30, C.NiceToHave, 'Dining Out'),
]);

describe('computeBaseline', () => {
  it('averages the previous three complete months for a complete month', () => {
    const baseline = computeBaseline(ledger, periodContaining('month', '2026-04-10'))!;
    expect(baseline.periods.map((p) => p.key)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(baseline).toMatchObject({
      kind: 'average',
      paceDays: null,
      label: '3-month avg',
      description: 'Average of Jan – Mar 2026',
    });
    expect(baseline.totals.spending).toBe(1300);
    expect(baseline.totals.income).toBe(3000);
    expect(baseline.subCategories['Nice-to-have|Dining Out']).toBe(100);
    expect(baseline.categories['Must-have']).toBe(1200);
  });

  it('compares a month in progress with the same leading days of past months', () => {
    const may = periodContaining('month', '2026-05-01');
    const baseline = computeBaseline(ledger, may)!;
    expect(baseline.periods.map((p) => p.key)).toEqual(['2026-02', '2026-03', '2026-04']);
    expect(baseline.paceDays).toBe(20);
    expect(baseline.description).toBe('Average of Feb – Apr 2026, first 20 days of each month');
    // Only rent (1st) and groceries (15th) fall in the first 20 days.
    expect(baseline.totals.spending).toBe(1200);
    expect(baseline.totals.income).toBe(0);
    expect(baseline.subCategories['Nice-to-have|Dining Out']).toBeUndefined();
    expect(summarizePeriod(ledger, may).totals.spending).toBe(1230);
  });

  it('uses the previous quarter, paced, for a quarter in progress', () => {
    const baseline = computeBaseline(ledger, periodContaining('quarter', '2026-05-01'))!;
    expect(baseline).toMatchObject({
      kind: 'previous',
      paceDays: 50,
      label: 'Q1 2026',
      description: 'Q1 2026, first 50 days',
    });
    // Jan 1 – Feb 19: all of January plus Feb rent and groceries; one salary.
    expect(baseline.totals.spending).toBe(2500);
    expect(baseline.totals.income).toBe(3000);
  });

  it('averages the same weekdays of the previous eight weeks for a week in progress', () => {
    const baseline = computeBaseline(ledger, periodContaining('week', '2026-05-20'))!;
    expect(baseline.periods).toHaveLength(8);
    expect(baseline.periods[0].start).toBe('2026-03-23');
    expect(baseline.paceDays).toBe(3);
    expect(baseline.label).toBe('8-week avg');
    // Mon–Wed hits: dining Mar 25, rent Apr 1, groceries Apr 15; salary Tue Apr 28.
    expect(baseline.totals.spending).toBe(162.5);
    expect(baseline.totals.income).toBe(375);
  });

  it('has no baseline without earlier complete periods', () => {
    expect(computeBaseline(ledger, periodContaining('month', '2026-01-10'))).toBeNull();
    const lateStart = buildLedger([
      tx('2026-01-05', -1000, C.MustHave, 'Housing'),
      ...month('02', 100),
    ]);
    expect(computeBaseline(lateStart, periodContaining('month', '2026-01-10'))).toBeNull();
    expect(computeBaseline(lateStart, periodContaining('month', '2026-02-10'))).toBeNull();
  });
});

describe('compare', () => {
  it('returns absolute and relative change', () => {
    expect(compare(110, 100)).toEqual({ absolute: 10, relative: 0.1 });
    expect(compare(5, 0)).toEqual({ absolute: 5, relative: null });
    expect(compare(-50, -100).relative).toBe(0.5);
  });
});
