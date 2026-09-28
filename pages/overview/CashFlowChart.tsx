import React from 'react';
import {
  Bar,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent } from '../../components/UI';
import { Coverage, FinanceModel, Period, TrendPoint, formatPercent } from '../../lib/finance';
import { formatCompactCurrency } from '../../lib/utils';
import { useSettingsStore } from '../../stores/useSettingsStore';

const COLORS = { income: '#0F766E', spending: '#1F3A5F', net: '#B08D57' };

interface ChartDatum {
  label: string;
  period: Period;
  income: number;
  spending: number;
  netCashFlow: number;
  savingsRate: number | null;
  coverage: Coverage;
  selected: boolean;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: ChartDatum }[];
}

const ChartTooltip: React.FC<TooltipProps & { fmt: (n: number) => string }> = ({
  active,
  payload,
  fmt,
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-medium text-ink">{d.period.label}</p>
      <p className="num text-ink-soft">Income {fmt(d.income)}</p>
      <p className="num text-ink-soft">Spending {fmt(d.spending)}</p>
      <p className="num text-ink-soft">Net {fmt(d.netCashFlow)}</p>
      <p className="num text-ink-soft">
        Savings rate {d.savingsRate === null ? '—' : formatPercent(d.savingsRate)}
      </p>
      {d.coverage.isInProgress && <p className="mt-0.5 text-muted">in progress</p>}
      {d.coverage.startsMidPeriod && <p className="text-muted">partial data</p>}
    </div>
  );
};

export interface CashFlowChartProps {
  model: FinanceModel;
  fmt: (n: number) => string;
  onSelectPeriod: (period: Period) => void;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ model, fmt, onSelectPeriod }) => {
  const currency = useSettingsStore((s) => s.currency);
  const data: ChartDatum[] = model.trend.map((p: TrendPoint) => ({
    label: p.period.shortLabel,
    period: p.period,
    income: p.income,
    spending: p.spending,
    netCashFlow: p.netCashFlow,
    savingsRate: p.savingsRate,
    coverage: p.coverage,
    selected: p.selected,
  }));

  const select = (d: ChartDatum) => onSelectPeriod(d.period);

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#7A7466' }}
                axisLine={{ stroke: '#E7E1D6' }}
                tickLine={false}
              />
              <YAxis
                width={52}
                tick={{ fontSize: 11, fill: '#7A7466' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatCompactCurrency(v, currency)}
              />
              <Tooltip
                content={<ChartTooltip fmt={fmt} />}
                cursor={{ fill: 'rgba(31, 58, 95, 0.05)' }}
              />
              <Bar
                dataKey="income"
                fill={COLORS.income}
                radius={[3, 3, 0, 0]}
                maxBarSize={18}
                onClick={(d) => select(d as unknown as ChartDatum)}
                cursor="pointer"
              >
                {data.map((d) => (
                  <Cell key={`in-${d.period.key}`} fillOpacity={d.selected ? 1 : 0.55} />
                ))}
              </Bar>
              <Bar
                dataKey="spending"
                fill={COLORS.spending}
                radius={[3, 3, 0, 0]}
                maxBarSize={18}
                onClick={(d) => select(d as unknown as ChartDatum)}
                cursor="pointer"
              >
                {data.map((d) => (
                  <Cell key={`sp-${d.period.key}`} fillOpacity={d.selected ? 1 : 0.55} />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="netCashFlow"
                stroke={COLORS.net}
                strokeWidth={2}
                dot={{ r: 2.5, fill: COLORS.net, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.income }} />
            Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.spending }} />
            Spending
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-px" style={{ backgroundColor: COLORS.net }} />
            Net cash flow
          </span>
          <span className="text-muted/80">Select a bar to open that period.</span>
        </div>

        {/* Same values for screen readers / non-visual review. */}
        <table className="sr-only">
          <caption>Cash flow by period</caption>
          <thead>
            <tr>
              <th>Period</th>
              <th>Income</th>
              <th>Spending</th>
              <th>Net cash flow</th>
              <th>Savings rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.period.key}>
                <td>{d.period.label}</td>
                <td>{fmt(d.income)}</td>
                <td>{fmt(d.spending)}</td>
                <td>{fmt(d.netCashFlow)}</td>
                <td>{d.savingsRate === null ? '—' : formatPercent(d.savingsRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};
