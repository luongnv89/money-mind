import React from 'react';
import { Card, CardContent } from '../../components/UI';
import {
  BENCHMARKS,
  HealthScore,
  METRIC_DEFINITIONS,
  formatPercent,
  perMonth,
  statusFor,
} from '../../lib/finance';
import { CATEGORY_CHART_COLORS } from '../../constants';
import { TransactionCategory } from '../../types';
import { MetricInfo, StatusBadge } from './shared';

const SEGMENTS = {
  needs: CATEGORY_CHART_COLORS[TransactionCategory.MustHave],
  wants: CATEGORY_CHART_COLORS[TransactionCategory.NiceToHave],
  unclassified: CATEGORY_CHART_COLORS[TransactionCategory.Uncategorized],
  saved: CATEGORY_CHART_COLORS[TransactionCategory.Save],
};

const LegendRow: React.FC<{
  color: string;
  label: string;
  ratio: number | null;
  target: string;
  monthly: number | null;
  status: ReturnType<typeof statusFor>;
  fmt: (n: number) => string;
}> = ({ color, label, ratio, target, monthly, status, fmt }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
    <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink sm:flex-none">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{label}</span>
      <span className="num ml-auto font-medium text-ink sm:ml-0 sm:pl-3">
        {ratio === null ? '—' : formatPercent(ratio)}
      </span>
    </span>
    <span className="num flex w-full shrink-0 items-baseline gap-3 pl-5 text-sm sm:w-auto sm:pl-0">
      <span className="text-xs text-muted">target {target}</span>
      <span className="w-20 text-right text-xs text-muted">
        {monthly === null ? '' : `${fmt(monthly)}/mo`}
      </span>
      <StatusBadge status={status} />
    </span>
  </div>
);

export interface BudgetRuleCardProps {
  score: HealthScore;
  fmt: (n: number) => string;
}

/** The 50/30/20 split of the score window's take-home income. */
export const BudgetRuleCard: React.FC<BudgetRuleCardProps> = ({ score, fmt }) => {
  const { window } = score;
  const ratios = window.ratios;
  const months = window.months || 1;

  if (!window.totals.income || window.totals.income <= 0) {
    return (
      <Card className="flex-1">
        <CardContent className="flex h-full flex-col items-start justify-center gap-3 p-6">
          <div className="flex items-center gap-1">
            <p className="font-display text-lg text-ink">50/30/20 check</p>
            <MetricInfo metric="budgetRule" />
          </div>
          <p className="text-sm text-ink-soft">
            Add income transactions to see how your budget splits.
          </p>
        </CardContent>
      </Card>
    );
  }

  const needs = ratios.needsRatio ?? 0;
  const wants = ratios.wantsRatio ?? 0;
  const unclassified = ratios.unclassifiedRatio ?? 0;
  const saved = ratios.savingsRate ?? 0;

  const outflow = needs + wants + unclassified;
  const overspent = outflow > 1;
  const scale = Math.max(1, outflow);

  const seg = (value: number, color: string, key: string) =>
    value <= 0 ? null : (
      <div
        key={key}
        className="h-full"
        style={{ width: `${(value / scale) * 100}%`, backgroundColor: color }}
      />
    );

  return (
    <Card className="flex-1">
      <CardContent className="p-6">
        <div className="flex items-center gap-1">
          <p className="font-display text-lg text-ink">50/30/20 check</p>
          <MetricInfo metric="budgetRule" />
        </div>
        <p className="mt-1 text-xs text-muted">Share of take-home income · {window.label}</p>

        <div className="relative mt-5">
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-line/60">
            {seg(needs, SEGMENTS.needs, 'needs')}
            {seg(wants, SEGMENTS.wants, 'wants')}
            {unclassified > 0.005 && seg(unclassified, SEGMENTS.unclassified, 'unclassified')}
            {saved > 0 && seg(saved, SEGMENTS.saved, 'saved')}
          </div>
          {/* Target ticks at 50% and 80% of income */}
          <span
            className="absolute -top-1 bottom-[-4px] w-px bg-ink/40"
            style={{ left: `${(0.5 / scale) * 100}%` }}
            aria-hidden="true"
          />
          <span
            className="absolute -top-1 bottom-[-4px] w-px bg-ink/40"
            style={{ left: `${(0.8 / scale) * 100}%` }}
            aria-hidden="true"
          />
        </div>
        {overspent && (
          <p className="mt-2 text-xs font-medium text-negative">
            Overspent by {formatPercent(outflow - 1)}
          </p>
        )}
        {unclassified > 0.005 && (
          <p className="mt-1 text-xs text-muted">
            Includes {formatPercent(unclassified)} uncategorized money out.
          </p>
        )}

        <div className="mt-4 space-y-2.5">
          <LegendRow
            color={SEGMENTS.needs}
            label="Needs"
            ratio={ratios.needsRatio}
            target={BENCHMARKS.needsRatio.target}
            monthly={perMonth(window.totals.needs, months)}
            status={statusFor('needsRatio', ratios.needsRatio)}
            fmt={fmt}
          />
          <LegendRow
            color={SEGMENTS.wants}
            label="Wants"
            ratio={ratios.wantsRatio}
            target={BENCHMARKS.wantsRatio.target}
            monthly={perMonth(window.totals.wants + window.totals.waste, months)}
            status={statusFor('wantsRatio', ratios.wantsRatio)}
            fmt={fmt}
          />
          <LegendRow
            color={SEGMENTS.saved}
            label="Savings"
            ratio={ratios.savingsRate}
            target={BENCHMARKS.savingsRate.target}
            monthly={perMonth(window.totals.netCashFlow, months)}
            status={statusFor('savingsRate', ratios.savingsRate)}
            fmt={fmt}
          />
        </div>

        <div className="mt-5 rounded-lg border border-line bg-surface-muted/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            How to read this
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
            {METRIC_DEFINITIONS.budgetRule.meaning}
          </p>
          {METRIC_DEFINITIONS.budgetRule.benchmark && (
            <p className="mt-1 text-xs text-muted">
              <span className="font-medium text-ink-soft">Benchmark:</span>{' '}
              {METRIC_DEFINITIONS.budgetRule.benchmark}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
