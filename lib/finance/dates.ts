/**
 * Date-only helpers for `YYYY-MM-DD` strings.
 *
 * Every calculation runs on UTC day numbers, so results never depend on the
 * viewer's timezone: a plain `new Date('2026-03-01')` is UTC midnight and
 * renders as Feb 28 anywhere west of UTC.
 */
export const MS_PER_DAY = 86_400_000;

/** Average Gregorian month length in days (365.2425 / 12). */
export const AVG_DAYS_PER_MONTH = 30.436875;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface DateParts {
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Parse a strict, valid `YYYY-MM-DD`; anything else is null. */
export const parseISODate = (iso: string): DateParts | null => {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
};

/** Days since 1970-01-01 for a valid `YYYY-MM-DD`, else null. */
export const toDayNumber = (iso: string): number | null => {
  const parts = parseISODate(iso);
  if (!parts) return null;
  return Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY;
};

/** Like `toDayNumber` but for dates the caller already validated. */
export const dayOf = (iso: string): number => {
  const day = toDayNumber(iso);
  if (day === null) throw new Error(`Invalid ISO date: ${iso}`);
  return day;
};

export const fromDayNumber = (dayNumber: number): string =>
  new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);

export const toISODate = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const addDays = (iso: string, days: number): string => fromDayNumber(dayOf(iso) + days);

/** Inclusive number of days from `start` to `end` (0 when end < start). */
export const daysBetweenInclusive = (start: string, end: string): number =>
  Math.max(0, dayOf(end) - dayOf(start) + 1);

/** Monday-based weekday index (Monday = 0 … Sunday = 6). 1970-01-01 was a Thursday. */
export const mondayIndex = (dayNumber: number): number => (((dayNumber + 3) % 7) + 7) % 7;

export const minISO = (a: string, b: string): string => (a <= b ? a : b);
export const maxISO = (a: string, b: string): string => (a >= b ? a : b);

/** `May 4, 2026` / `May 4` / `May 2026` — formatted in UTC so it matches the stored day. */
export const formatISODate = (
  iso: string,
  style: 'long' | 'monthDay' | 'monthYear' = 'long'
): string => {
  const parts = parseISODate(iso);
  if (!parts) return iso;
  const month = MONTH_SHORT[parts.month - 1];
  if (style === 'monthDay') return `${month} ${parts.day}`;
  if (style === 'monthYear') return `${month} ${parts.year}`;
  return `${month} ${parts.day}, ${parts.year}`;
};
