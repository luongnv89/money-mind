import { Transaction } from '../../types';
import { Baseline, computeBaseline } from './baseline';
import { maxISO, minISO, toDayNumber } from './dates';
import { MoneyFormatter } from './format';
import { DayToDay, Insight, buildInsights } from './insights';
import { Ledger, LedgerEntry, entriesBetween } from './ledger';
import {
  Coverage,
  DatasetBounds,
  Granularity,
  Period,
  allTimePeriod,
  periodContaining,
  periodCoverage,
  periodsBetween,
  shiftPeriod,
} from './periods';
import { RecurringCharge, RecurringTotals, detectRecurring, totalRecurring } from './recurring';
import {
  EmergencyFundTarget,
  HealthScore,
  burnRate,
  computeHealthScore,
  emergencyFundTarget,
} from './score';
import { PeriodSummary, aggregate, ratiosOf, summarizePeriod, totalsOf } from './summary';

export interface TrendPoint {
  period: Period;
  income: number;
  spending: number;
  netCashFlow: number;
  setAside: number;
  savingsRate: number | null;
  coverage: Coverage;
  selected: boolean;
}

/** Everything the overview renders for one selected period. */
export interface FinanceModel {
  /** First and last transaction dates in the whole dataset. */
  bounds: DatasetBounds | null;
  period: Period;
  summary: PeriodSummary;
  baseline: Baseline | null;
  score: HealthScore;
  /** Active as of the end of the selected period. */
  recurring: RecurringCharge[];
  recurringTotals: RecurringTotals;
  /**
   * Spending without the recurring commitments above, for the period and its
   * baseline (null for 'all'). Weekly comparisons use it.
   */
  dayToDay: DayToDay | null;
  trend: TrendPoint[];
  insights: Insight[];
  /** Average monthly spending over the score window. */
  burnRate: number | null;
  emergencyFund: EmergencyFundTarget | null;
}

const TREND_LENGTH: Record<Granularity, number> = {
  week: 12,
  month: 12,
  quarter: 8,
  year: 6,
  all: 24,
};

/**
 * The period to show for a granularity and an anchor date (kept across
 * granularity switches). Without a valid anchor: the latest period with data.
 */
export const periodFor = (
  ledger: Ledger,
  granularity: Granularity,
  anchor: string | null = null
): Period | null => {
  const { bounds } = ledger;
  if (!bounds) return null;
  if (granularity === 'all') return allTimePeriod(bounds);
  const date =
    anchor && toDayNumber(anchor) !== null
      ? minISO(maxISO(anchor, bounds.first), bounds.last)
      : bounds.last;
  return periodContaining(granularity, date);
};

/** Periods of a granularity that contain at least one transaction, newest first. */
export const availablePeriods = (ledger: Ledger, granularity: Granularity): Period[] => {
  const { bounds } = ledger;
  if (!bounds) return [];
  if (granularity === 'all') return [allTimePeriod(bounds)];
  return periodsBetween(granularity, bounds.first, bounds.last)
    .filter((p) => entriesBetween(ledger, p.start, p.end).length > 0)
    .reverse();
};

/**
 * Transactions to list for a period. 'All time' also lists transactions whose
 * date couldn't be read (they're excluded from every metric).
 */
export const transactionsInPeriod = (ledger: Ledger, period: Period): Transaction[] =>
  period.granularity === 'all'
    ? [...ledger.entries.map((e) => e.tx), ...ledger.undated]
    : entriesBetween(ledger, period.start, period.end).map((e) => e.tx);

/** Whether stepping `delta` periods stays inside the data. */
export const canShift = (ledger: Ledger, period: Period, delta: number): boolean => {
  const { bounds } = ledger;
  if (!bounds || period.granularity === 'all' || period.granularity === 'range') return false;
  const next = shiftPeriod(period, delta);
  return next.end >= bounds.first && next.start <= bounds.last;
};

/** Income, spending and net for the periods leading up to (and including) the selection. */
export const buildTrend = (ledger: Ledger, period: Period): TrendPoint[] => {
  const { bounds } = ledger;
  if (!bounds) return [];

  let periods: Period[];
  if (period.granularity === 'all' || period.granularity === 'range') {
    periods = periodsBetween(
      'month',
      maxISO(period.start, bounds.first),
      minISO(period.end, bounds.last)
    ).slice(-TREND_LENGTH.all);
  } else {
    periods = [];
    for (let i = TREND_LENGTH[period.granularity] - 1; i >= 0; i--) {
      const candidate = shiftPeriod(period, -i);
      if (candidate.end >= bounds.first) periods.push(candidate);
    }
  }

  return periods.map((p) => {
    const totals = totalsOf(entriesBetween(ledger, p.start, p.end));
    return {
      period: p,
      income: totals.income,
      spending: totals.spending,
      netCashFlow: totals.netCashFlow,
      setAside: totals.setAside,
      savingsRate: ratiosOf(totals).savingsRate,
      coverage: periodCoverage(p, bounds),
      selected: p.key === period.key,
    };
  });
};

export const buildFinanceModel = (
  ledger: Ledger,
  period: Period,
  format: MoneyFormatter
): FinanceModel => {
  const summary = summarizePeriod(ledger, period);
  const baseline = computeBaseline(ledger, period);
  const score = computeHealthScore(ledger, period);
  const asOf = ledger.bounds ? minISO(period.end, ledger.bounds.last) : undefined;
  const recurring = detectRecurring(ledger, asOf);
  const recurringKeys = new Set(recurring.map((c) => c.key));
  const isDayToDay = (entry: LedgerEntry) => !recurringKeys.has(entry.merchant);
  const dayToDay: DayToDay | null =
    period.granularity === 'all' || period.granularity === 'range'
      ? null
      : {
          current: aggregate(entriesBetween(ledger, period.start, period.end).filter(isDayToDay)),
          baseline: computeBaseline(ledger, period, isDayToDay),
        };

  return {
    bounds: ledger.bounds,
    period,
    summary,
    baseline,
    score,
    recurring,
    recurringTotals: totalRecurring(recurring),
    dayToDay,
    trend: buildTrend(ledger, period),
    insights: buildInsights({ summary, baseline, score, recurring, dayToDay, format }),
    burnRate: burnRate(score.window),
    emergencyFund: emergencyFundTarget(score.window),
  };
};
