import { formatISODate } from './dates';
import { MoneyFormatter, formatPercent, pluralize } from './format';
import type { FinanceModel } from './model';

const pct = (value: number | null): string => (value === null ? 'n/a' : formatPercent(value));

const change = (current: number, base: number): string => {
  if (base === 0) return 'n/a';
  const relative = (current - base) / Math.abs(base);
  return `${relative >= 0 ? '+' : ''}${formatPercent(relative)}`;
};

/**
 * The figures the assistant may quote, rendered as plain text from the same
 * deterministic model the overview shows — the LLM never sees raw
 * transactions and never has to compute anything itself.
 */
export const buildAssistantContext = (
  model: FinanceModel,
  format: MoneyFormatter,
  currency: string
): string => {
  const { period, summary, baseline, score, recurring, recurringTotals, insights, bounds } = model;
  const t = summary.totals;
  const lines: string[] = [];

  const progress =
    summary.coverage.isInProgress && summary.coverage.through
      ? `; in progress, data through ${formatISODate(summary.coverage.through)}`
      : summary.coverage.startsMidPeriod && summary.coverage.from
        ? `; data starts ${formatISODate(summary.coverage.from)}`
        : '';
  lines.push(
    `Selected period: ${period.label} (${formatISODate(period.start)} – ${formatISODate(period.end)})${progress}.`,
    `All amounts are in ${currency}.` +
      (bounds
        ? ` Data available: ${formatISODate(bounds.first)} – ${formatISODate(bounds.last)}.`
        : ''),
    '',
    `CASH FLOW — ${period.label}`,
    `Income: ${format(t.income)}`,
    `Spending: ${format(t.spending)} (Must-have ${format(t.needs)}; Nice-to-have ${format(t.wants)}; Waste ${format(t.waste)}; Uncategorized ${format(t.unclassified)})`,
    `Net cash flow (income − spending): ${format(t.netCashFlow)}`,
    `Savings rate: ${pct(summary.ratios.savingsRate)}`,
    `Set aside to savings and investments: ${format(t.setAside)}`,
    `50/30/20 split: needs ${pct(summary.ratios.needsRatio)}, wants ${pct(summary.ratios.wantsRatio)}, savings ${pct(summary.ratios.savingsRate)} of income`
  );
  if (summary.avgDailySpending !== null)
    lines.push(`Average daily spending: ${format(summary.avgDailySpending)}`);

  if (baseline) {
    lines.push(
      '',
      `COMPARED WITH ${baseline.label.toUpperCase()} (${baseline.description})`,
      `Income: ${format(baseline.totals.income)} (now ${change(t.income, baseline.totals.income)})`,
      `Spending: ${format(baseline.totals.spending)} (now ${change(t.spending, baseline.totals.spending)})`,
      `Net cash flow: ${format(baseline.totals.netCashFlow)}`
    );
  }

  if (summary.subCategories.length > 0) {
    lines.push('', `WHERE THE MONEY WENT — ${period.label}`);
    for (const item of summary.subCategories.slice(0, 8)) {
      const name = item.subCategory ? `${item.category} › ${item.subCategory}` : item.label;
      lines.push(`${name}: ${format(item.amount)} (${pct(item.share)} of spending)`);
    }
  }

  if (summary.merchants.length > 0) {
    lines.push('', `TOP MERCHANTS — ${period.label}`);
    for (const m of summary.merchants.slice(0, 5)) {
      lines.push(`${m.label}: ${format(m.amount)} across ${pluralize(m.count, 'payment')}`);
    }
  }

  lines.push('');
  if (score.score !== null) {
    lines.push(
      `FINANCIAL HEALTH SCORE: ${score.score}/100 (${score.grade}, ${score.rating}), based on ${score.window.label}`
    );
    for (const c of score.components) {
      lines.push(
        `${c.label}: ${c.display} (target ${c.target}) — ${c.points}/${c.maxPoints} points`
      );
    }
    if (score.caveat) lines.push(`Note: ${score.caveat}`);
  } else {
    lines.push(`FINANCIAL HEALTH SCORE: not available. ${score.reason ?? ''}`.trim());
  }

  if (recurring.length > 0) {
    lines.push(
      '',
      `RECURRING CHARGES: ${recurringTotals.count} active, ${format(recurringTotals.monthly)} a month (${format(recurringTotals.annual)} a year)`
    );
    for (const c of recurring.slice(0, 6)) {
      lines.push(
        `${c.merchant}: ${format(c.lastAmount)} ${c.cadence}, next expected around ${formatISODate(c.nextExpected)}`
      );
    }
  }

  if (insights.length > 0) {
    lines.push('', 'KEY FINDINGS (most urgent first)');
    insights.forEach((i, index) => {
      lines.push(`${index + 1}. [${i.severity}] ${i.title}. ${i.detail}`);
    });
  }

  const q = summary.quality;
  lines.push(
    '',
    `DATA QUALITY: ${pluralize(q.uncategorizedCount, 'uncategorized transaction')} (${pct(q.uncategorizedShare)} of money out); ${pluralize(q.needsReviewCount, 'categorized transaction')} with low confidence awaiting review.`
  );
  return lines.join('\n');
};
