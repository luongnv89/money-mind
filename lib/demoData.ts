import { Transaction, TransactionCategory } from '../types';
import { daysInMonth } from './finance';

/** Format a Date as local `YYYY-MM-DD` — never via `toISOString()` (UTC shift). */
const localISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Deterministic PRNG (mulberry32) so the demo dataset is identical for a
 * given `today`: same seed, same consumption order, same rows.
 */
const mulberry32 = (seed: number) => {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Maps a bank-style `originalCategory` label to the app's hierarchy. Used to
 * pre-categorize demo rows AND by the demo simulator in aiService, so both
 * paths agree. Returns null for deliberately unmapped labels (e.g. checks).
 */
export const demoCategoryFor = (
  originalCategory: string | undefined
): [TransactionCategory, string?] | null => {
  const key = (originalCategory ?? '').trim().toLowerCase();
  switch (key) {
    case 'payroll':
      return [TransactionCategory.Income, 'Salary'];
    case 'freelance':
      return [TransactionCategory.Income, 'Freelance & Consulting'];
    case 'refund':
      return [TransactionCategory.NiceToHave, 'Shopping'];
    case 'rent':
    case 'utilities':
    case 'internet':
      return [TransactionCategory.MustHave, 'Housing'];
    case 'phone':
      return [TransactionCategory.MustHave];
    case 'insurance':
      return [TransactionCategory.MustHave, 'Insurance'];
    case 'auto loan':
      return [TransactionCategory.MustHave, 'Debt Payments'];
    case 'groceries':
      return [TransactionCategory.MustHave, 'Food & Groceries'];
    case 'gas':
      return [TransactionCategory.MustHave, 'Transportation'];
    case 'savings':
      return [TransactionCategory.Save, 'Emergency Fund'];
    case 'investment':
      return [TransactionCategory.Invest, 'Stock Market'];
    case 'card payment':
      return [TransactionCategory.InternalTransfer, 'Credit Card Payment'];
    case 'subscription':
      return [TransactionCategory.NiceToHave, 'Entertainment'];
    case 'gym':
      return [TransactionCategory.NiceToHave, 'Fitness & Sports'];
    case 'dining':
    case 'coffee':
      return [TransactionCategory.NiceToHave, 'Dining Out'];
    case 'shopping':
      return [TransactionCategory.NiceToHave, 'Shopping'];
    case 'travel':
      return [TransactionCategory.NiceToHave, 'Travel & Leisure'];
    case 'electronics':
      return [TransactionCategory.NiceToHave, 'Technology'];
    case 'fees':
      return [TransactionCategory.Waste, 'Late Fees & Penalties'];
    default:
      return null;
  }
};

const GROCERY_STORES: { name: string; lo: number; hi: number }[] = [
  { name: "TRADER JOE'S", lo: 70, hi: 150 },
  { name: 'WHOLE FOODS MARKET', lo: 70, hi: 150 },
  { name: 'SAFEWAY', lo: 70, hi: 150 },
  { name: 'COSTCO WHOLESALE', lo: 160, hi: 230 },
];

const DINING_MERCHANTS = ['CHIPOTLE', 'SWEETGREEN', 'UBER EATS', 'LOCAL BISTRO', 'SHAKE SHACK'];
const COFFEE_MERCHANTS = ['BLUE BOTTLE COFFEE', 'STARBUCKS'];

/**
 * A realistic, deterministic demo dataset: the three complete calendar
 * months before `today` plus the current month to date. Generated with a
 * seeded PRNG and local dates, so it never lands in the future and looks the
 * same for a given day. Everything except the check is pre-categorized via
 * `demoCategoryFor` so the Overview is meaningful immediately.
 */
export const getDemoTransactions = (today: Date = new Date()): Transaction[] => {
  const rand = mulberry32(0x9e3779b9);
  const money = (lo: number, hi: number) => round2(lo + rand() * (hi - lo));
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];

  const transactions: Transaction[] = [];
  let seq = 0;

  const emit = (
    y: number,
    m: number,
    d: number,
    description: string,
    amount: number,
    originalCategory: string
  ) => {
    const mapped = demoCategoryFor(originalCategory);
    transactions.push({
      id: `demo-${String(++seq).padStart(4, '0')}`,
      date: localISO(new Date(y, m - 1, d)),
      description,
      amount: round2(amount),
      category: mapped ? mapped[0] : TransactionCategory.Uncategorized,
      subCategory: mapped?.[1],
      originalCategory,
      confidence: mapped ? 0.85 : 0,
      isLearned: false,
      isApproved: false,
      reason: 'Demo data',
      raw: {},
    });
  };

  // Month index 0–2: the three full months before this one; 3: current month.
  for (let monthIndex = 0; monthIndex <= 3; monthIndex++) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - 3 + monthIndex, 1);
    const y = monthStart.getFullYear();
    const m = monthStart.getMonth() + 1;
    const isCurrent = monthIndex === 3;
    const lastDay = isCurrent ? today.getDate() : daysInMonth(y, m);
    const on = (day: number) => day <= lastDay;

    // NOTE: amounts consume the PRNG even when the row is skipped for the
    // current month, keeping earlier-month rows identical across `today`s in
    // the same month.
    const add = (day: number, description: string, amount: number, originalCategory: string) => {
      if (day >= 1 && on(day)) emit(y, m, day, description, amount, originalCategory);
    };

    // Income
    add(1, 'ACME CORP PAYROLL', 2450.0, 'Payroll');
    add(15, 'ACME CORP PAYROLL', 2450.0, 'Payroll');

    // Needs
    add(1, 'OAKWOOD APARTMENTS', -1650.0, 'Rent');
    add(12, 'PG&E ELECTRIC', -money(62, 108), 'Utilities');
    add(15, 'COMCAST XFINITY', -70.0, 'Internet');
    add(18, 'VERIZON WIRELESS', -85.0, 'Phone');
    add(5, 'GEICO AUTO INSURANCE', -128.4, 'Insurance');
    add(20, 'TOYOTA FINANCIAL SVCS', -365.0, 'Auto Loan');
    for (let d = 1; d <= daysInMonth(y, m); d++) {
      if (new Date(y, m - 1, d).getDay() !== 6) continue; // groceries every Saturday
      const store = GROCERY_STORES[((d / 7) | 0) % GROCERY_STORES.length];
      const amount = -money(store.lo, store.hi);
      add(d, store.name, amount, 'Groceries');
    }
    for (let d = 4; d <= daysInMonth(y, m); d += 9) {
      add(d, 'SHELL OIL', -money(42, 58), 'Gas');
    }

    // Set aside
    add(2, 'TRANSFER TO SAVINGS', -300.0, 'Savings');
    add(3, 'VANGUARD BROKERAGE', -200.0, 'Investment');

    // Internal transfer
    add(25, 'CHASE CARD AUTOPAY', -money(900, 1300), 'Card Payment');

    // Lifestyle — subscriptions and memberships
    add(7, 'NETFLIX.COM', -15.49, 'Subscription');
    add(9, 'HULU', -17.99, 'Subscription');
    add(10, 'SPOTIFY USA', -11.99, 'Subscription');
    add(22, 'OPENAI *CHATGPT', -20.0, 'Subscription');
    add(3, 'EQUINOX FITNESS', -45.0, 'Gym');

    // Lifestyle — dining, coffee, shopping (counts are seeded per month)
    const diningCount = int(10, 14);
    for (let i = 0; i < diningCount; i++) {
      add(int(1, lastDay), pick(DINING_MERCHANTS), -money(14, 68), 'Dining');
    }
    const coffeeCount = int(10, 14);
    for (let i = 0; i < coffeeCount; i++) {
      add(int(1, lastDay), pick(COFFEE_MERCHANTS), -money(5, 8), 'Coffee');
    }
    const amazonCount = int(3, 5);
    for (let i = 0; i < amazonCount; i++) {
      add(int(1, lastDay), 'AMAZON.COM', -money(18, 140), 'Shopping');
    }
    add(int(1, lastDay), 'TARGET', -money(40, 110), 'Shopping');

    // One-off items per month
    if (monthIndex === 1) {
      add(8, 'DELTA AIR LINES', -642.3, 'Travel');
      add(14, 'MARRIOTT HOTELS', -528.0, 'Travel');
      add(21, 'LATE PAYMENT FEE', -35.0, 'Fees');
    }
    if (monthIndex === 2) {
      add(19, 'UPWORK ESCROW', 600.0, 'Freelance');
      add(23, 'AMAZON.COM REFUND', 42.99, 'Refund');
      // Deliberately unmapped bank label — stays Uncategorized so the demo
      // shows a pending item to categorize.
      add(11, 'CHECK 1043', -250.0, 'Check');
    }
    if (isCurrent) {
      add(Math.min(6, today.getDate()), 'BEST BUY', -429.99, 'Electronics');
    }
  }

  return transactions.sort((a, b) => a.date.localeCompare(b.date));
};
