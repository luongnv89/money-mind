import { TransactionCategory } from '../../types';
import { fromDayNumber, toDayNumber } from './dates';
import { round2 } from './format';
import { Ledger, LedgerEntry, SPENDING_BUCKETS, merchantLabel } from './ledger';

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

interface CadenceRule {
  cadence: Cadence;
  /** Accepted gap between charges, in days. */
  minDays: number;
  maxDays: number;
  nominalDays: number;
  /** Charges per month, for the monthly equivalent. */
  perMonth: number;
  minOccurrences: number;
  /** Max coefficient of variation of the charged amounts. */
  maxAmountCv: number;
}

/**
 * A merchant is recurring when its money-out charges repeat at a steady gap
 * with a steady amount. Weekly habits (the same grocery store) need tighter
 * amounts than monthly bills, whose amounts (utilities) naturally vary.
 */
const CADENCES: readonly CadenceRule[] = [
  {
    cadence: 'weekly',
    minDays: 6,
    maxDays: 8,
    nominalDays: 7,
    perMonth: 52 / 12,
    minOccurrences: 4,
    maxAmountCv: 0.15,
  },
  {
    cadence: 'biweekly',
    minDays: 13,
    maxDays: 16,
    nominalDays: 14,
    perMonth: 26 / 12,
    minOccurrences: 3,
    maxAmountCv: 0.15,
  },
  {
    cadence: 'monthly',
    minDays: 26,
    maxDays: 34,
    nominalDays: 30.44,
    perMonth: 1,
    minOccurrences: 3,
    maxAmountCv: 0.25,
  },
  {
    cadence: 'quarterly',
    minDays: 85,
    maxDays: 97,
    nominalDays: 91.31,
    perMonth: 1 / 3,
    minOccurrences: 2,
    maxAmountCv: 0.1,
  },
  {
    cadence: 'yearly',
    minDays: 350,
    maxDays: 380,
    nominalDays: 365.25,
    perMonth: 1 / 12,
    minOccurrences: 2,
    maxAmountCv: 0.1,
  },
];

/** Share of gaps that must fall inside the cadence window. */
const MIN_REGULAR_SHARE = 0.75;
/** Regular visits (the weekly shop, a favourite café) aren't commitments you signed up for. */
const NON_COMMITMENT_SUBCATEGORIES: ReadonlySet<string> = new Set([
  'Food & Groceries',
  'Dining Out',
]);
/** A charge is still active if the last one is within this many cycles of the data's end. */
const ACTIVE_CYCLES = 1.5;

export interface RecurringCharge {
  key: string;
  merchant: string;
  cadence: Cadence;
  /** Distinct charge dates. */
  occurrences: number;
  /** Most recent charge, used as the current price. */
  lastAmount: number;
  averageAmount: number;
  monthlyEquivalent: number;
  annualCost: number;
  firstDate: string;
  lastDate: string;
  nextExpected: string;
  category: TransactionCategory;
  subCategory?: string;
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const coefficientOfVariation = (values: number[]): number => {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return Infinity;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
};

/** Most frequent (category, subCategory); ties go to the most recent charge. */
const dominantCategory = (
  entries: LedgerEntry[]
): { category: TransactionCategory; subCategory?: string } => {
  const counts = new Map<string, number>();
  let best = { key: '', count: 0 };
  for (const entry of entries) {
    const category =
      entry.bucket === 'unclassified'
        ? TransactionCategory.Uncategorized
        : (entry.tx.category as TransactionCategory);
    const key = `${category}|${entry.tx.subCategory ?? ''}`;
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (count >= best.count) best = { key, count };
  }
  const [category, subCategory] = best.key.split('|');
  return { category: category as TransactionCategory, subCategory: subCategory || undefined };
};

const detectForGroup = (
  key: string,
  entries: LedgerEntry[],
  asOfDay: number
): RecurringCharge | null => {
  // Several charges on one day (e.g. two profiles) are one billing event.
  const byDay = new Map<number, number>();
  for (const entry of entries) byDay.set(entry.day, (byDay.get(entry.day) ?? 0) - entry.cents);
  const days = Array.from(byDay.keys()).sort((a, b) => a - b);
  if (days.length < 2) return null;

  const gaps = days.slice(1).map((day, i) => day - days[i]);
  const typicalGap = median(gaps);
  const rule = CADENCES.find((c) => typicalGap >= c.minDays && typicalGap <= c.maxDays);
  if (!rule || days.length < rule.minOccurrences) return null;

  const regular = gaps.filter((gap) => gap >= rule.minDays && gap <= rule.maxDays).length;
  if (regular / gaps.length < MIN_REGULAR_SHARE) return null;

  const amounts = days.map((day) => byDay.get(day)! / 100);
  if (amounts.some((a) => a <= 0) || coefficientOfVariation(amounts) > rule.maxAmountCv)
    return null;

  const lastDay = days[days.length - 1];
  if (asOfDay - lastDay > rule.nominalDays * ACTIVE_CYCLES) return null;

  const lastAmount = amounts[amounts.length - 1];
  const monthlyEquivalent = round2(lastAmount * rule.perMonth);
  return {
    key,
    merchant: merchantLabel(key),
    cadence: rule.cadence,
    occurrences: days.length,
    lastAmount: round2(lastAmount),
    averageAmount: round2(amounts.reduce((s, a) => s + a, 0) / amounts.length),
    monthlyEquivalent,
    annualCost: round2(monthlyEquivalent * 12),
    firstDate: fromDayNumber(days[0]),
    lastDate: fromDayNumber(lastDay),
    nextExpected: fromDayNumber(lastDay + Math.round(typicalGap)),
    ...dominantCategory(entries),
  };
};

/**
 * Recurring spending (subscriptions, bills, memberships) detected from the
 * whole history, active as of `asOf` (default: the last transaction date).
 * Largest monthly cost first.
 */
export const detectRecurring = (ledger: Ledger, asOf?: string): RecurringCharge[] => {
  const asOfDay = toDayNumber(asOf ?? ledger.bounds?.last ?? '');
  if (asOfDay === null) return [];

  const groups = new Map<string, LedgerEntry[]>();
  for (const entry of ledger.entries) {
    if (entry.day > asOfDay || entry.cents >= 0 || !SPENDING_BUCKETS.has(entry.bucket)) continue;
    if (entry.tx.subCategory && NON_COMMITMENT_SUBCATEGORIES.has(entry.tx.subCategory)) continue;
    const group = groups.get(entry.merchant);
    if (group) group.push(entry);
    else groups.set(entry.merchant, [entry]);
  }

  const charges: RecurringCharge[] = [];
  for (const [key, entries] of groups) {
    const charge = detectForGroup(key, entries, asOfDay);
    if (charge) charges.push(charge);
  }
  return charges.sort(
    (a, b) => b.monthlyEquivalent - a.monthlyEquivalent || a.merchant.localeCompare(b.merchant)
  );
};

export interface RecurringTotals {
  count: number;
  monthly: number;
  annual: number;
}

export const totalRecurring = (charges: RecurringCharge[]): RecurringTotals => {
  const monthly = round2(charges.reduce((s, c) => s + c.monthlyEquivalent, 0));
  return { count: charges.length, monthly, annual: round2(monthly * 12) };
};
