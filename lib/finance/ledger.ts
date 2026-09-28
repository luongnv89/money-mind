import { Transaction, TransactionCategory } from '../../types';
import { toDayNumber } from './dates';
import type { DatasetBounds } from './periods';

/**
 * How a transaction counts in the analysis. Categories map 1:1, except that
 * any unknown category string (legacy data, bad AI output) is 'unclassified'.
 */
export type Bucket =
  'income' | 'needs' | 'wants' | 'waste' | 'saving' | 'investing' | 'transfer' | 'unclassified';

const BUCKET_BY_CATEGORY: Record<string, Bucket> = {
  [TransactionCategory.Income]: 'income',
  [TransactionCategory.MustHave]: 'needs',
  [TransactionCategory.NiceToHave]: 'wants',
  [TransactionCategory.Waste]: 'waste',
  [TransactionCategory.Save]: 'saving',
  [TransactionCategory.Invest]: 'investing',
  [TransactionCategory.InternalTransfer]: 'transfer',
  [TransactionCategory.Uncategorized]: 'unclassified',
};

export const bucketOf = (category: string): Bucket =>
  BUCKET_BY_CATEGORY[category] ?? 'unclassified';

/** Buckets whose money-out counts as spending. */
export const SPENDING_BUCKETS: ReadonlySet<Bucket> = new Set([
  'needs',
  'wants',
  'waste',
  'unclassified',
]);

/** Bank noise that never identifies a merchant. */
const NOISE_TOKENS = new Set([
  'ACH',
  'AUTHORIZED',
  'AUTOPAY',
  'BILL',
  'CARD',
  'CCD',
  'CHECKCARD',
  'CO',
  'COM',
  'CORP',
  'CREDIT',
  'DEBIT',
  'DES',
  'FROM',
  'ID',
  'INC',
  'INDN',
  'LLC',
  'LTD',
  'MASTERCARD',
  'NET',
  'NO',
  'ON',
  'ONLINE',
  'ORG',
  'PAYMENT',
  'PAYPAL',
  'PMT',
  'POS',
  'PPD',
  'PURCHASE',
  'RECURRING',
  'REF',
  'SQ',
  'THE',
  'TO',
  'TRANSACTION',
  'TST',
  'US',
  'USA',
  'VISA',
  'WEB',
  'WWW',
]);

/**
 * Stable merchant identity for grouping: letters only, bank noise removed,
 * first three meaningful words. `NETFLIX.COM` → `NETFLIX`,
 * `STARBUCKS STORE 12342` → `STARBUCKS STORE`, `UBER TRIP` ≠ `UBER EATS`.
 */
export const merchantKey = (description: string): string => {
  const words = description
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim()
    .split(' ');
  const meaningful = words.filter((w) => w.length >= 2 && !NOISE_TOKENS.has(w));
  if (meaningful.length > 0) return meaningful.slice(0, 3).join(' ');
  const fallback = words.filter((w) => w.length > 0).join(' ');
  return fallback || description.trim().toUpperCase() || 'UNKNOWN';
};

/** Short all-consonant tokens are acronyms: `PG`, `CVS`. */
const isAcronym = (word: string): boolean =>
  word.length <= 3 && /^[A-Z]+$/.test(word) && !/[AEIOU]/.test(word);

/** `LANDLORD RENT` → `Landlord Rent`; `CVS PHARMACY` → `CVS Pharmacy`. */
export const merchantLabel = (key: string): string =>
  key
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (isAcronym(w) ? w : w[0] + w.slice(1).toLowerCase()))
    .join(' ');

export interface LedgerEntry {
  tx: Transaction;
  /** Validated `YYYY-MM-DD`. */
  date: string;
  day: number;
  bucket: Bucket;
  merchant: string;
  /** Signed amount in integer cents, so sums never drift. */
  cents: number;
}

export interface Ledger {
  /** Valid-dated transactions sorted by date (stable for equal dates). */
  entries: LedgerEntry[];
  /** Transactions whose date isn't a valid `YYYY-MM-DD`; excluded from all metrics. */
  undated: Transaction[];
  bounds: DatasetBounds | null;
}

export const toCents = (amount: number): number =>
  Number.isFinite(amount) ? Math.round(amount * 100) : 0;

export const fromCents = (cents: number): number => cents / 100;

/** Index transactions once; every metric reads from this. */
export const buildLedger = (transactions: Transaction[]): Ledger => {
  const entries: LedgerEntry[] = [];
  const undated: Transaction[] = [];

  for (const tx of transactions) {
    const day = toDayNumber(tx.date);
    if (day === null) {
      undated.push(tx);
      continue;
    }
    entries.push({
      tx,
      date: tx.date,
      day,
      bucket: bucketOf(tx.category),
      merchant: merchantKey(tx.description ?? ''),
      cents: toCents(tx.amount),
    });
  }

  entries.sort((a, b) => a.day - b.day);
  const bounds =
    entries.length > 0 ? { first: entries[0].date, last: entries[entries.length - 1].date } : null;
  return { entries, undated, bounds };
};

/** First index whose day is ≥ `day` (entries are sorted by day). */
const lowerBound = (entries: LedgerEntry[], day: number): number => {
  let lo = 0;
  let hi = entries.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (entries[mid].day < day) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/** Entries dated within `[start, end]` inclusive, via binary search. */
export const entriesBetween = (ledger: Ledger, start: string, end: string): LedgerEntry[] => {
  const startDay = toDayNumber(start);
  const endDay = toDayNumber(end);
  if (startDay === null || endDay === null || endDay < startDay) return [];
  return ledger.entries.slice(
    lowerBound(ledger.entries, startDay),
    lowerBound(ledger.entries, endDay + 1)
  );
};
