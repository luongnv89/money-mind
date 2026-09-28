import { addDays, daysBetweenInclusive, minISO } from './dates';
import { round2 } from './format';
import { Ledger, LedgerEntry, entriesBetween } from './ledger';
import { Period, monthsLabel, periodCoverage, shiftPeriod } from './periods';
import { FlowTotals, aggregate } from './summary';

/**
 * What the selected period is compared against: the average of recent
 * complete periods (never partial ones). When the selected period is still in
 * progress, only the same number of leading days of each baseline period is
 * used, so "month to date" is compared with "typical by this day of the month"
 * — rent paid on the 1st doesn't make a half month look expensive.
 */
export interface Baseline {
  kind: 'average' | 'previous';
  /** Leading days compared when the selected period is in progress. */
  paceDays: number | null;
  /** Baseline periods, oldest first. */
  periods: Period[];
  /** Short label for deltas: `3-month avg`, `8-week avg`, `Q1 2026`. */
  label: string;
  /** Sentence-case explanation shown on hover. */
  description: string;
  /** Average per baseline period. */
  totals: FlowTotals;
  /** Average spending per category key (`Must-have`). */
  categories: Record<string, number>;
  /** Average spending per subcategory key (`Must-have|Housing`). */
  subCategories: Record<string, number>;
}

export interface Delta {
  absolute: number;
  /** Relative change, null when the baseline is 0. */
  relative: number | null;
}

export const compare = (current: number, base: number): Delta => ({
  absolute: round2(current - base),
  relative: base !== 0 ? (current - base) / Math.abs(base) : null,
});

const RULES = {
  week: { kind: 'average', count: 8, lookback: 16 },
  month: { kind: 'average', count: 3, lookback: 12 },
  quarter: { kind: 'previous', count: 1, lookback: 4 },
  year: { kind: 'previous', count: 1, lookback: 3 },
} as const;

/** Per-key average; a key missing from a period counts as 0 for that period. */
const averageRecord = (records: Record<string, number>[], n: number): Record<string, number> => {
  const sums: Record<string, number> = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) sums[key] = (sums[key] ?? 0) + value;
  }
  return Object.fromEntries(Object.entries(sums).map(([key, sum]) => [key, round2(sum / n)]));
};

const averageTotals = (list: FlowTotals[]): FlowTotals => {
  const average = { ...list[0] };
  for (const key of Object.keys(average) as (keyof FlowTotals)[]) {
    average[key] = round2(list.reduce((sum, totals) => sum + totals[key], 0) / list.length);
  }
  return average;
};

const describeBaseline = (
  granularity: keyof typeof RULES,
  periods: Period[],
  paceDays: number | null
): { label: string; description: string } => {
  const n = periods.length;
  const pace = paceDays === null ? '' : `, first ${paceDays} ${paceDays === 1 ? 'day' : 'days'}`;
  if (granularity === 'month') {
    if (n === 1) return { label: periods[0].label, description: `${periods[0].label}${pace}` };
    return {
      label: `${n}-month avg`,
      description: `Average of ${monthsLabel(periods)}${pace ? `${pace} of each month` : ''}`,
    };
  }
  if (granularity === 'week') {
    return {
      label: n === 1 ? 'previous week' : `${n}-week avg`,
      description: `Average of the ${n === 1 ? 'previous complete week' : `${n} previous complete weeks`}${pace ? `${pace} of each week` : ''}`,
    };
  }
  return { label: periods[0].label, description: `${periods[0].label}${pace}` };
};

/**
 * `include` restricts both sides of the comparison to the same entries (e.g.
 * day-to-day spending without recurring commitments).
 */
export const computeBaseline = (
  ledger: Ledger,
  period: Period,
  include?: (entry: LedgerEntry) => boolean
): Baseline | null => {
  const { bounds } = ledger;
  if (!bounds || period.granularity === 'all' || period.granularity === 'range') return null;

  const coverage = periodCoverage(period, bounds);
  if (!coverage.isComplete && !coverage.isInProgress) return null;

  const rule = RULES[period.granularity];
  const paceDays = coverage.isInProgress ? daysBetweenInclusive(period.start, bounds.last) : null;

  const periods: Period[] = [];
  for (let i = 1; i <= rule.lookback && periods.length < rule.count; i++) {
    const candidate = shiftPeriod(period, -i);
    if (candidate.end < bounds.first) break;
    if (periodCoverage(candidate, bounds).isComplete) periods.push(candidate);
  }
  if (periods.length === 0) return null;
  periods.reverse();

  const aggregates = periods.map((p) => {
    const end = paceDays === null ? p.end : minISO(p.end, addDays(p.start, paceDays - 1));
    const entries = entriesBetween(ledger, p.start, end);
    return aggregate(include ? entries.filter(include) : entries);
  });
  const n = aggregates.length;

  return {
    kind: rule.kind,
    paceDays,
    periods,
    ...describeBaseline(period.granularity, periods, paceDays),
    totals: averageTotals(aggregates.map((a) => a.totals)),
    categories: averageRecord(
      aggregates.map((a) => Object.fromEntries(a.categories.map((c) => [c.key, c.amount]))),
      n
    ),
    subCategories: averageRecord(
      aggregates.map((a) => Object.fromEntries(a.subCategories.map((c) => [c.key, c.amount]))),
      n
    ),
  };
};
