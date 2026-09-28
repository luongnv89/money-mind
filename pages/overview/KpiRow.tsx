import React from 'react';
import { Card, CardContent } from '../../components/UI';
import {
  Baseline,
  Delta,
  FinanceModel,
  Granularity,
  compare,
  formatPercent,
  ratiosOf,
} from '../../lib/finance';
import { MetricInfo } from './shared';

/** Signed delta text: relative percent when computable, absolute money otherwise. */
const deltaText = (delta: Delta, fmt: (n: number) => string): string => {
  if (delta.relative !== null) {
    const sign = delta.relative > 0 ? '+' : delta.relative < 0 ? '−' : '';
    return `${sign}${formatPercent(Math.abs(delta.relative))}`;
  }
  const sign = delta.absolute > 0 ? '+' : delta.absolute < 0 ? '−' : '';
  return `${sign}${fmt(Math.abs(delta.absolute))}`;
};

const deltaColor = (absolute: number, goodWhenUp: boolean): string => {
  if (absolute === 0) return 'text-muted';
  const improved = goodWhenUp ? absolute > 0 : absolute < 0;
  return improved ? 'text-positive' : 'text-negative';
};

const BaselineNote: React.FC<{ baseline: Baseline | null }> = ({ baseline }) =>
  baseline ? (
    <p className="mt-1 text-xs text-muted" title={baseline.description}>
      vs {baseline.label}
      {baseline.paceDays ? ` · same first ${baseline.paceDays} days` : ''}
    </p>
  ) : (
    <p className="mt-1 text-xs text-muted">No comparison yet</p>
  );

const DeltaLine: React.FC<{
  delta: Delta | null;
  goodWhenUp: boolean;
  fmt: (n: number) => string;
}> = ({ delta, goodWhenUp, fmt }) =>
  delta ? (
    <p className={`num mt-1 text-sm font-medium ${deltaColor(delta.absolute, goodWhenUp)}`}>
      {deltaText(delta, fmt)}
    </p>
  ) : null;

/** Tiny inline sparkline of the trend's net cash flow. Display scaling only. */
const Sparkline: React.FC<{ values: number[]; stroke: string }> = ({ values, stroke }) => {
  if (values.length < 2) return null;
  const w = 140;
  const h = 36;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * (w - pad * 2) + pad;
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const zeroY = min < 0 && max > 0 ? y(0) : null;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-36 shrink-0" aria-hidden="true">
      {zeroY !== null && (
        <line x1={0} x2={w} y1={zeroY} y2={zeroY} stroke="#E7E1D6" strokeDasharray="3 3" />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const KpiCard: React.FC<{
  label: string;
  metric?: Parameters<typeof MetricInfo>[0]['metric'];
  value: string;
  valueClass?: string;
  delta?: Delta | null;
  goodWhenUp?: boolean;
  baseline: Baseline | null;
  fmt: (n: number) => string;
  sub?: React.ReactNode;
  /** Replaces the delta/baseline block (e.g. explanatory text in week view). */
  note?: string;
}> = ({ label, metric, value, valueClass, delta, goodWhenUp = true, baseline, fmt, sub, note }) => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-ink-soft">{label}</span>
        {metric && <MetricInfo metric={metric} />}
      </div>
      <p className={`num mt-2 font-display text-[28px] leading-none text-ink ${valueClass ?? ''}`}>
        {value}
      </p>
      {sub}
      {note !== undefined ? (
        <p className="mt-1 text-xs text-muted">{note}</p>
      ) : (
        <>
          {delta !== undefined && <DeltaLine delta={delta} goodWhenUp={goodWhenUp} fmt={fmt} />}
          <BaselineNote baseline={baseline} />
        </>
      )}
    </CardContent>
  </Card>
);

export interface KpiRowProps {
  model: FinanceModel;
  granularity: Granularity;
  /** Currency-aware formatter from the page (same one handed to the engine). */
  fmt: (n: number) => string;
}

export const KpiRow: React.FC<KpiRowProps> = ({ model, granularity, fmt }) => {
  const { summary, baseline, trend, dayToDay } = model;
  const totals = summary.totals;
  const weekly = granularity === 'week';

  const net = totals.netCashFlow;
  const netClass = net >= 0 ? 'text-positive' : 'text-negative';
  const netDisplay = `${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}`;
  const trendValues = trend.map((p) => p.netCashFlow);

  const netDelta = baseline && !weekly ? compare(net, baseline.totals.netCashFlow) : null;
  const incomeDelta = baseline && !weekly ? compare(totals.income, baseline.totals.income) : null;
  const spendingDelta =
    baseline && !weekly ? compare(totals.spending, baseline.totals.spending) : null;
  const dayToDayDelta =
    weekly && dayToDay?.baseline
      ? compare(dayToDay.current.totals.spending, dayToDay.baseline.totals.spending)
      : null;

  // Percentage-point delta for the savings rate card.
  const baseSavingsRate = baseline ? ratiosOf(baseline.totals).savingsRate : null;
  const savingsPts =
    baseline && summary.ratios.savingsRate !== null && baseSavingsRate !== null
      ? (summary.ratios.savingsRate - baseSavingsRate) * 100
      : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="sm:col-span-2 lg:col-span-1">
        <CardContent className="p-5">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-ink-soft">Net cash flow</span>
            <MetricInfo metric="netCashFlow" />
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
            <p
              className={`num font-display text-[34px] leading-none whitespace-nowrap lg:text-[44px] ${netClass}`}
            >
              {netDisplay}
            </p>
            <Sparkline values={trendValues} stroke={net >= 0 ? '#0E7A5A' : '#A23B3B'} />
          </div>
          <p className="num mt-2 text-xs text-muted">
            Income {fmt(totals.income)} − Spending {fmt(totals.spending)}
          </p>
          {weekly ? (
            <p className="mt-1 text-xs text-muted">
              Judge savings over months — see Financial health
            </p>
          ) : (
            <>
              <DeltaLine delta={netDelta} goodWhenUp fmt={fmt} />
              <BaselineNote baseline={baseline} />
            </>
          )}
        </CardContent>
      </Card>

      <KpiCard
        label="Income"
        metric="income"
        value={fmt(totals.income)}
        delta={incomeDelta}
        goodWhenUp
        baseline={baseline}
        fmt={fmt}
        note={weekly ? 'Weekly income depends on paydays' : undefined}
      />
      <KpiCard
        label="Spending"
        metric="spending"
        value={fmt(totals.spending)}
        delta={spendingDelta}
        goodWhenUp={false}
        baseline={baseline}
        fmt={fmt}
        note={weekly ? 'Includes bills due this week' : undefined}
      />

      {weekly ? (
        <KpiCard
          label="Day-to-day spending"
          metric="dayToDay"
          value={fmt(dayToDay?.current.totals.spending ?? 0)}
          delta={dayToDayDelta}
          goodWhenUp={false}
          baseline={dayToDay?.baseline ?? null}
          fmt={fmt}
        />
      ) : (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-ink-soft">Savings rate</span>
              <MetricInfo metric="savingsRate" />
            </div>
            <p className="num mt-2 font-display text-[28px] leading-none text-ink">
              {summary.ratios.savingsRate !== null
                ? formatPercent(summary.ratios.savingsRate)
                : '—'}
            </p>
            <p className="num mt-1 text-xs text-muted">
              {fmt(totals.setAside)} set aside to savings &amp; investments
            </p>
            {savingsPts !== null && (
              <p className={`num mt-1 text-sm font-medium ${deltaColor(savingsPts, true)}`}>
                {savingsPts > 0 ? '+' : savingsPts < 0 ? '−' : ''}
                {Math.abs(savingsPts).toFixed(1)} pts
              </p>
            )}
            <BaselineNote baseline={baseline} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
