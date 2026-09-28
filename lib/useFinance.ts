import { useDeferredValue, useEffect, useMemo } from 'react';
import {
  FinanceModel,
  Granularity,
  Ledger,
  Period,
  anchorFor,
  availablePeriods,
  buildFinanceModel,
  buildLedger,
  canShift,
  periodFor,
  shiftPeriod,
  spendingAlerts,
} from './finance';
import { formatCurrency } from './utils';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useToastStore } from '../stores/useToastStore';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useViewStore } from '../stores/useViewStore';

/**
 * The transaction ledger: indexed once per transaction-array change.
 * `useDeferredValue` keeps typing/interactions responsive while a large
 * import is being indexed.
 */
export const useLedger = (): Ledger => {
  const transactions = useTransactionStore((s) => s.transactions);
  const deferred = useDeferredValue(transactions);
  return useMemo(() => buildLedger(deferred), [deferred]);
};

export interface FinanceView {
  ledger: Ledger;
  /** The selected period (null only when there is no data at all). */
  period: Period | null;
  model: FinanceModel | null;
  /** Periods of the current granularity that contain data, newest first. */
  periods: Period[];
  granularity: Granularity;
  canPrev: boolean;
  canNext: boolean;
  goPrev: () => void;
  goNext: () => void;
  selectPeriod: (period: Period) => void;
  /** Switch granularity while keeping the user's place via the anchor. */
  setGranularity: (granularity: Granularity) => void;
}

/**
 * The single pipeline behind Overview and Transactions: ledger → selected
 * period → finance model. Both pages share the view store, so the period a
 * user picks on one page is still selected on the other.
 */
export const useFinanceView = (): FinanceView => {
  const ledger = useLedger();
  const granularity = useViewStore((s) => s.granularity);
  const anchor = useViewStore((s) => s.anchor);
  const setViewGranularity = useViewStore((s) => s.setGranularity);
  const setAnchor = useViewStore((s) => s.setAnchor);
  const currency = useSettingsStore((s) => s.currency);

  const period = useMemo(
    () => periodFor(ledger, granularity, anchor),
    [ledger, granularity, anchor]
  );

  // Rebuilt when the data, the selected period or the display currency
  // changes (currency flows into every formatted string in the model).
  const model = useMemo(
    () => (period ? buildFinanceModel(ledger, period, (n) => formatCurrency(n, currency)) : null),
    [ledger, period, currency]
  );

  const periods = useMemo(() => availablePeriods(ledger, granularity), [ledger, granularity]);

  const canPrev = !!period && canShift(ledger, period, -1);
  const canNext = !!period && canShift(ledger, period, 1);

  const goPrev = () => {
    if (!canPrev || !period) return;
    setAnchor(anchorFor(shiftPeriod(period, -1), ledger.bounds));
  };
  const goNext = () => {
    if (!canNext || !period) return;
    setAnchor(anchorFor(shiftPeriod(period, 1), ledger.bounds));
  };
  const selectPeriod = (p: Period) => setAnchor(anchorFor(p, ledger.bounds));

  const setGranularity = (next: Granularity) => {
    if (next === granularity) return;
    // Keep the user's place: anchor to the current selection's last day with
    // data so the new granularity lands on the period containing it.
    if (period) setAnchor(anchorFor(period, ledger.bounds));
    setViewGranularity(next);
  };

  return {
    ledger,
    period,
    model,
    periods,
    granularity,
    canPrev,
    canNext,
    goPrev,
    goNext,
    selectPeriod,
    setGranularity,
  };
};

/** Alerts already toasted this session — at most once per period + insight. */
const alertedKeys = new Set<string>();

/**
 * Spending alerts (B5): when the selected period is the one containing the
 * newest data, surface the engine's spending insights as warning toasts.
 * Each alert fires at most once per session per period key.
 */
export const useSpendingAlerts = (model: FinanceModel | null): void => {
  const enabled = useSettingsStore((s) => s.enableSpendingAlerts);
  const isCategorizing = useTransactionStore((s) => s.isCategorizing);
  const addToast = useToastStore((s) => s.addToast);

  const periodKey = model?.period.key;
  const bounds = model?.bounds;
  const periodStart = model?.period.start;
  const periodEnd = model?.period.end;
  const insights = model?.insights;

  useEffect(() => {
    if (!enabled || isCategorizing || !insights || !bounds || !periodKey || !periodEnd) return;
    // Only alert on the period that holds the latest data.
    if (!periodStart || !(periodStart <= bounds.last && bounds.last <= periodEnd)) return;

    for (const insight of spendingAlerts(insights).slice(0, 2)) {
      const key = `${periodKey}|${insight.id}`;
      if (alertedKeys.has(key)) continue;
      alertedKeys.add(key);
      addToast(insight.title, 'warning', 6000);
    }
  }, [enabled, isCategorizing, insights, bounds, periodKey, periodStart, periodEnd, addToast]);
};
