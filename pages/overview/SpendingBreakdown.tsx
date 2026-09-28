import React, { useState } from 'react';
import { Card, CardContent } from '../../components/UI';
import { CATEGORY_CHART_COLORS } from '../../constants';
import { BreakdownItem, FinanceModel, compare, formatPercent } from '../../lib/finance';
import { TransactionCategory } from '../../types';

const categoryColor = (category: TransactionCategory): string =>
  CATEGORY_CHART_COLORS[category] ?? '#9AA0A6';

const DeltaChip: React.FC<{
  current: number;
  base: number | undefined;
  fmt: (n: number) => string;
}> = ({ current, base, fmt }) => {
  if (base === undefined) return null;
  const delta = compare(current, base);
  const up = delta.absolute > 0;
  const flat = delta.absolute === 0;
  const text =
    delta.relative !== null
      ? `${up ? '+' : flat ? '' : '−'}${formatPercent(Math.abs(delta.relative))}`
      : `${up ? '+' : flat ? '' : '−'}${fmt(Math.abs(delta.absolute))}`;
  return (
    <span
      className={`num rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
        flat
          ? 'bg-surface-muted text-muted'
          : up
            ? 'bg-negative/10 text-negative'
            : 'bg-positive/10 text-positive'
      }`}
    >
      {text}
    </span>
  );
};

const SubCategoryRows: React.FC<{
  category: TransactionCategory;
  subCategories: BreakdownItem[];
  baselineSubs: Record<string, number> | null;
  fmt: (n: number) => string;
}> = ({ category, subCategories, baselineSubs, fmt }) => {
  const [expanded, setExpanded] = useState(false);
  const subs = subCategories.filter((s) => s.category === category);
  if (subs.length === 0) return null;
  const shown = expanded ? subs : subs.slice(0, 4);
  return (
    <div className="mt-2 space-y-1.5 border-l-2 border-line pl-3">
      {shown.map((s) => (
        <div key={s.key} className="flex items-center gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate text-ink-soft">{s.subCategory ?? s.label}</span>
          <span className="num shrink-0 text-muted">
            {s.share !== null ? formatPercent(s.share) : '—'}
          </span>
          <DeltaChip current={s.amount} base={baselineSubs?.[s.key]} fmt={fmt} />
          <span className="num w-20 shrink-0 text-right font-medium text-ink">{fmt(s.amount)}</span>
        </div>
      ))}
      {subs.length > 4 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-accent hover:text-accent-hover"
        >
          {expanded ? 'Show less' : `${subs.length - 4} more`}
        </button>
      )}
    </div>
  );
};

export interface SpendingBreakdownProps {
  model: FinanceModel;
  fmt: (n: number) => string;
}

/** "Where the money went" — spending categories with baseline deltas + top merchants. */
export const SpendingBreakdown: React.FC<SpendingBreakdownProps> = ({ model, fmt }) => {
  const { summary, baseline } = model;
  const spending = summary.totals.spending;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="p-5">
          {summary.categories.length === 0 ? (
            <p className="text-sm text-muted">No spending recorded in this period.</p>
          ) : (
            <div className="space-y-4">
              {summary.categories.map((item) => (
                <div key={item.key}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: categoryColor(item.category) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                      {item.label}
                    </span>
                    <DeltaChip
                      current={item.amount}
                      base={baseline?.categories[item.key]}
                      fmt={fmt}
                    />
                    <span className="num w-24 shrink-0 text-right text-sm font-medium text-ink">
                      {fmt(item.amount)}
                    </span>
                  </div>
                  <div className="ml-4 mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line/70">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (item.share ?? 0) * 100)}%`,
                        backgroundColor: categoryColor(item.category),
                      }}
                    />
                  </div>
                  <SubCategoryRows
                    category={item.category}
                    subCategories={summary.subCategories}
                    baselineSubs={baseline?.subCategories ?? null}
                    fmt={fmt}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-ink">Top merchants</h3>
          {summary.merchants.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No merchants yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {summary.merchants.slice(0, 8).map((m) => (
                <div key={m.key} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: categoryColor(m.category) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{m.label}</p>
                    <p className="num text-xs text-muted">
                      {m.count} {m.count === 1 ? 'payment' : 'payments'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-sm font-medium text-ink">{fmt(m.amount)}</p>
                    <p className="num text-xs text-muted">
                      {spending > 0 ? formatPercent(m.amount / spending) : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
