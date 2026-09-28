import { TransactionCategory } from '../../types';
import { round2 } from './format';
import {
  Ledger,
  LedgerEntry,
  SPENDING_BUCKETS,
  entriesBetween,
  fromCents,
  merchantLabel,
} from './ledger';
import { Coverage, Period, monthEquivalents, periodCoverage } from './periods';

/** Categorized, unapproved results below this confidence need the user's review. */
export const REVIEW_CONFIDENCE = 0.5;

/**
 * Money flows for a set of transactions. Spending buckets are net of refunds
 * (money back in a spending category reduces it); saving/investing are net of
 * withdrawals; internal transfers are excluded everywhere; uncategorized
 * money-out counts as spending until it is categorized, uncategorized
 * money-in is never treated as income.
 */
export interface FlowTotals {
  income: number;
  /** Must-have. */
  needs: number;
  /** Nice-to-have. */
  wants: number;
  waste: number;
  /** Uncategorized money out. */
  unclassified: number;
  /** needs + wants + waste + unclassified */
  spending: number;
  saving: number;
  investing: number;
  /** saving + investing */
  setAside: number;
  /** income − spending */
  netCashFlow: number;
  /** netCashFlow − setAside: surplus left in everyday accounts. */
  unallocated: number;
  /** Must-have › Housing (rent/mortgage, utilities, home running costs). */
  housing: number;
  /** Must-have › Debt Payments (scheduled loan instalments). */
  debtPayments: number;
}

/** Standard ratios; income-based ones are null when there is no income. */
export interface Ratios {
  /** netCashFlow ÷ income */
  savingsRate: number | null;
  /** setAside ÷ income */
  setAsideRate: number | null;
  /** needs ÷ income */
  needsRatio: number | null;
  /** (wants + waste) ÷ income */
  wantsRatio: number | null;
  /** unclassified ÷ income */
  unclassifiedRatio: number | null;
  /** housing ÷ income */
  housingRatio: number | null;
  /** debtPayments ÷ income */
  debtServiceRatio: number | null;
  /** waste ÷ spending (null without spending) */
  avoidableShare: number | null;
}

export interface BreakdownItem {
  /** `Must-have` for categories, `Must-have|Housing` for subcategories. */
  key: string;
  label: string;
  category: TransactionCategory;
  subCategory?: string;
  amount: number;
  /** Money-out transactions in the group. */
  count: number;
  /** Share of total spending, null without spending. */
  share: number | null;
}

export interface MerchantItem {
  key: string;
  label: string;
  amount: number;
  count: number;
  category: TransactionCategory;
}

export interface DataQuality {
  transactionCount: number;
  uncategorizedCount: number;
  uncategorizedOutflow: number;
  /** Uncategorized money out ÷ all money out except internal transfers. */
  uncategorizedShare: number;
  /** Categorized but unapproved with confidence below REVIEW_CONFIDENCE. */
  needsReviewCount: number;
  unverifiedCount: number;
}

export interface Aggregate {
  totals: FlowTotals;
  ratios: Ratios;
  /** Spending categories, largest first. */
  categories: BreakdownItem[];
  /** Spending subcategories, largest first. */
  subCategories: BreakdownItem[];
  /** Largest spending merchants. */
  merchants: MerchantItem[];
  quality: DataQuality;
}

export interface PeriodSummary extends Aggregate {
  period: Period;
  coverage: Coverage;
  /** Calendar-month equivalents covered by data (a complete month is 1). */
  months: number;
  avgDailySpending: number | null;
}

interface CentTotals {
  income: number;
  needs: number;
  wants: number;
  waste: number;
  unclassified: number;
  saving: number;
  investing: number;
  housing: number;
  debtPayments: number;
}

const emptyCents = (): CentTotals => ({
  income: 0,
  needs: 0,
  wants: 0,
  waste: 0,
  unclassified: 0,
  saving: 0,
  investing: 0,
  housing: 0,
  debtPayments: 0,
});

/** Signed spending contribution in cents: purchases add, refunds subtract. */
const spendingCents = (entry: LedgerEntry): number => {
  if (entry.bucket === 'unclassified') return entry.cents < 0 ? -entry.cents : 0;
  return -entry.cents;
};

const accumulate = (acc: CentTotals, entry: LedgerEntry): void => {
  switch (entry.bucket) {
    case 'income':
      acc.income += entry.cents;
      return;
    case 'needs':
      acc.needs -= entry.cents;
      if (entry.tx.subCategory === 'Housing') acc.housing -= entry.cents;
      if (entry.tx.subCategory === 'Debt Payments') acc.debtPayments -= entry.cents;
      return;
    case 'wants':
      acc.wants -= entry.cents;
      return;
    case 'waste':
      acc.waste -= entry.cents;
      return;
    case 'saving':
      acc.saving -= entry.cents;
      return;
    case 'investing':
      acc.investing -= entry.cents;
      return;
    case 'unclassified':
      acc.unclassified += spendingCents(entry);
      return;
    case 'transfer':
      return;
  }
};

const finalize = (c: CentTotals): FlowTotals => {
  const spending = c.needs + c.wants + c.waste + c.unclassified;
  const setAside = c.saving + c.investing;
  const net = c.income - spending;
  return {
    income: fromCents(c.income),
    needs: fromCents(c.needs),
    wants: fromCents(c.wants),
    waste: fromCents(c.waste),
    unclassified: fromCents(c.unclassified),
    spending: fromCents(spending),
    saving: fromCents(c.saving),
    investing: fromCents(c.investing),
    setAside: fromCents(setAside),
    netCashFlow: fromCents(net),
    unallocated: fromCents(net - setAside),
    housing: fromCents(c.housing),
    debtPayments: fromCents(c.debtPayments),
  };
};

/** Flow totals only — the cheap path when breakdowns aren't needed. */
export const totalsOf = (entries: LedgerEntry[]): FlowTotals => {
  const acc = emptyCents();
  for (const entry of entries) accumulate(acc, entry);
  return finalize(acc);
};

export const ratiosOf = (t: FlowTotals): Ratios => {
  const perIncome = (value: number): number | null => (t.income > 0 ? value / t.income : null);
  return {
    savingsRate: perIncome(t.netCashFlow),
    setAsideRate: perIncome(t.setAside),
    needsRatio: perIncome(t.needs),
    wantsRatio: perIncome(t.wants + t.waste),
    unclassifiedRatio: perIncome(t.unclassified),
    housingRatio: perIncome(t.housing),
    debtServiceRatio: perIncome(t.debtPayments),
    avoidableShare: t.spending > 0 ? t.waste / t.spending : null,
  };
};

/** Spending bucket → the category shown for it. */
const displayCategory = (entry: LedgerEntry): TransactionCategory =>
  entry.bucket === 'unclassified'
    ? TransactionCategory.Uncategorized
    : (entry.tx.category as TransactionCategory);

interface Group {
  cents: number;
  count: number;
  category: TransactionCategory;
  subCategory?: string;
  label: string;
}

interface MerchantGroup extends Group {
  votes: Map<TransactionCategory, number>;
}

const toItems = (groups: Map<string, Group>, spendingTotal: number): BreakdownItem[] =>
  Array.from(groups, ([key, g]) => ({
    key,
    label: g.label,
    category: g.category,
    subCategory: g.subCategory,
    amount: fromCents(g.cents),
    count: g.count,
    share: spendingTotal > 0 ? fromCents(g.cents) / spendingTotal : null,
  }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));

/** Most frequent category in a merchant group; ties resolve alphabetically. */
const topVote = (votes: Map<TransactionCategory, number>): TransactionCategory =>
  Array.from(votes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];

/** Full aggregation of a set of ledger entries. */
export const aggregate = (entries: LedgerEntry[], merchantLimit = 8): Aggregate => {
  const acc = emptyCents();
  const categories = new Map<string, Group>();
  const subCategories = new Map<string, Group>();
  const merchants = new Map<string, MerchantGroup>();
  let uncategorizedCount = 0;
  let uncategorizedOutflow = 0;
  let grossOutflow = 0;
  let needsReviewCount = 0;
  let unverifiedCount = 0;

  for (const entry of entries) {
    accumulate(acc, entry);
    const { tx } = entry;
    if (!tx.isApproved) unverifiedCount++;
    if (entry.bucket === 'unclassified') {
      uncategorizedCount++;
      if (entry.cents < 0) uncategorizedOutflow -= entry.cents;
    } else if (!tx.isApproved && tx.confidence < REVIEW_CONFIDENCE) {
      needsReviewCount++;
    }
    if (entry.cents < 0 && entry.bucket !== 'transfer') grossOutflow -= entry.cents;

    if (!SPENDING_BUCKETS.has(entry.bucket)) continue;
    const cents = spendingCents(entry);
    const isPurchase = entry.cents < 0 ? 1 : 0;
    const category = displayCategory(entry);
    const subCategory = entry.bucket === 'unclassified' ? undefined : tx.subCategory || undefined;

    const cat = categories.get(category) ?? { cents: 0, count: 0, category, label: category };
    cat.cents += cents;
    cat.count += isPurchase;
    categories.set(category, cat);

    const subKey = `${category}|${subCategory ?? ''}`;
    const sub = subCategories.get(subKey) ?? {
      cents: 0,
      count: 0,
      category,
      subCategory,
      label:
        subCategory ??
        (category === TransactionCategory.Uncategorized ? category : `${category} · General`),
    };
    sub.cents += cents;
    sub.count += isPurchase;
    subCategories.set(subKey, sub);

    const merchant = merchants.get(entry.merchant) ?? {
      cents: 0,
      count: 0,
      category,
      label: merchantLabel(entry.merchant),
      votes: new Map<TransactionCategory, number>(),
    };
    merchant.cents += cents;
    merchant.count += isPurchase;
    merchant.votes.set(category, (merchant.votes.get(category) ?? 0) + 1);
    merchants.set(entry.merchant, merchant);
  }

  const totals = finalize(acc);
  const merchantItems: MerchantItem[] = Array.from(merchants, ([key, g]) => ({
    key,
    label: g.label,
    amount: fromCents(g.cents),
    count: g.count,
    category: topVote(g.votes),
  }))
    .filter((m) => m.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
    .slice(0, merchantLimit);

  return {
    totals,
    ratios: ratiosOf(totals),
    categories: toItems(categories, totals.spending),
    subCategories: toItems(subCategories, totals.spending),
    merchants: merchantItems,
    quality: {
      transactionCount: entries.length,
      uncategorizedCount,
      uncategorizedOutflow: fromCents(uncategorizedOutflow),
      uncategorizedShare: grossOutflow > 0 ? uncategorizedOutflow / grossOutflow : 0,
      needsReviewCount,
      unverifiedCount,
    },
  };
};

export const summarizePeriod = (ledger: Ledger, period: Period): PeriodSummary => {
  const coverage = periodCoverage(period, ledger.bounds);
  const agg = aggregate(entriesBetween(ledger, period.start, period.end));
  const months =
    coverage.from && coverage.through ? monthEquivalents(coverage.from, coverage.through) : 0;
  return {
    ...agg,
    period,
    coverage,
    months,
    avgDailySpending:
      coverage.coveredDays > 0 ? round2(agg.totals.spending / coverage.coveredDays) : null,
  };
};

/** Divide by a month count, or null when there is no coverage. */
export const perMonth = (amount: number, months: number): number | null =>
  months > 0 ? round2(amount / months) : null;
