import { useMemo } from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { Transaction, TransactionCategory } from '../../types';
import { safeNewDate } from '../../lib/utils';
import type { TimeRange } from './TimeFilterBar';

const getTimestamp = (d: string) => {
  const date = new Date(d);
  return isNaN(date.getTime()) ? 0 : date.getTime();
};

/** Filter transactions to the last `timeRange` window, relative to the newest transaction. */
export const filterByTimeRange = (
  transactions: Transaction[],
  timeRange: TimeRange
): Transaction[] => {
  if (timeRange === 'all') return transactions;
  if (transactions.length === 0) return [];

  const timestamps = transactions.map((t) => getTimestamp(t.date)).filter((t) => t > 0);
  if (timestamps.length === 0) return transactions;

  const maxDate = Math.max(...timestamps);
  const msPerDay = 1000 * 60 * 60 * 24;

  let daysToSubtract = 0;
  if (timeRange === 'week') daysToSubtract = 7;
  if (timeRange === 'month') daysToSubtract = 30;

  const cutoff = maxDate - daysToSubtract * msPerDay;

  return transactions.filter((t) => getTimestamp(t.date) >= cutoff);
};

/** Human-readable min-max date span of the visible transactions. */
export const formatDateRange = (transactions: Transaction[]): string => {
  if (transactions.length === 0) return '';

  const timestamps = transactions
    .map((t) => {
      const d = safeNewDate(t.date);
      return d ? d.getTime() : NaN;
    })
    .filter((t) => !isNaN(t));

  if (timestamps.length === 0) return '';

  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);

  const format = (ts: number) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(ts));

  if (min === max) return format(min);
  return `${format(min)} - ${format(max)}`;
};

/** Derived counts and filtered views the Dashboard renders. */
export const useDashboardData = (timeRange: TimeRange) => {
  const { transactions, processedCount, totalToProcess } = useTransactionStore();

  const displayedTransactions = useMemo(
    () => filterByTimeRange(transactions, timeRange),
    [transactions, timeRange]
  );

  const dateRangeDisplay = useMemo(
    () => formatDateRange(displayedTransactions),
    [displayedTransactions]
  );

  const uncategorizedCount = transactions.filter(
    (t) => t.category === TransactionCategory.Uncategorized
  ).length;
  const failedCount = transactions.filter(
    (t) => t.reason?.includes('Failed') || t.reason?.includes('Error')
  ).length;
  const unapprovedCount = transactions.filter((t) => !t.isApproved).length;
  const progressPercent =
    totalToProcess > 0 ? Math.round((processedCount / totalToProcess) * 100) : 0;

  return {
    transactions,
    displayedTransactions,
    dateRangeDisplay,
    uncategorizedCount,
    failedCount,
    unapprovedCount,
    processedCount,
    totalToProcess,
    progressPercent,
  };
};

/** Guard an AI action so unconfigured users are routed to settings first. */
export const guarded =
  (isAIConfigured: boolean, onNavigate: (view: 'settings') => void) =>
  (run: () => Promise<void>) =>
  () => {
    if (!isAIConfigured) {
      onNavigate('settings');
      return;
    }
    void run();
  };
