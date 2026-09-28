import { describe, expect, it } from 'vitest';
import { TransactionCategory as C } from '../../types';
import { buildAssistantContext } from './context';
import { householdQuarter, makeTx, usd } from './fixtures.test-util';
import { buildLedger } from './ledger';
import {
  availablePeriods,
  buildFinanceModel,
  buildTrend,
  canShift,
  periodFor,
  transactionsInPeriod,
} from './model';
import { periodContaining } from './periods';
import { statusFor } from './score';

describe('statusFor', () => {
  it('grades ratios against the shared benchmarks in the right direction', () => {
    expect(statusFor('savingsRate', 0.25)).toBe('good');
    expect(statusFor('savingsRate', 0.12)).toBe('fair');
    expect(statusFor('savingsRate', -0.1)).toBe('poor');
    expect(statusFor('housingRatio', 0.3)).toBe('good');
    expect(statusFor('housingRatio', 0.35)).toBe('fair');
    expect(statusFor('debtServiceRatio', 0.25)).toBe('poor');
    expect(statusFor('needsRatio', null)).toBeNull();
  });
});

describe('period navigation helpers', () => {
  // Data in Jan, Mar (no February) and May 1–20.
  const ledger = buildLedger([
    makeTx('2026-01-10', 'A', -10, C.NiceToHave),
    makeTx('2026-03-10', 'B', -10, C.NiceToHave),
    makeTx('2026-05-20', 'C', -10, C.NiceToHave),
  ]);

  it('defaults to the latest period and clamps anchors into the data', () => {
    expect(periodFor(ledger, 'month')?.key).toBe('2026-05');
    expect(periodFor(ledger, 'month', '2026-03-31')?.key).toBe('2026-03');
    expect(periodFor(ledger, 'month', '2027-01-01')?.key).toBe('2026-05');
    expect(periodFor(ledger, 'month', 'not a date')?.key).toBe('2026-05');
    expect(periodFor(ledger, 'week', '2026-05-20')?.start).toBe('2026-05-18');
    expect(periodFor(ledger, 'all')).toMatchObject({ start: '2026-01-10', end: '2026-05-20' });
    expect(periodFor(buildLedger([]), 'month')).toBeNull();
  });

  it('lists only periods with transactions, newest first', () => {
    expect(availablePeriods(ledger, 'month').map((p) => p.key)).toEqual([
      '2026-05',
      '2026-03',
      '2026-01',
    ]);
    expect(availablePeriods(ledger, 'quarter').map((p) => p.key)).toEqual(['2026-Q2', '2026-Q1']);
  });

  it('lists a period’s transactions; all time includes undated rows', () => {
    const withUndated = buildLedger([
      makeTx('2026-01-10', 'A', -10, C.NiceToHave),
      makeTx('2026-03-10', 'B', -10, C.NiceToHave),
      makeTx('10/03/2026', 'RAW', -10, C.NiceToHave),
    ]);
    const march = periodContaining('month', '2026-03-01');
    expect(transactionsInPeriod(withUndated, march).map((t) => t.description)).toEqual(['B']);
    const all = periodFor(withUndated, 'all')!;
    expect(transactionsInPeriod(withUndated, all).map((t) => t.description)).toEqual([
      'A',
      'B',
      'RAW',
    ]);
  });

  it('allows stepping only within the data range', () => {
    expect(canShift(ledger, periodContaining('month', '2026-05-01'), 1)).toBe(false);
    expect(canShift(ledger, periodContaining('month', '2026-05-01'), -1)).toBe(true);
    expect(canShift(ledger, periodContaining('month', '2026-01-01'), -1)).toBe(false);
  });
});

describe('buildTrend', () => {
  const ledger = buildLedger(householdQuarter());

  it('returns the periods up to the selection, trimmed to the data', () => {
    const trend = buildTrend(ledger, periodContaining('month', '2026-04-01'));
    expect(trend.map((p) => [p.period.key, p.income, p.spending, p.netCashFlow])).toEqual([
      ['2026-02', 4000, 4300, -300],
      ['2026-03', 4000, 3250, 750],
      ['2026-04', 4000, 3250, 750],
    ]);
    expect(trend.map((p) => p.selected)).toEqual([false, false, true]);
    expect(trend[1].savingsRate).toBeCloseTo(750 / 4000, 12);
  });
});

describe('buildFinanceModel + assistant context', () => {
  const model = buildFinanceModel(
    buildLedger(householdQuarter()),
    periodContaining('month', '2026-04-01'),
    usd
  );

  it('bundles the period summary with window-based figures', () => {
    expect(model.summary.totals.netCashFlow).toBe(750);
    expect(model.score.score).toBe(71);
    expect(model.burnRate).toBe(3600);
    expect(model.emergencyFund).toEqual({ monthlyEssentials: 2400, low: 7200, high: 14400 });
    expect(model.recurringTotals).toEqual({ count: 3, monthly: 1880, annual: 22560 });
    // Day-to-day = spending minus the rent, loan and late-fee commitments.
    expect(model.dayToDay?.current.totals.spending).toBe(3250 - 1880);
    expect(model.dayToDay?.baseline?.totals.spending).toBe((4300 + 3250) / 2 - 1880);
  });

  it('renders the same figures for the assistant, with no raw transaction list', () => {
    const context = buildAssistantContext(model, usd, 'USD');
    expect(context).toContain('Selected period: April 2026 (Apr 1, 2026 – Apr 30, 2026).');
    expect(context).toContain('All amounts are in USD.');
    expect(context).toContain('Net cash flow (income − spending): $750.00');
    expect(context).toContain('Savings rate: 19%');
    expect(context).toContain('COMPARED WITH 2-MONTH AVG (Average of Feb – Mar 2026)');
    expect(context).toContain('FINANCIAL HEALTH SCORE: 71/100 (C, Fair), based on Feb – Apr 2026');
    expect(context).toContain('Landlord Rent: $1400.00 monthly');
    expect(context).toContain('1. [warning] Housing costs are 35% of income.');
    expect(context).not.toContain('WHOLE FOODS'); // merchants appear only as cleaned labels
  });
});
