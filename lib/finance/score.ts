import { maxISO, minISO } from './dates';
import { formatPercent, round2 } from './format';
import { Ledger, entriesBetween } from './ledger';
import {
  Period,
  monthEquivalents,
  monthsLabel,
  periodContaining,
  periodCoverage,
  periodsBetween,
  shiftPeriod,
} from './periods';
import { Aggregate, aggregate, totalsOf } from './summary';

export type ComponentId =
  'savingsRate' | 'needsRatio' | 'wantsRatio' | 'avoidableCosts' | 'debtService' | 'consistency';

export type ComponentStatus = 'good' | 'fair' | 'poor';

/** Ratios that have a published rule-of-thumb benchmark. */
export type BenchmarkedMetric =
  | 'savingsRate'
  | 'setAside'
  | 'needsRatio'
  | 'wantsRatio'
  | 'housingRatio'
  | 'debtServiceRatio'
  | 'avoidableCosts';

export interface Benchmark {
  direction: 'higher' | 'lower';
  /** At or beyond this the ratio is healthy. */
  good: number;
  /** Between good and fair it needs watching; beyond fair it's poor. */
  fair: number;
  target: string;
}

/** Single source of every status threshold shown in the app. */
export const BENCHMARKS: Record<BenchmarkedMetric, Benchmark> = {
  savingsRate: { direction: 'higher', good: 0.2, fair: 0.1, target: '≥ 20%' },
  setAside: { direction: 'higher', good: 0.1, fair: 0.05, target: '≥ 10%' },
  needsRatio: { direction: 'lower', good: 0.5, fair: 0.65, target: '≤ 50%' },
  wantsRatio: { direction: 'lower', good: 0.3, fair: 0.4, target: '≤ 30%' },
  housingRatio: { direction: 'lower', good: 0.3, fair: 0.4, target: '≤ 30%' },
  debtServiceRatio: { direction: 'lower', good: 0.1, fair: 0.2, target: '≤ 10%' },
  avoidableCosts: { direction: 'lower', good: 0.01, fair: 0.03, target: '≤ 1% of spending' },
};

export const statusFor = (
  metric: BenchmarkedMetric,
  value: number | null
): ComponentStatus | null => {
  if (value === null) return null;
  const { direction, good, fair } = BENCHMARKS[metric];
  if (direction === 'higher') return value >= good ? 'good' : value >= fair ? 'fair' : 'poor';
  return value <= good ? 'good' : value <= fair ? 'fair' : 'poor';
};

export interface ScoreComponent {
  id: ComponentId;
  label: string;
  /** The measured ratio (share of months for consistency). */
  value: number | null;
  /** Formatted value: `18%`, `2 of 3 months`. */
  display: string;
  /** Benchmark: `≥ 20%`. */
  target: string;
  points: number;
  maxPoints: number;
  status: ComponentStatus;
}

/** The months a score (and structural advice) is computed on. */
export interface ScoreWindow extends Aggregate {
  periods: Period[];
  label: string;
  /** Calendar-month equivalents covered by data. */
  months: number;
  /** Months whose income exceeded spending. */
  positiveMonths: number;
  /** True when no complete month was available and partial data was used. */
  provisional: boolean;
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface HealthScore {
  /** 0–100, null when it can't be computed (no income in the window). */
  score: number | null;
  grade: Grade | null;
  rating: string | null;
  components: ScoreComponent[];
  window: ScoreWindow;
  /** Why the score is null. */
  reason: string | null;
  /** Caveat about the data behind a computed score. */
  caveat: string | null;
}

/** Trailing complete months used for month/week selections. */
export const SCORE_WINDOW_MONTHS = 3;
const SCORE_LOOKBACK_MONTHS = 12;
/** Above this share of uncategorized money out, the score is flagged as unstable. */
const UNCATEGORIZED_CAVEAT_SHARE = 0.1;

/** 0 at `zeroAt`, 1 at `fullAt` and beyond; higher values are better. */
const rampUp = (value: number, zeroAt: number, fullAt: number): number =>
  Math.min(1, Math.max(0, (value - zeroAt) / (fullAt - zeroAt)));

/** 1 at `fullAt` and below, 0 at `zeroAt` and beyond; lower values are better. */
const rampDown = (value: number, fullAt: number, zeroAt: number): number =>
  Math.min(1, Math.max(0, (zeroAt - value) / (zeroAt - fullAt)));

const gradeFor = (score: number): Grade =>
  score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

const RATING: Record<Grade, string> = {
  A: 'Excellent',
  B: 'Good',
  C: 'Fair',
  D: 'Needs attention',
  F: 'At risk',
};

/**
 * Month selection:
 * - week/month: the last SCORE_WINDOW_MONTHS complete months up to and
 *   including the selected one (a month still in progress is skipped);
 * - quarter/year/all/range: every complete month inside the period.
 * Falls back to partial months (provisional) when no complete month exists.
 */
export const selectScoreMonths = (
  ledger: Ledger,
  anchor: Period
): { months: Period[]; provisional: boolean } => {
  const { bounds } = ledger;
  if (!bounds) return { months: [], provisional: true };
  const isComplete = (month: Period) => periodCoverage(month, bounds).isComplete;

  if (anchor.granularity === 'month' || anchor.granularity === 'week') {
    const last = periodContaining('month', maxISO(minISO(anchor.end, bounds.last), bounds.first));
    const picked: Period[] = [];
    for (let i = 0; i < SCORE_LOOKBACK_MONTHS && picked.length < SCORE_WINDOW_MONTHS; i++) {
      const month = shiftPeriod(last, -i);
      if (month.end < bounds.first) break;
      if (isComplete(month)) picked.push(month);
    }
    if (picked.length > 0) return { months: picked.reverse(), provisional: false };
    return { months: [last], provisional: true };
  }

  const from = maxISO(anchor.start, bounds.first);
  const through = minISO(anchor.end, bounds.last);
  if (from > through) return { months: [], provisional: true };
  const months = periodsBetween('month', from, through);
  const complete = months.filter(isComplete);
  return complete.length > 0
    ? { months: complete, provisional: false }
    : { months, provisional: true };
};

export const buildScoreWindow = (ledger: Ledger, anchor: Period): ScoreWindow => {
  const { months, provisional } = selectScoreMonths(ledger, anchor);
  const perMonth = months.map((m) => entriesBetween(ledger, m.start, m.end));
  const monthCount = months.reduce((sum, m) => {
    const coverage = periodCoverage(m, ledger.bounds);
    return coverage.from && coverage.through
      ? sum + monthEquivalents(coverage.from, coverage.through)
      : sum;
  }, 0);
  return {
    ...aggregate(perMonth.flat()),
    periods: months,
    label: monthsLabel(months),
    months: monthCount,
    positiveMonths: perMonth.filter((entries) => totalsOf(entries).netCashFlow > 0).length,
    provisional,
  };
};

export interface EmergencyFundTarget {
  monthlyEssentials: number;
  /** 3 months of essentials. */
  low: number;
  /** 6 months of essentials. */
  high: number;
}

/** 3–6 months of the window's average monthly Must-have spending. */
export const emergencyFundTarget = (window: ScoreWindow): EmergencyFundTarget | null => {
  if (window.months <= 0 || window.totals.needs <= 0) return null;
  const monthlyEssentials = round2(window.totals.needs / window.months);
  return {
    monthlyEssentials,
    low: round2(monthlyEssentials * 3),
    high: round2(monthlyEssentials * 6),
  };
};

/** Average monthly spending over the window. */
export const burnRate = (window: ScoreWindow): number | null =>
  window.months > 0 ? round2(window.totals.spending / window.months) : null;

const ratioComponent = (
  id: Exclude<ComponentId, 'consistency'>,
  metric: BenchmarkedMetric,
  label: string,
  value: number,
  maxPoints: number,
  fraction: number
): ScoreComponent => ({
  id,
  label,
  value,
  display: formatPercent(value),
  target: BENCHMARKS[metric].target,
  points: Math.round(maxPoints * fraction),
  maxPoints,
  status: statusFor(metric, value)!,
});

/**
 * The six standard ratios behind the score; weights sum to 100. Full points
 * at the benchmark, zero at the stated limit, linear in between.
 */
const scoreComponents = (window: ScoreWindow): ScoreComponent[] => {
  const r = window.ratios;
  const savings = r.savingsRate ?? 0;
  const needs = r.needsRatio ?? 0;
  const wants = r.wantsRatio ?? 0;
  const avoidable = r.avoidableShare ?? 0;
  const debt = r.debtServiceRatio ?? 0;
  const monthsInWindow = window.periods.length;
  const consistency = monthsInWindow > 0 ? window.positiveMonths / monthsInWindow : 0;

  return [
    ratioComponent(
      'savingsRate',
      'savingsRate',
      'Savings rate',
      savings,
      30,
      rampUp(savings, 0, 0.2)
    ),
    ratioComponent(
      'needsRatio',
      'needsRatio',
      'Essentials (needs)',
      needs,
      20,
      rampDown(needs, 0.5, 0.8)
    ),
    ratioComponent(
      'wantsRatio',
      'wantsRatio',
      'Lifestyle (wants)',
      wants,
      15,
      rampDown(wants, 0.3, 0.5)
    ),
    ratioComponent(
      'avoidableCosts',
      'avoidableCosts',
      'Avoidable costs',
      avoidable,
      10,
      rampDown(avoidable, 0.01, 0.06)
    ),
    ratioComponent(
      'debtService',
      'debtServiceRatio',
      'Loan payments',
      debt,
      10,
      rampDown(debt, 0.1, 0.3)
    ),
    {
      id: 'consistency',
      label: 'Months in surplus',
      value: consistency,
      display: `${window.positiveMonths} of ${monthsInWindow} ${monthsInWindow === 1 ? 'month' : 'months'}`,
      target: 'every month',
      points: Math.round(15 * consistency),
      maxPoints: 15,
      status: consistency >= 1 ? 'good' : consistency >= 0.5 ? 'fair' : 'poor',
    },
  ];
};

/**
 * A transparent 0–100 financial health score: six standard ratios, each
 * scored on published benchmarks and weighted (savings rate 30, needs 20,
 * wants 15, avoidable costs 10, loan payments 10, months in surplus 15),
 * computed on recent complete months so pay timing can't swing it.
 */
export const computeHealthScore = (ledger: Ledger, anchor: Period): HealthScore => {
  const window = buildScoreWindow(ledger, anchor);

  if (window.periods.length === 0) {
    return {
      score: null,
      grade: null,
      rating: null,
      components: [],
      window,
      reason: 'No transactions in this period.',
      caveat: null,
    };
  }

  if (window.totals.income <= 0) {
    return {
      score: null,
      grade: null,
      rating: null,
      components: [],
      window,
      reason: `No income recorded in ${window.label}. If your pay lands in this account, make sure those deposits are categorized as Income.`,
      caveat: null,
    };
  }

  const components = scoreComponents(window);
  const score = components.reduce((sum, c) => sum + c.points, 0);
  const grade = gradeFor(score);
  const caveats: string[] = [];
  if (window.provisional)
    caveats.push('Based on a partial month; the score settles once a full month of data exists.');
  if (window.quality.uncategorizedShare >= UNCATEGORIZED_CAVEAT_SHARE)
    caveats.push(
      `${formatPercent(window.quality.uncategorizedShare)} of money out in ${window.label} is uncategorized, so the score may change once it is categorized.`
    );

  return {
    score,
    grade,
    rating: RATING[grade],
    components,
    window,
    reason: null,
    caveat: caveats.length > 0 ? caveats.join(' ') : null,
  };
};
