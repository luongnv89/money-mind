import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSettingsStore } from '../stores/useSettingsStore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (
  amount: number,
  currency: string = useSettingsStore.getState().currency
) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch (e) {
    if (e instanceof RangeError) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    }
    throw e;
  }
};

/** Compact money for chart axes: `$1.2K`, `$340`, `$2M` (current currency). */
export const formatCompactCurrency = (
  amount: number,
  currency: string = useSettingsStore.getState().currency
) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  } catch (e) {
    if (e instanceof RangeError) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(amount);
    }
    throw e;
  }
};

/** Today's date as local `YYYY-MM-DD` (unlike `toISOString()`, never UTC-shifted). */
export const todayLocalISO = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  try {
    // A bare YYYY-MM-DD parses as UTC midnight, which formats as the previous
    // day west of UTC — parse it as a local date instead.
    const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
    const date = isoDay
      ? new Date(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]))
      : new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
};

export const isValidDate = (date: unknown): date is Date => {
  return date instanceof Date && !isNaN(date.getTime());
};

export const safeNewDate = (dateStr: string | number): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isValidDate(date) ? date : null;
};

/**
 * Normalize a transaction date string to `YYYY-MM-DD`.
 *
 * CSV parsers store the raw bank string (e.g. `03/27/2026`, `27/03/2026`,
 * `2026-03-27`, `27.03.2026`). Downstream consumers derive a `YYYY-MM` month
 * key by fixed-offset slicing against an ISO `toISOString()` value — for
 * `MM/DD/YYYY` input `startsWith('2026-03')` silently fails. Normalize once,
 * at the parser boundary, so every consumer sees `YYYY-MM-DD`.
 *
 * Unparseable input is returned as-is (the preview step surfaces a count
 * rather than silently dropping rows).
 */
export const normalizeDate = (raw: string): string => {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (isValidDate(d)) return trimmed;
  }

  // DD.MM.YYYY — unambiguous dot-separated format
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const day = parseInt(dotMatch[1], 10);
    const month = parseInt(dotMatch[2], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${dotMatch[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return raw;
  }

  // Slash-separated: MM/DD/YYYY or DD/MM/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, a, b, year] = slashMatch;
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    let month: number, day: number;
    if (numA > 12) {
      // First number can't be a month → DD/MM/YYYY
      month = numB;
      day = numA;
    } else if (numB > 12) {
      // Second number can't be a month → MM/DD/YYYY
      month = numA;
      day = numB;
    } else {
      // Ambiguous (≤12 both) — default to MM/DD/YYYY (US bank convention)
      month = numA;
      day = numB;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return raw;
  }

  // Fallback: rely on Date.parse for ISO-ish and other formats
  const parsed = safeNewDate(trimmed);
  if (!parsed) return raw; // unparseable — surface in preview, don't drop

  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
