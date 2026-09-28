// tsconfig types are limited to vite/client, so `process` isn't declared for
// tsc — declare the slice this file uses (process.env.TZ for the A8 zone test).
declare const process: { env: Record<string, string | undefined> };

import { afterEach, describe, expect, it } from 'vitest';
import {
  cn,
  formatCurrency,
  formatDate,
  isValidDate,
  safeNewDate,
  normalizeDate,
  todayLocalISO,
} from './utils';
import { useSettingsStore } from '../stores/useSettingsStore';

describe('cn', () => {
  it('merges conflicting tailwind classes, last one winning', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('drops falsy values', () => {
    expect(cn('text-sm', false && 'hidden', undefined, null)).toBe('text-sm');
  });
});

describe('formatCurrency', () => {
  afterEach(() => {
    useSettingsStore.getState().resetSettings();
  });

  it('formats positive and negative amounts as USD', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(-42)).toBe('-$42.00');
  });

  it('honours the currency argument and the settings default', () => {
    expect(formatCurrency(42, 'EUR')).toBe('€42.00');
    useSettingsStore.getState().setCurrency('JPY');
    expect(formatCurrency(42)).toBe('¥42');
  });

  it('falls back to USD when the currency code is invalid', () => {
    expect(formatCurrency(42, 'NOPE')).toBe('$42.00');
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

  // Bare YYYY-MM-DD strings are parsed as LOCAL dates, so they render the same
  // calendar day in every timezone (Phase A8). TZ is switched per-test.
  it('renders date-only strings on the correct day west of UTC', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(formatDate('2026-03-01')).toBe('Mar 1, 2026');
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it('keeps datetime strings on their instant', () => {
    expect(formatDate('2025-03-09T12:00:00Z')).toBe('Mar 9, 2025');
  });
});

describe('todayLocalISO', () => {
  it('returns local YYYY-MM-DD matching Date getters, not UTC', () => {
    const expected = (() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })();
    expect(todayLocalISO()).toBe(expected);
    expect(todayLocalISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

describe('normalizeDate', () => {
  it('passes ISO YYYY-MM-DD through unchanged', () => {
    expect(normalizeDate('2025-03-09')).toBe('2025-03-09');
    expect(normalizeDate('2026-12-31')).toBe('2026-12-31');
  });

  it('converts US MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(normalizeDate('03/09/2025')).toBe('2025-03-09');
    expect(normalizeDate('12/25/2026')).toBe('2026-12-25');
    expect(normalizeDate('01/01/2024')).toBe('2024-01-01');
  });

  it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
    // First number > 12 → unambiguously DD/MM
    expect(normalizeDate('25/12/2026')).toBe('2026-12-25');
    expect(normalizeDate('31/01/2024')).toBe('2024-01-31');
    // Both ≤ 12 → ambiguous; default MM/DD (US bank convention)
    expect(normalizeDate('09/03/2025')).toBe('2025-09-03');
    expect(normalizeDate('03/09/2025')).toBe('2025-03-09');
  });

  it('converts DD.MM.YYYY to YYYY-MM-DD', () => {
    expect(normalizeDate('09.03.2025')).toBe('2025-03-09');
    expect(normalizeDate('25.12.2026')).toBe('2026-12-25');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeDate('')).toBe('');
  });

  it('returns the raw string for unparseable input', () => {
    expect(normalizeDate('not-a-date')).toBe('not-a-date');
    expect(normalizeDate('garbage')).toBe('garbage');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeDate('  2025-03-09  ')).toBe('2025-03-09');
    expect(normalizeDate('  03/09/2025  ')).toBe('2025-03-09');
  });
});
