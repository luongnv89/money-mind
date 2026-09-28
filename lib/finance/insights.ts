import { TransactionCategory } from '../../types';
import { Baseline, compare } from './baseline';
import { formatISODate } from './dates';
import type { MetricId } from './definitions';
import { MoneyFormatter, formatPercent, joinList, pluralize, round2 } from './format';
import { RecurringCharge, totalRecurring } from './recurring';
import { BENCHMARKS, HealthScore, emergencyFundTarget } from './score';
import { Aggregate, BreakdownItem, PeriodSummary } from './summary';

export type InsightSeverity = 'critical' | 'warning' | 'opportunity' | 'info' | 'positive';
export type InsightAction = 'categorize' | 'review-transactions' | 'review-recurring';

/**
 * Money at stake. Figures from full months (or averages over several) are per
 * month; a week or a month still in progress reports what happened in the
 * period itself — it is never extrapolated.
 */
export interface Impact {
  amount: number;
  per: 'month' | 'period';
}

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  impact: Impact | null;
  /** Metric to explain alongside the insight. */
  metric: MetricId | null;
  action: InsightAction | null;
}

export interface InsightInput {
  /** The selected period. */
  summary: PeriodSummary;
  baseline: Baseline | null;
  /** Its window (recent complete months) drives the structural, ratio-based advice. */
  score: HealthScore;
  recurring: RecurringCharge[];
  /** Spending without recurring commitments; weekly comparisons use it. */
  dayToDay?: DayToDay | null;
  format: MoneyFormatter;
}

/** Day-to-day spending (everything except recurring bills and subscriptions). */
export interface DayToDay {
  current: Aggregate;
  baseline: Baseline | null;
}

const UNCATEGORIZED_WARN = 0.05;
const UNCATEGORIZED_CRITICAL = 0.25;
const SAVINGS_TARGET = BENCHMARKS.savingsRate.good;
const SAVINGS_LOW = BENCHMARKS.savingsRate.fair;
const WANTS_TARGET = BENCHMARKS.wantsRatio.good;
const WANTS_HIGH = BENCHMARKS.wantsRatio.fair;
const NEEDS_TARGET = BENCHMARKS.needsRatio.good;
const NEEDS_HIGH = BENCHMARKS.needsRatio.fair;
const HOUSING_TARGET = BENCHMARKS.housingRatio.good;
const DEBT_TARGET = BENCHMARKS.debtServiceRatio.good;
const DEBT_HIGH = BENCHMARKS.debtServiceRatio.fair;
const WASTE_HIGH_SHARE = BENCHMARKS.avoidableCosts.fair;
const SPENDING_UP = 0.15;
const SPENDING_DOWN = 0.1;
/** A subcategory spike must rise ≥ 25% and by ≥ 2% of baseline total spending. */
const SPIKE_RELATIVE = 0.25;
const SPIKE_MIN_SHARE = 0.02;
/** A subcategory absent from the baseline is flagged at ≥ 5% of baseline spending. */
const SPIKE_NEW_SHARE = 0.05;

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  opportunity: 2,
  info: 3,
  positive: 4,
};

const insight = (
  fields: Omit<Insight, 'impact' | 'metric' | 'action'> & Partial<Insight>
): Insight => ({ impact: null, metric: null, action: null, ...fields });

const monthlyImpact = (amount: number): Impact => ({ amount: round2(amount), per: 'month' });

/** Per month for a full month or longer; otherwise the period's own amount. */
const periodImpact = (amount: number, summary: PeriodSummary): Impact =>
  summary.months >= 1
    ? { amount: round2(amount / summary.months), per: 'month' }
    : { amount: round2(amount), per: 'period' };

const isLifestyle = (item: BreakdownItem): boolean =>
  item.category === TransactionCategory.NiceToHave || item.category === TransactionCategory.Waste;

const topLifestyle = (items: BreakdownItem[], count: number): BreakdownItem[] =>
  items.filter(isLifestyle).slice(0, count);

const dataQuality = ({ summary }: InsightInput): Insight[] => {
  const q = summary.quality;
  if (q.uncategorizedCount === 0 || q.uncategorizedShare < UNCATEGORIZED_WARN) return [];
  return [
    insight({
      id: 'data-quality',
      severity: q.uncategorizedShare >= UNCATEGORIZED_CRITICAL ? 'critical' : 'warning',
      title: `Categorize ${pluralize(q.uncategorizedCount, 'transaction')}`,
      detail: `${formatPercent(q.uncategorizedShare)} of money out in ${summary.period.label} isn't categorized yet, so the figures here may be off.`,
      action: 'categorize',
    }),
  ];
};

const cashFlow = ({ summary, format: fmt }: InsightInput): Insight[] => {
  // A single week says little about cash flow: pay arrives monthly or
  // fortnightly. Income and savings are judged over months instead.
  if (summary.period.granularity === 'week') return [];
  const t = summary.totals;
  const { label } = summary.period;
  const inProgress = summary.coverage.isInProgress;

  if (t.income <= 0) {
    if (t.spending <= 0) return [];
    return [
      insight({
        id: 'no-income',
        severity: 'info',
        title: `No income recorded in ${label}`,
        detail: inProgress
          ? 'Your pay may not have arrived yet. Savings figures appear once income is recorded; if it lands in another account, import that statement too.'
          : 'Savings figures need income. If your pay lands in another account, import that statement too, or categorize the deposits as Income.',
        metric: 'income',
      }),
    ];
  }
  if (t.netCashFlow >= 0) return [];

  const overspend = -t.netCashFlow;
  const top = topLifestyle(summary.subCategories, 2);
  const largest = top.length
    ? ` Your largest lifestyle costs were ${joinList(top.map((i) => `${i.label} (${fmt(i.amount)})`))}.`
    : '';
  return [
    insight({
      id: 'cash-flow-negative',
      severity: inProgress ? 'warning' : 'critical',
      title: inProgress
        ? `Spending is ${fmt(overspend)} ahead of income so far`
        : `You spent ${fmt(overspend)} more than you earned`,
      detail: inProgress
        ? `Spending was ${fmt(t.spending)} against ${fmt(t.income)} of income through ${summary.coverage.through ? formatISODate(summary.coverage.through) : label}. If pay is still to come this period, it may even out.${largest}`
        : `Spending was ${fmt(t.spending)} against ${fmt(t.income)} of income in ${label}.${largest}`,
      impact: periodImpact(overspend, summary),
      metric: 'netCashFlow',
      action: 'review-transactions',
    }),
  ];
};

/** Ratio-based advice on the score window, expressed per month. */
const structural = (input: InsightInput, fired: Set<string>): Insight[] => {
  const { score, summary, format: fmt } = input;
  const w = score.window;
  const r = w.ratios;
  if (r.savingsRate === null || w.months <= 0) return [];
  const monthly = (value: number): number => round2(value / w.months);
  const income = w.totals.income;
  const out: Insight[] = [];

  if (r.savingsRate < 0) {
    const sameAsPeriod = w.periods.length === 1 && w.periods[0].key === summary.period.key;
    if (!(fired.has('cash-flow-negative') && sameAsPeriod)) {
      const gap = monthly(-w.totals.netCashFlow);
      out.push(
        insight({
          id: 'window-overspending',
          severity: 'critical',
          title: `Spending exceeded income over ${w.label}`,
          detail: `On average you spent ${fmt(gap)} a month more than you earned; savings or credit covered the difference.`,
          impact: monthlyImpact(gap),
          metric: 'savingsRate',
          action: 'review-transactions',
        })
      );
    }
  } else if (r.savingsRate < SAVINGS_TARGET) {
    const gap = monthly(SAVINGS_TARGET * income - w.totals.netCashFlow);
    const top = topLifestyle(w.subCategories, 2);
    out.push(
      insight({
        id: 'savings-rate',
        severity: r.savingsRate < SAVINGS_LOW ? 'warning' : 'opportunity',
        title: `Free up ${fmt(gap)} a month to reach a 20% savings rate`,
        detail:
          `Over ${w.label} you kept ${formatPercent(r.savingsRate)} of your income.` +
          (top.length
            ? ` Your biggest lifestyle costs are ${joinList(top.map((i) => `${i.label} (${fmt(monthly(i.amount))} a month)`))}.`
            : '') +
          ' The 50/30/20 guideline suggests saving 20%.',
        impact: monthlyImpact(gap),
        metric: 'savingsRate',
      })
    );
  }

  if (r.wantsRatio !== null && r.wantsRatio > WANTS_TARGET) {
    const gap = monthly((r.wantsRatio - WANTS_TARGET) * income);
    const top = topLifestyle(w.subCategories, 3);
    out.push(
      insight({
        id: 'wants-high',
        severity: r.wantsRatio > WANTS_HIGH ? 'warning' : 'opportunity',
        title: `Lifestyle spending is ${formatPercent(r.wantsRatio)} of income`,
        detail:
          `The 50/30/20 guideline is 30%; getting back to it frees ${fmt(gap)} a month.` +
          (top.length
            ? ` Biggest items: ${joinList(top.map((i) => `${i.label} (${fmt(monthly(i.amount))} a month)`))}.`
            : ''),
        impact: monthlyImpact(gap),
        metric: 'wantsRatio',
        action: 'review-transactions',
      })
    );
  }

  if (r.needsRatio !== null && r.needsRatio > NEEDS_TARGET) {
    const gap = monthly((r.needsRatio - NEEDS_TARGET) * income);
    out.push(
      insight({
        id: 'needs-high',
        severity: r.needsRatio > NEEDS_HIGH ? 'warning' : 'opportunity',
        title: `Essentials take ${formatPercent(r.needsRatio)} of income`,
        detail: `The guideline is about 50%, so essentials run ${fmt(gap)} a month above it. Insurance, phone, internet and energy plans are usually the easiest to renegotiate or switch.`,
        impact: monthlyImpact(gap),
        metric: 'needsRatio',
      })
    );
  }

  if (r.housingRatio !== null && r.housingRatio > HOUSING_TARGET) {
    const gap = monthly((r.housingRatio - HOUSING_TARGET) * income);
    out.push(
      insight({
        id: 'housing-high',
        severity: 'warning',
        title: `Housing costs are ${formatPercent(r.housingRatio)} of income`,
        detail: `Above 30% of income is considered cost-burdened by the U.S. housing agency (HUD); you are ${fmt(gap)} a month over that line. It is measured on take-home pay here, so it reads higher than the gross-income version.`,
        impact: monthlyImpact(gap),
        metric: 'housingRatio',
      })
    );
  }

  if (r.debtServiceRatio !== null && r.debtServiceRatio > DEBT_TARGET) {
    out.push(
      insight({
        id: 'debt-high',
        severity: r.debtServiceRatio > DEBT_HIGH ? 'warning' : 'opportunity',
        title: `Loan payments take ${formatPercent(r.debtServiceRatio)} of income`,
        detail:
          'The 20/10 rule suggests keeping consumer-loan payments under 10% of take-home pay. Putting extra toward the highest-interest balance first (the avalanche method) cuts the total interest you pay.',
        impact: monthlyImpact(monthly((r.debtServiceRatio - DEBT_TARGET) * income)),
        metric: 'debtServiceRatio',
      })
    );
  }

  return out;
};

const avoidableCosts = ({ summary, format: fmt }: InsightInput): Insight[] => {
  const { waste } = summary.totals;
  if (waste <= 0) return [];
  const items = summary.subCategories
    .filter((i) => i.category === TransactionCategory.Waste)
    .slice(0, 2);
  const share = summary.ratios.avoidableShare ?? 0;
  return [
    insight({
      id: 'avoidable-costs',
      severity: share >= WASTE_HIGH_SHARE ? 'warning' : 'opportunity',
      title: `${fmt(waste)} went to avoidable costs`,
      detail:
        `Fees, penalties and similar charges in ${summary.period.label}` +
        (items.length ? `, mostly ${joinList(items.map((i) => i.label))}` : '') +
        '. Autopay, low-balance alerts and a subscription review prevent most of them.',
      impact: periodImpact(waste, summary),
      metric: 'avoidableCosts',
      action: 'review-transactions',
    }),
  ];
};

/**
 * Spending against its baseline. Weeks compare day-to-day spending only —
 * recurring bills and subscriptions land in whichever week they're due, which
 * would otherwise make every rent week look like a spike. Subcategories that
 * rise sharply, or appear for the first time at a material size, are named.
 */
const versusBaseline = ({ summary, baseline, dayToDay, format: fmt }: InsightInput): Insight[] => {
  const weekly = summary.period.granularity === 'week';
  const ref = weekly ? (dayToDay?.baseline ?? null) : baseline;
  const currentAgg = weekly ? dayToDay?.current : summary;
  if (!ref || !currentAgg) return [];

  const current = currentAgg.totals.spending;
  const base = ref.totals.spending;
  if (base <= 0) return [];
  const change = compare(current, base);
  if (change.relative === null) return [];

  const subject = weekly ? 'Day-to-day spending' : 'Spending';
  const metric = weekly ? 'dayToDay' : 'spending';
  const pace = ref.paceDays !== null;
  const against = pace ? 'your usual pace' : `your ${ref.label}`;
  const basis =
    (pace ? `typically spent by this point (${ref.label})` : `(${ref.label})`) +
    (weekly
      ? '. Bills and subscriptions are left out because they land in whichever week they are due'
      : '');

  const movers = currentAgg.subCategories
    .map((item) => {
      const itemBase = ref.subCategories[item.key] ?? 0;
      return { item, base: itemBase, increase: round2(item.amount - itemBase) };
    })
    .filter((m) =>
      m.base > 0
        ? m.increase >= Math.max(SPIKE_RELATIVE * m.base, SPIKE_MIN_SHARE * base)
        : m.increase >= SPIKE_NEW_SHARE * base
    )
    .sort((a, b) => b.increase - a.increase || a.item.label.localeCompare(b.item.label));

  if (change.relative >= SPENDING_UP) {
    const drivers = movers.slice(0, 2);
    return [
      insight({
        id: 'spending-up',
        severity: 'warning',
        title: `${subject} is ${formatPercent(change.relative)} above ${against}`,
        detail:
          `${fmt(current)} vs ${fmt(base)} ${basis}.` +
          (drivers.length
            ? ` The biggest increases: ${joinList(
                drivers.map((m) =>
                  m.base > 0
                    ? `${m.item.label} (+${fmt(m.increase)})`
                    : `${m.item.label} (${fmt(m.increase)}, new)`
                )
              )}.`
            : ''),
        impact: periodImpact(change.absolute, summary),
        metric,
        action: 'review-transactions',
      }),
    ];
  }

  const out = movers.slice(0, 2).map((m) =>
    m.base > 0
      ? insight({
          id: `spike:${m.item.key}`,
          severity: 'warning',
          title: `${m.item.label} is up ${formatPercent(m.increase / m.base)}`,
          detail: `${fmt(m.item.amount)} vs ${fmt(m.base)} ${basis}.`,
          impact: periodImpact(m.increase, summary),
          metric,
          action: 'review-transactions',
        })
      : insight({
          id: `new:${m.item.key}`,
          severity: 'info',
          title: `New spending: ${m.item.label}`,
          detail: `${fmt(m.item.amount)} in ${summary.period.label}; nothing was spent on it in the comparison period (${ref.label}${pace ? ', same days' : ''}).`,
          impact: periodImpact(m.increase, summary),
          metric,
          action: 'review-transactions',
        })
  );
  if (change.relative <= -SPENDING_DOWN) {
    out.push(
      insight({
        id: 'spending-down',
        severity: 'positive',
        title: `${subject} is ${formatPercent(-change.relative)} below ${against}`,
        detail: `${fmt(current)} vs ${fmt(base)} ${basis}. Moving the difference to savings locks the gain in.`,
        metric,
      })
    );
  }
  return out;
};

const recurringCommitments = ({ recurring, format: fmt }: InsightInput): Insight[] => {
  if (recurring.length === 0) return [];
  const totals = totalRecurring(recurring);
  const lifestyle = recurring.filter(
    (c) => c.category === TransactionCategory.NiceToHave || c.category === TransactionCategory.Waste
  );
  return [
    insight({
      id: 'recurring',
      severity: 'info',
      title: `${pluralize(totals.count, 'recurring charge')} cost ${fmt(totals.monthly)} a month`,
      detail:
        `That's ${fmt(totals.annual)} a year. Largest: ${joinList(recurring.slice(0, 3).map((c) => `${c.merchant} (${fmt(c.monthlyEquivalent)} a month)`))}.` +
        (lifestyle.length
          ? ` ${lifestyle.length === 1 ? 'One is discretionary' : `${lifestyle.length} are discretionary`}: cancel any you no longer use.`
          : ''),
      metric: 'recurring',
      action: 'review-recurring',
    }),
  ];
};

const emergencyFund = ({ score, format: fmt }: InsightInput): Insight[] => {
  const w = score.window;
  const target = emergencyFundTarget(w);
  if (!target) return [];
  const setAside = round2(w.totals.setAside / w.months);
  const pace =
    setAside > 0
      ? ` At your current ${fmt(setAside)} a month set aside, building 3 months from scratch takes about ${pluralize(Math.ceil(target.low / setAside), 'month')}.`
      : ' An automatic transfer on payday is the easiest way to build it.';
  return [
    insight({
      id: 'emergency-fund',
      severity: 'info',
      title: `Emergency fund target: ${fmt(target.low)}–${fmt(target.high)}`,
      detail: `That's 3–6 months of essential spending (${fmt(target.monthlyEssentials)} a month over ${w.label}).${pace}`,
      metric: 'emergencyFund',
    }),
  ];
};

const encouragement = ({ score, format: fmt }: InsightInput): Insight[] => {
  const w = score.window;
  const r = w.ratios;
  if (r.savingsRate === null || r.savingsRate < SAVINGS_TARGET || w.months <= 0) return [];
  if ((r.needsRatio ?? 0) <= NEEDS_TARGET && (r.wantsRatio ?? 0) <= WANTS_TARGET) {
    return [
      insight({
        id: 'budget-fit',
        severity: 'positive',
        title: 'Your budget fits the 50/30/20 framework',
        detail: `Over ${w.label}: needs ${formatPercent(r.needsRatio ?? 0)}, wants ${formatPercent(r.wantsRatio ?? 0)} and savings ${formatPercent(r.savingsRate)} of income.`,
        metric: 'budgetRule',
      }),
    ];
  }
  const idle = round2(w.totals.unallocated / w.months);
  return [
    insight({
      id: 'savings-strong',
      severity: 'positive',
      title: `You're saving ${formatPercent(r.savingsRate)} of your income`,
      detail:
        `That beats the 20% benchmark over ${w.label}.` +
        (idle > 0
          ? ` About ${fmt(idle)} a month of it stays in your everyday account; an automatic payday transfer puts it to work.`
          : ''),
      metric: 'savingsRate',
    }),
  ];
};

const byPriority = (a: Insight, b: Insight): number =>
  SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
  (b.impact?.amount ?? -1) - (a.impact?.amount ?? -1) ||
  a.id.localeCompare(b.id);

/**
 * Deterministic, rule-based findings and advice, most urgent first: the same
 * data always yields the same insights in the same order.
 */
export const buildInsights = (input: InsightInput): Insight[] => {
  const insights = [...dataQuality(input), ...cashFlow(input)];
  const fired = new Set(insights.map((i) => i.id));
  insights.push(
    ...structural(input, fired),
    ...avoidableCosts(input),
    ...versusBaseline(input),
    ...recurringCommitments(input),
    ...emergencyFund(input),
    ...encouragement(input)
  );
  return insights.sort(byPriority);
};

/** Insights worth a notification: spending running above its baseline. */
export const spendingAlerts = (insights: Insight[]): Insight[] =>
  insights.filter((i) => i.id === 'spending-up' || i.id.startsWith('spike:'));
