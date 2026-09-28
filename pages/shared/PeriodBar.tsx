import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Eyebrow, SegmentedControl } from '../../components/UI';
import { Granularity, formatISODate } from '../../lib/finance';
import { FinanceView } from '../../lib/useFinance';

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
];

/** Noun used in the previous/next aria-labels (`"Previous month"`). */
const unitName = (granularity: Granularity): string =>
  granularity === 'all' ? 'period' : granularity;

const navButtonClass =
  'inline-flex items-center justify-center rounded-full border border-line bg-surface text-ink-soft ' +
  'h-9 w-9 transition-colors hover:border-line-strong hover:text-ink ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper';

export interface PeriodBarProps {
  /** "Overview" / "Transactions". */
  eyebrow: string;
  view: FinanceView;
}

/**
 * Shared header for Overview and Transactions: the selected period, a
 * granularity switcher and period navigation. Every label and date comes
 * from the finance engine (`lib/useFinance`).
 */
export const PeriodBar: React.FC<PeriodBarProps> = ({ eyebrow, view }) => {
  const { period, model, periods, granularity, canPrev, canNext, goPrev, goNext, selectPeriod } =
    view;

  if (!period) {
    return (
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
    );
  }

  const coverage = model?.summary.coverage ?? null;
  const transactionCount = model?.summary.quality.transactionCount ?? 0;
  const showNavigation = granularity !== 'all';
  const unit = unitName(granularity);

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-ink tracking-tight">{period.label}</h1>
          {coverage?.isInProgress && coverage.through && (
            <Badge variant="warning">
              In progress · data through {formatISODate(coverage.through)}
            </Badge>
          )}
          {!coverage?.isInProgress && coverage?.startsMidPeriod && coverage.from && (
            <Badge variant="neutral">Partial · data from {formatISODate(coverage.from)}</Badge>
          )}
        </div>
        <p className="mt-1.5 text-sm text-muted">
          {formatISODate(period.start)} – {formatISODate(period.end)} · {transactionCount}{' '}
          transactions
        </p>
      </div>

      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="Time period"
          options={GRANULARITY_OPTIONS}
          value={granularity}
          onChange={view.setGranularity}
        />

        {showNavigation && (
          <>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={`Previous ${unit}`}
                onClick={goPrev}
                disabled={!canPrev}
                className={navButtonClass}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Next ${unit}`}
                onClick={goNext}
                disabled={!canNext}
                className={navButtonClass}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <select
                aria-label="Select period"
                value={period.key}
                onChange={(e) => {
                  const next = periods.find((p) => p.key === e.target.value);
                  if (next) selectPeriod(next);
                }}
                className="h-9 appearance-none rounded-full border border-line bg-surface pl-4 pr-9 text-sm font-medium text-ink transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                {periods.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
