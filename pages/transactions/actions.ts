import { Transaction, TransactionCategory, View } from '../../types';

/** Status counts over ALL transactions — the toolbar actions are global, not period-scoped. */
export interface TransactionCounts {
  uncategorizedCount: number;
  failedCount: number;
  unapprovedCount: number;
  /** Rows eligible for re-analysis: not user-approved and not learned-rule derived. */
  reanalyzableCount: number;
}

export const summarizeTransactions = (transactions: Transaction[]): TransactionCounts =>
  transactions.reduce(
    (counts, t) => {
      if (t.category === TransactionCategory.Uncategorized) counts.uncategorizedCount++;
      if (t.reason?.includes('Failed') || t.reason?.includes('Error')) counts.failedCount++;
      if (!t.isApproved) counts.unapprovedCount++;
      if (!t.isApproved && !t.isLearned) counts.reanalyzableCount++;
      return counts;
    },
    { uncategorizedCount: 0, failedCount: 0, unapprovedCount: 0, reanalyzableCount: 0 }
  );

/** Guard an AI action so unconfigured users are routed to settings first. */
export const guarded =
  (isConfigured: boolean, onNavigate: (view: View) => void) => (run: () => Promise<void>) => () => {
    if (!isConfigured) {
      onNavigate('settings');
      return;
    }
    void run();
  };
