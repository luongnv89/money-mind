import { Transaction, TransactionCategory } from '../types';
import { formatCurrency } from './utils';

/** The number of most-recent transactions included in the chat context. */
export const RECENT_CONTEXT_TX_COUNT = 5;

/** Pick the most recent transactions by date (newest first), not input order. */
export const selectRecentTransactions = (txs: Transaction[], count: number): Transaction[] =>
  [...txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, count);

/** Build the financial context string handed to the chat agent (issue #37, F-BUG-010). */
export const buildFinancialContext = (txs: Transaction[]) => {
  if (txs.length === 0) return 'No transaction data available.';

  // Find the latest date in the dataset to determine the "Current Month" context
  // This ensures that if the data is from 2023, we analyze 2023, not today's empty month.
  const sortedTxs = [...txs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const latestDate = sortedTxs[0].date;
  const currentMonthPrefix = latestDate.slice(0, 7); // YYYY-MM

  const monthlyTx = txs.filter((t) => t.date.startsWith(currentMonthPrefix));

  const income = monthlyTx.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const expenses = monthlyTx
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const niceToHave = monthlyTx
    .filter((t) => t.category === TransactionCategory.NiceToHave)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const waste = monthlyTx
    .filter((t) => t.category === TransactionCategory.Waste)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Group expenses by category
  const byCat: Record<string, number> = {};
  monthlyTx
    .filter((t) => t.amount < 0)
    .forEach((t) => {
      byCat[t.category] = (byCat[t.category] || 0) + Math.abs(t.amount);
    });

  const topCategories = Object.entries(byCat)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat, amt]) => `${cat}: ${formatCurrency(amt)}`)
    .join(', ');

  // Calculate All-Time stats for broader context
  const allTimeIncome = txs.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const allTimeExpenses = txs
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const netWorthProxy = allTimeIncome - allTimeExpenses; // Crude approximation within dataset

  return `
        CONTEXT PERIOD: ${currentMonthPrefix} (Most recent data available)

        MONTHLY SNAPSHOT (${currentMonthPrefix}):
        - Total Income: ${formatCurrency(income)}
        - Total Expenses: ${formatCurrency(expenses)}
        - Net Balance: ${formatCurrency(income - expenses)}
        - 'Nice-to-Have' Spend: ${formatCurrency(niceToHave)}
        - 'Waste' Spend: ${formatCurrency(waste)}
        - Top Categories: ${topCategories}
        - Transaction Count: ${monthlyTx.length}

        RECENT TRANSACTIONS (Last ${RECENT_CONTEXT_TX_COUNT}):
        ${selectRecentTransactions(monthlyTx, RECENT_CONTEXT_TX_COUNT)
          .map((t) => `- ${t.date}: ${t.description} (${formatCurrency(t.amount)}) [${t.category}]`)
          .join('\n')}

        ALL-TIME DATA (${txs.length} txs total):
        - Total Inflow: ${formatCurrency(allTimeIncome)}
        - Total Outflow: ${formatCurrency(allTimeExpenses)}
        - Calculated Net (Inflow - Outflow): ${formatCurrency(netWorthProxy)}
        `;
};
