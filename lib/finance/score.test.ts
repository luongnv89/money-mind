import { describe, expect, it } from 'vitest';
import { TransactionCategory as C } from '../../types';
import { householdQuarter, makeTx } from './fixtures.test-util';
import { buildLedger } from './ledger';
import { periodContaining } from './periods';
import { burnRate, computeHealthScore, emergencyFundTarget, selectScoreMonths } from './score';

const keys = (months: { key: string }[]) => months.map((m) => m.key);

describe('selectScoreMonths', () => {
  // Jan 1 – May 20, 2026: Jan–Apr complete, May in progress.
  const ledger = buildLedger([
    makeTx('2026-01-01', 'A', -1, C.NiceToHave),
    makeTx('2026-05-20', 'B', -1, C.NiceToHave),
  ]);

  it('uses the last three complete months, skipping one in progress', () => {
    expect(keys(selectScoreMonths(ledger, periodContaining('month', '2026-05-01')).months)).toEqual(
      ['2026-02', '2026-03', '2026-04']
    );
    expect(keys(selectScoreMonths(ledger, periodContaining('month', '2026-04-01')).months)).toEqual(
      ['2026-02', '2026-03', '2026-04']
    );
    expect(keys(selectScoreMonths(ledger, periodContaining('month', '2026-02-01')).months)).toEqual(
      ['2026-01', '2026-02']
    );
    expect(keys(selectScoreMonths(ledger, periodContaining('week', '2026-05-06')).months)).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
  });

  it('uses every complete month of a quarter or year', () => {
    expect(
      keys(selectScoreMonths(ledger, periodContaining('quarter', '2026-02-01')).months)
    ).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(keys(selectScoreMonths(ledger, periodContaining('year', '2026-02-01')).months)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
  });

  it('falls back to a partial month, flagged provisional', () => {
    const partial = buildLedger([makeTx('2026-05-05', 'A', -1, C.NiceToHave)]);
    const result = selectScoreMonths(partial, periodContaining('month', '2026-05-01'));
    expect(keys(result.months)).toEqual(['2026-05']);
    expect(result.provisional).toBe(true);
  });
});

describe('computeHealthScore', () => {
  const ledger = buildLedger(householdQuarter());
  const score = computeHealthScore(ledger, periodContaining('month', '2026-04-01'));

  it('scores six standard ratios on the window and sums the points', () => {
    // Window Feb–Apr: income 12,000; needs 7,200 (housing 4,200, loans 1,200);
    // wants 3,360 + waste 240; spending 10,800; net 1,200; 2 of 3 months positive.
    expect(score.window.label).toBe('Feb – Apr 2026');
    expect(score.window.totals).toMatchObject({
      income: 12000,
      needs: 7200,
      spending: 10800,
      netCashFlow: 1200,
    });
    expect(score.components.map((c) => [c.id, c.display, c.points, c.maxPoints, c.status])).toEqual(
      [
        ['savingsRate', '10%', 15, 30, 'fair'],
        ['needsRatio', '60%', 13, 20, 'fair'],
        ['wantsRatio', '30%', 15, 15, 'good'],
        ['avoidableCosts', '2.2%', 8, 10, 'fair'],
        ['debtService', '10%', 10, 10, 'good'],
        ['consistency', '2 of 3 months', 10, 15, 'fair'],
      ]
    );
    expect(score).toMatchObject({ score: 71, grade: 'C', rating: 'Fair', reason: null });
    expect(score.caveat).toBeNull();
  });

  it('derives the emergency-fund target and burn rate from the same window', () => {
    expect(emergencyFundTarget(score.window)).toEqual({
      monthlyEssentials: 2400,
      low: 7200,
      high: 14400,
    });
    expect(burnRate(score.window)).toBe(3600);
  });

  it('refuses to score without income instead of defaulting to 100', () => {
    const noIncome = buildLedger(householdQuarter().filter((t) => t.category !== C.Income));
    const result = computeHealthScore(noIncome, periodContaining('month', '2026-04-01'));
    expect(result.score).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.components).toEqual([]);
    expect(result.reason).toContain('No income recorded in Feb – Apr 2026');
  });

  it('flags provisional and poorly categorized windows', () => {
    const partial = buildLedger([
      makeTx('2026-05-05', 'PAY', 3000, C.Income),
      makeTx('2026-05-06', 'RENT', -1000, C.MustHave, 'Housing'),
      makeTx('2026-05-07', '???', -500, C.Uncategorized),
    ]);
    const result = computeHealthScore(partial, periodContaining('month', '2026-05-01'));
    expect(result.score).not.toBeNull();
    expect(result.window.provisional).toBe(true);
    expect(result.caveat).toContain('partial month');
    expect(result.caveat).toContain('33% of money out in May 2026 is uncategorized');
  });
});
