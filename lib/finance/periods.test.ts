import { describe, expect, it } from 'vitest';
import { addDays, daysInMonth, formatISODate, mondayIndex, toDayNumber } from './dates';
import {
  allTimePeriod,
  anchorFor,
  monthEquivalents,
  monthsLabel,
  periodContaining,
  periodCoverage,
  periodsBetween,
  shiftPeriod,
} from './periods';

describe('dates', () => {
  it('accepts only real YYYY-MM-DD dates', () => {
    expect(toDayNumber('1970-01-01')).toBe(0);
    expect(toDayNumber('2026-02-29')).toBeNull();
    expect(toDayNumber('2024-02-29')).not.toBeNull();
    expect(toDayNumber('03/27/2026')).toBeNull();
    expect(toDayNumber('')).toBeNull();
  });

  it('computes month lengths, weekdays and offsets in UTC', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(mondayIndex(toDayNumber('2026-05-04')!)).toBe(0); // Monday
    expect(mondayIndex(toDayNumber('2026-05-10')!)).toBe(6); // Sunday
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
  });

  it('formats the stored day without going through Date (no timezone shift)', () => {
    expect(formatISODate('2026-03-01')).toBe('Mar 1, 2026');
    expect(formatISODate('2026-03-01', 'monthDay')).toBe('Mar 1');
    expect(formatISODate('2026-03-01', 'monthYear')).toBe('Mar 2026');
    expect(formatISODate('03/01/2026')).toBe('03/01/2026');
  });
});

describe('periodContaining', () => {
  it('builds Monday–Sunday weeks, including across months and years', () => {
    const week = periodContaining('week', '2026-05-06');
    expect(week).toMatchObject({
      key: 'W2026-05-04',
      start: '2026-05-04',
      end: '2026-05-10',
      label: 'May 4 – 10, 2026',
      shortLabel: 'May 4',
    });
    expect(periodContaining('week', '2026-04-30').label).toBe('Apr 27 – May 3, 2026');
    expect(periodContaining('week', '2026-01-01').label).toBe('Dec 29, 2025 – Jan 4, 2026');
  });

  it('builds calendar months, quarters and years', () => {
    expect(periodContaining('month', '2026-02-15')).toMatchObject({
      key: '2026-02',
      start: '2026-02-01',
      end: '2026-02-28',
      label: 'February 2026',
    });
    expect(periodContaining('month', '2024-02-10').end).toBe('2024-02-29');
    expect(periodContaining('quarter', '2026-05-20')).toMatchObject({
      key: '2026-Q2',
      start: '2026-04-01',
      end: '2026-06-30',
      label: 'Q2 2026',
      shortLabel: 'Q2 ’26',
    });
    expect(periodContaining('year', '2026-05-20')).toMatchObject({
      start: '2026-01-01',
      end: '2026-12-31',
      label: '2026',
    });
  });
});

describe('shiftPeriod / periodsBetween', () => {
  it('steps across year boundaries', () => {
    expect(shiftPeriod(periodContaining('month', '2026-01-10'), -1).key).toBe('2025-12');
    expect(shiftPeriod(periodContaining('month', '2026-01-10'), 13).key).toBe('2027-02');
    expect(shiftPeriod(periodContaining('quarter', '2026-02-01'), -1).key).toBe('2025-Q4');
    expect(shiftPeriod(periodContaining('week', '2026-05-06'), -1).start).toBe('2026-04-27');
    expect(shiftPeriod(periodContaining('year', '2026-05-06'), 1).key).toBe('2027');
  });

  it('lists overlapping periods in order', () => {
    expect(periodsBetween('month', '2025-11-15', '2026-02-03').map((p) => p.key)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});

describe('periodCoverage', () => {
  const bounds = { first: '2026-01-03', last: '2026-05-20' };

  it('treats ≥ 90% covered periods as complete', () => {
    const january = periodCoverage(periodContaining('month', '2026-01-15'), bounds);
    expect(january).toMatchObject({
      coveredDays: 29,
      isComplete: true,
      startsMidPeriod: true,
      isInProgress: false,
      from: '2026-01-03',
    });
    const late = periodCoverage(periodContaining('month', '2026-01-15'), {
      first: '2026-01-05',
      last: '2026-05-20',
    });
    expect(late.isComplete).toBe(false);
  });

  it('flags the month the data stops in as in progress, never complete', () => {
    expect(periodCoverage(periodContaining('month', '2026-05-01'), bounds)).toMatchObject({
      coveredDays: 20,
      isComplete: false,
      isInProgress: true,
      through: '2026-05-20',
    });
    const almost = periodCoverage(periodContaining('month', '2026-04-01'), {
      first: '2026-01-01',
      last: '2026-04-29',
    });
    expect(almost).toMatchObject({ coveredDays: 29, isInProgress: true, isComplete: false });
  });

  it('reports no coverage outside the data', () => {
    expect(periodCoverage(periodContaining('month', '2026-06-01'), bounds)).toMatchObject({
      coveredDays: 0,
      isInProgress: false,
      from: null,
      through: null,
    });
  });
});

describe('month helpers', () => {
  it('counts calendar-month equivalents, a complete month being exactly 1', () => {
    expect(monthEquivalents('2026-02-01', '2026-02-28')).toBe(1);
    expect(monthEquivalents('2026-01-03', '2026-05-20')).toBeCloseTo(3 + 29 / 31 + 20 / 31, 10);
  });

  it('labels month sets compactly', () => {
    const month = (iso: string) => periodContaining('month', iso);
    expect(monthsLabel([month('2026-05-01')])).toBe('May 2026');
    expect(monthsLabel([month('2026-03-01'), month('2026-04-01'), month('2026-05-01')])).toBe(
      'Mar – May 2026'
    );
    expect(monthsLabel([month('2025-11-01'), month('2026-01-01')])).toBe('Nov 2025 – Jan 2026');
  });

  it('anchors a selection on its last day with data', () => {
    const bounds = { first: '2026-01-03', last: '2026-05-20' };
    expect(anchorFor(periodContaining('month', '2026-05-01'), bounds)).toBe('2026-05-20');
    expect(anchorFor(periodContaining('month', '2026-03-01'), bounds)).toBe('2026-03-31');
    expect(allTimePeriod(bounds)).toMatchObject({ start: '2026-01-03', end: '2026-05-20' });
  });
});
