import React from 'react';
import { Card, CardContent } from '../../components/UI';
import {
  BENCHMARKS,
  BenchmarkedMetric,
  FinanceModel,
  MetricId,
  formatPercent,
  statusFor,
} from '../../lib/finance';
import { MetricInfo, StatusBadge } from './shared';

interface RatioCard {
  name: string;
  metric: MetricId;
  /** null → rendered as "—" with the caption. */
  value: string | null;
  benchmarkedMetric?: BenchmarkedMetric;
  /** Raw ratio for statusFor. */
  ratio?: number | null;
  target?: string;
  caption?: string;
}

const RatioCardView: React.FC<{ card: RatioCard }> = ({ card }) => {
  const status =
    card.benchmarkedMetric && card.ratio !== undefined
      ? statusFor(card.benchmarkedMetric, card.ratio)
      : null;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-ink-soft">{card.name}</span>
          <MetricInfo metric={card.metric} />
        </div>
        <p className="num mt-2 font-display text-[26px] leading-none text-ink">
          {card.value ?? '—'}
        </p>
        <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5">
          <StatusBadge status={status} />
          {card.target && <span className="text-[11px] text-muted">Target {card.target}</span>}
        </div>
        {card.caption && <p className="num mt-1.5 text-[11px] text-muted">{card.caption}</p>}
      </CardContent>
    </Card>
  );
};

export interface RatioGridProps {
  model: FinanceModel;
  fmt: (n: number) => string;
}

/** Key ratios measured over the health-score window plus structural figures. */
export const RatioGrid: React.FC<RatioGridProps> = ({ model, fmt }) => {
  const { window } = model.score;
  const ratios = window.ratios;
  const hasIncome = window.totals.income > 0;
  const ratio = (value: number | null): number | null => (hasIncome ? value : null);
  const ratioText = (value: number | null): string | null =>
    hasIncome && value !== null ? formatPercent(value) : null;
  const noIncome = hasIncome ? undefined : 'Needs income data';

  const debtRatio = ratio(ratios.debtServiceRatio);

  const cards: RatioCard[] = [
    {
      name: 'Savings rate',
      metric: 'savingsRate',
      value: ratioText(ratios.savingsRate),
      benchmarkedMetric: 'savingsRate',
      ratio: ratio(ratios.savingsRate),
      target: BENCHMARKS.savingsRate.target,
      caption: noIncome,
    },
    {
      name: 'Set-aside rate',
      metric: 'setAside',
      value: ratioText(ratios.setAsideRate),
      benchmarkedMetric: 'setAside',
      ratio: ratio(ratios.setAsideRate),
      target: BENCHMARKS.setAside.target,
      caption: noIncome,
    },
    {
      name: 'Essentials ratio',
      metric: 'needsRatio',
      value: ratioText(ratios.needsRatio),
      benchmarkedMetric: 'needsRatio',
      ratio: ratio(ratios.needsRatio),
      target: BENCHMARKS.needsRatio.target,
      caption: noIncome,
    },
    {
      name: 'Lifestyle ratio',
      metric: 'wantsRatio',
      value: ratioText(ratios.wantsRatio),
      benchmarkedMetric: 'wantsRatio',
      ratio: ratio(ratios.wantsRatio),
      target: BENCHMARKS.wantsRatio.target,
      caption: noIncome,
    },
    {
      name: 'Housing cost ratio',
      metric: 'housingRatio',
      value: ratioText(ratios.housingRatio),
      benchmarkedMetric: 'housingRatio',
      ratio: ratio(ratios.housingRatio),
      target: BENCHMARKS.housingRatio.target,
      caption: noIncome,
    },
    {
      name: 'Loan payment ratio',
      metric: 'debtServiceRatio',
      value: ratioText(ratios.debtServiceRatio),
      benchmarkedMetric: 'debtServiceRatio',
      ratio: debtRatio,
      target: BENCHMARKS.debtServiceRatio.target,
      caption: debtRatio === 0 ? 'No loan payments detected' : noIncome,
    },
    {
      name: 'Avoidable costs',
      metric: 'avoidableCosts',
      value: ratioText(ratios.avoidableShare),
      benchmarkedMetric: 'avoidableCosts',
      ratio: ratio(ratios.avoidableShare),
      target: BENCHMARKS.avoidableCosts.target,
      caption: noIncome,
    },
    {
      name: 'Monthly burn rate',
      metric: 'burnRate',
      value: model.burnRate !== null ? fmt(model.burnRate) : null,
      caption: 'average spending per month',
    },
    {
      name: 'Emergency fund target',
      metric: 'emergencyFund',
      value:
        model.emergencyFund !== null
          ? `${fmt(model.emergencyFund.low)}–${fmt(model.emergencyFund.high)}`
          : null,
      caption:
        model.emergencyFund !== null
          ? `3–6 months of essentials (${fmt(model.emergencyFund.monthlyEssentials)}/mo)`
          : '3–6 months of essentials',
    },
    {
      name: 'Recurring commitments',
      metric: 'recurring',
      value: `${fmt(model.recurringTotals.monthly)}/mo`,
      caption: `${model.recurringTotals.count} active · ${fmt(model.recurringTotals.annual)}/yr`,
    },
    {
      name: 'Average daily spending',
      metric: 'dailySpending',
      value: model.summary.avgDailySpending !== null ? fmt(model.summary.avgDailySpending) : null,
      caption: model.period.label,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <RatioCardView key={card.name} card={card} />
      ))}
    </div>
  );
};
