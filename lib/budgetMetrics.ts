import { Transaction, TransactionCategory } from '../types';
import { safeNewDate } from './utils';

export interface BudgetMetrics {
  current: { mustHave: number; niceToHave: number; savings: number };
  average: { mustHave: number; niceToHave: number; savings: number };
  monthLabel: string;
}

/**
 * Current-month budget totals vs historical monthly averages.
 * The filtered `transactions` prop drives the "current month" side (so the
 * Dashboard time filter applies to this card); `allTransactions` supplies the
 * historical baseline. Falls back to the full history when no filter matches.
 */
export const computeBudgetMetrics = (
  transactions: Transaction[],
  allTransactions: Transaction[]
): BudgetMetrics | null => {
  if (allTransactions.length === 0) return null;

  // The filtered view defines the current month; fall back to all data when empty.
  const scopedTx = transactions.length > 0 ? transactions : allTransactions;

  // A. Setup Dates
  const validTxs = scopedTx.filter((t) => !!safeNewDate(t.date));
  if (validTxs.length === 0) return null;

  const sortedTx = [...validTxs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const latestDateStr = sortedTx[sortedTx.length - 1].date;

  // If no transactions, fallback
  const currentMonthKey = latestDateStr
    ? latestDateStr.substring(0, 7)
    : new Date().toISOString().substring(0, 7);

  // B. Grouping Helper
  const calculateTotals = (txs: Transaction[]) => {
    return txs.reduce(
      (acc, t) => {
        const amt = Math.abs(t.amount);
        if (t.category === TransactionCategory.MustHave) acc.mustHave += amt;
        else if (t.category === TransactionCategory.NiceToHave) acc.niceToHave += amt;
        else if (
          t.category === TransactionCategory.Save ||
          t.category === TransactionCategory.Invest
        )
          acc.savings += amt;
        return acc;
      },
      { mustHave: 0, niceToHave: 0, savings: 0 }
    );
  };

  // C. Current Month Totals
  const currentMonthTx = scopedTx.filter((t) => t.date.startsWith(currentMonthKey));
  const currentTotals = calculateTotals(currentMonthTx);

  // D. Historical Averages
  const historyTx = allTransactions.filter((t) => !t.date.startsWith(currentMonthKey));
  const historyMonths = new Set(historyTx.map((t) => t.date.substring(0, 7))).size;

  let averages = { mustHave: 0, niceToHave: 0, savings: 0 };

  if (historyMonths > 0) {
    const historyTotals = calculateTotals(historyTx);
    averages.mustHave = historyTotals.mustHave / historyMonths;
    averages.niceToHave = historyTotals.niceToHave / historyMonths;
    averages.savings = historyTotals.savings / historyMonths;
  } else {
    averages = currentTotals;
  }

  return {
    current: currentTotals,
    average: averages,
    monthLabel: (() => {
      const d = safeNewDate(currentMonthKey + '-02');
      return d ? d.toLocaleString('default', { month: 'long', year: 'numeric' }) : currentMonthKey;
    })(),
  };
};
