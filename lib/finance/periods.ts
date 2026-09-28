import {
  MONTH_LONG,
  MONTH_SHORT,
  dayOf,
  daysBetweenInclusive,
  daysInMonth,
  formatISODate,
  fromDayNumber,
  maxISO,
  minISO,
  mondayIndex,
  parseISODate,
  toISODate,
} from './dates';

/** Calendar granularities the user can navigate by. */
export type Granularity = 'week' | 'month' | 'quarter' | 'year' | 'all';

/** A navigable calendar period, or an internal 'range' (e.g. a score window). */
export interface Period {
  granularity: Granularity | 'range';
  /** Unique within its granularity: `W2026-05-04`, `2026-05`, `2026-Q2`, `2026`, `all`. */
  key: string;
  /** Inclusive `YYYY-MM-DD`. */
  start: string;
  /** Inclusive `YYYY-MM-DD`. */
  end: string;
  /** `May 2026`, `May 4 – 10, 2026`, `Q2 2026`, `2026`, `All time`. */
  label: string;
  /** Compact axis label: `May`, `May 4`, `Q2 ’26`, `2026`. */
  shortLabel: string;
}

/** First and last valid transaction date in the dataset. */
export interface DatasetBounds {
  first: string;
  last: string;
}

/** A period counts as complete once the data covers at least this share of its days. */
export const COMPLETE_COVERAGE = 0.9;

export interface Coverage {
  totalDays: number;
  /** Days of the period inside the dataset's first–last date span. */
  coveredDays: number;
  ratio: number;
  /** ≥ COMPLETE_COVERAGE of its days covered and not still in progress. */
  isComplete: boolean;
  /** The data stops inside this period (e.g. month to date). */
  isInProgress: boolean;
  /** The data starts after this period's first day. */
  startsMidPeriod: boolean;
  /** Covered span, or null when the period lies outside the data. */
  from: string | null;
  through: string | null;
}

const weekLabel = (start: string, end: string): string => {
  const s = parseISODate(start)!;
  const e = parseISODate(end)!;
  if (s.year !== e.year) return `${formatISODate(start)} – ${formatISODate(end)}`;
  if (s.month !== e.month)
    return `${formatISODate(start, 'monthDay')} – ${formatISODate(end, 'monthDay')}, ${e.year}`;
  return `${MONTH_SHORT[s.month - 1]} ${s.day} – ${e.day}, ${e.year}`;
};

const monthPeriod = (year: number, month: number): Period => ({
  granularity: 'month',
  key: `${year}-${String(month).padStart(2, '0')}`,
  start: toISODate(year, month, 1),
  end: toISODate(year, month, daysInMonth(year, month)),
  label: `${MONTH_LONG[month - 1]} ${year}`,
  shortLabel: MONTH_SHORT[month - 1],
});

const quarterPeriod = (year: number, quarter: number): Period => {
  const firstMonth = (quarter - 1) * 3 + 1;
  return {
    granularity: 'quarter',
    key: `${year}-Q${quarter}`,
    start: toISODate(year, firstMonth, 1),
    end: toISODate(year, firstMonth + 2, daysInMonth(year, firstMonth + 2)),
    label: `Q${quarter} ${year}`,
    shortLabel: `Q${quarter} ’${String(year).slice(-2)}`,
  };
};

const yearPeriod = (year: number): Period => ({
  granularity: 'year',
  key: String(year),
  start: toISODate(year, 1, 1),
  end: toISODate(year, 12, 31),
  label: String(year),
  shortLabel: String(year),
});

const weekPeriod = (startDay: number): Period => {
  const start = fromDayNumber(startDay);
  const end = fromDayNumber(startDay + 6);
  return {
    granularity: 'week',
    key: `W${start}`,
    start,
    end,
    label: weekLabel(start, end),
    shortLabel: formatISODate(start, 'monthDay'),
  };
};

/** The week (Monday–Sunday), month, quarter or year containing `iso`. */
export const periodContaining = (granularity: Exclude<Granularity, 'all'>, iso: string): Period => {
  const parts = parseISODate(iso);
  if (!parts) throw new Error(`Invalid ISO date: ${iso}`);
  switch (granularity) {
    case 'week': {
      const day = dayOf(iso);
      return weekPeriod(day - mondayIndex(day));
    }
    case 'month':
      return monthPeriod(parts.year, parts.month);
    case 'quarter':
      return quarterPeriod(parts.year, Math.ceil(parts.month / 3));
    case 'year':
      return yearPeriod(parts.year);
  }
};

export const allTimePeriod = (bounds: DatasetBounds): Period => ({
  granularity: 'all',
  key: 'all',
  start: bounds.first,
  end: bounds.last,
  label: 'All time',
  shortLabel: 'All',
});

/** An arbitrary inclusive span, e.g. the months behind a health score. */
export const rangePeriod = (start: string, end: string, label: string): Period => ({
  granularity: 'range',
  key: `${start}..${end}`,
  start,
  end,
  label,
  shortLabel: label,
});

/** Move `delta` periods forward (positive) or back (negative). 'all'/'range' stay put. */
export const shiftPeriod = (period: Period, delta: number): Period => {
  if (delta === 0) return period;
  const start = parseISODate(period.start)!;
  switch (period.granularity) {
    case 'week':
      return weekPeriod(dayOf(period.start) + delta * 7);
    case 'month': {
      const index = start.year * 12 + (start.month - 1) + delta;
      return monthPeriod(Math.floor(index / 12), (index % 12) + 1);
    }
    case 'quarter': {
      const index = start.year * 4 + Math.floor((start.month - 1) / 3) + delta;
      return quarterPeriod(Math.floor(index / 4), (index % 4) + 1);
    }
    case 'year':
      return yearPeriod(start.year + delta);
    default:
      return period;
  }
};

export const isWithin = (iso: string, period: Period): boolean =>
  iso >= period.start && iso <= period.end;

export const periodDays = (period: Period): number =>
  daysBetweenInclusive(period.start, period.end);

/** Chronological periods of one granularity overlapping `[start, end]`. */
export const periodsBetween = (
  granularity: Exclude<Granularity, 'all'>,
  start: string,
  end: string
): Period[] => {
  const periods: Period[] = [];
  let current = periodContaining(granularity, start);
  // Hard stop keeps a corrupt range from looping forever (~27 years of weeks).
  for (let guard = 0; current.start <= end && guard < 1500; guard++) {
    periods.push(current);
    current = shiftPeriod(current, 1);
  }
  return periods;
};

export const periodCoverage = (period: Period, bounds: DatasetBounds | null): Coverage => {
  const totalDays = periodDays(period);
  const from = bounds ? maxISO(period.start, bounds.first) : null;
  const through = bounds ? minISO(period.end, bounds.last) : null;
  const coveredDays = from && through && from <= through ? daysBetweenInclusive(from, through) : 0;
  const ratio = totalDays > 0 ? coveredDays / totalDays : 0;
  const isInProgress = !!bounds && bounds.last >= period.start && bounds.last < period.end;
  return {
    totalDays,
    coveredDays,
    ratio,
    // A period the data stops inside is never complete, however far along it is.
    isComplete: ratio >= COMPLETE_COVERAGE && !isInProgress,
    isInProgress,
    startsMidPeriod: !!bounds && bounds.first > period.start && bounds.first <= period.end,
    from: coveredDays > 0 ? from : null,
    through: coveredDays > 0 ? through : null,
  };
};

/**
 * Calendar-month equivalents of an inclusive span: each month contributes the
 * share of its days that fall inside the span, so a complete month counts as
 * exactly 1 whatever its length.
 */
export const monthEquivalents = (from: string, through: string): number => {
  if (from > through) return 0;
  return periodsBetween('month', from, through).reduce((sum, month) => {
    const overlap = daysBetweenInclusive(maxISO(month.start, from), minISO(month.end, through));
    return sum + overlap / periodDays(month);
  }, 0);
};

/** Human label for a set of months: `May 2026`, `Mar – May 2026`, `Nov 2025 – Jan 2026`. */
export const monthsLabel = (months: Period[]): string => {
  if (months.length === 0) return '';
  const first = parseISODate(months[0].start)!;
  const last = parseISODate(months[months.length - 1].start)!;
  if (months.length === 1) return months[0].label;
  if (first.year === last.year)
    return `${MONTH_SHORT[first.month - 1]} – ${MONTH_SHORT[last.month - 1]} ${last.year}`;
  return `${MONTH_SHORT[first.month - 1]} ${first.year} – ${MONTH_SHORT[last.month - 1]} ${last.year}`;
};

/** The day a period selection should anchor on: its last day that has data. */
export const anchorFor = (period: Period, bounds: DatasetBounds | null): string =>
  bounds ? minISO(maxISO(period.end, bounds.first), bounds.last) : period.end;
