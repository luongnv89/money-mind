import { describe, expect, it } from 'vitest';
import { cn, formatCurrency, formatDate, isValidDate, safeNewDate } from './utils';

describe('cn', () => {
  it('merges conflicting tailwind classes, last one winning', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('drops falsy values', () => {
    expect(cn('text-sm', false && 'hidden', undefined, null)).toBe('text-sm');
  });
});

describe('formatCurrency', () => {
  it('formats positive and negative amounts as USD', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(-42)).toBe('-$42.00');
  });
});

describe('formatDate', () => {
  it('returns N/A for an empty string', () => {
    expect(formatDate('')).toBe('N/A');
  });

  it('echoes the input back when it is unparseable', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  // The suite is pinned to TZ=UTC (see vite.config.ts). In the browser this
  // function renders in the viewer's zone, so an ISO date can display as the
  // previous day west of UTC.
  it('formats an ISO date', () => {
    expect(formatDate('2025-03-09')).toBe('Mar 9, 2025');
  });
});

describe('isValidDate', () => {
  it('accepts real Dates and rejects everything else', () => {
    expect(isValidDate(new Date('2025-01-01'))).toBe(true);
    expect(isValidDate(new Date('nope'))).toBe(false);
    expect(isValidDate('2025-01-01')).toBe(false);
    expect(isValidDate(null)).toBe(false);
  });
});

describe('safeNewDate', () => {
  it('returns null for empty or invalid input instead of an Invalid Date', () => {
    expect(safeNewDate('')).toBeNull();
    expect(safeNewDate('garbage')).toBeNull();
  });

  it('parses a valid date string', () => {
    expect(safeNewDate('2025-03-09')?.getUTCFullYear()).toBe(2025);
  });
});
