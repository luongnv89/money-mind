import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Transaction, TransactionCategory } from '../types';
import { learnPattern, applyPatterns } from '../lib/localStorage';
import { createThrottledStorage } from '../lib/throttledStorage';

// F-PERF-001: `persist` re-serialized the whole transaction array on every
// `set()` — one synchronous localStorage write per analysis batch (~200 across
// a 200-batch run at 5,000 rows). Throttle to one write per second; the
// trailing edge coalesces bursts and `pagehide` flushes anything pending.
const PERSIST_WRITE_INTERVAL_MS = 1000;
export const transactionStorage = createThrottledStorage(PERSIST_WRITE_INTERVAL_MS);

interface TransactionState {
  transactions: Transaction[];
  isParsing: boolean;
  isCategorizing: boolean;
  error: string | null;

  // Progress tracking
  processedCount: number;
  totalToProcess: number;

  setTransactions: (transactions: Transaction[]) => void;
  addTransactions: (transactions: Transaction[]) => void;
  deleteTransaction: (id: string) => void;

  // New action for real-time updates
  updateTransactionBatch: (updates: Transaction[]) => void;

  updateCategory: (id: string, category: TransactionCategory, subCategory?: string) => void;
  bulkUpdateCategory: (ids: string[], category: TransactionCategory, subCategory?: string) => void;
  approveTransaction: (id: string) => void;
  applyLocalPatterns: () => number; // Returns count of changes

  setParsing: (status: boolean) => void;
  setCategorizing: (status: boolean) => void;
  setProgressCounts: (processed: number, total: number) => void;
  setError: (error: string | null) => void;
  clearAll: () => void;
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: [],
      isParsing: false,
      isCategorizing: false,
      error: null,
      processedCount: 0,
      totalToProcess: 0,

      setTransactions: (transactions) => set({ transactions, error: null }),

      addTransactions: (newTransactions) =>
        set((state) => ({
          transactions: [...state.transactions, ...newTransactions],
          error: null,
        })),

      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        })),

      updateTransactionBatch: (updates) =>
        set((state) => {
          const updateMap = new Map(updates.map((u) => [u.id, u]));
          const newTransactions = state.transactions.map((t) =>
            updateMap.has(t.id) ? updateMap.get(t.id)! : t
          );
          return { transactions: newTransactions };
        }),

      updateCategory: (id, category, subCategory) => {
        const { transactions } = get();
        const targetTx = transactions.find((t) => t.id === id);
        if (!targetTx) return;

        learnPattern(targetTx, category, subCategory);

        const newTransactions = transactions.map((t) => {
          // The manually updated transaction
          if (t.id === id) {
            return {
              ...t,
              category,
              subCategory,
              isLearned: true,
              isApproved: true, // Manual update automatically approves
              confidence: 1.0,
              reason: 'Manual correction',
            };
          }

          // Automatically apply to same description
          if (t.description === targetTx.description) {
            return {
              ...t,
              category,
              subCategory,
              isLearned: true,
              isApproved: false, // Keep in waiting status (Verify button visible)
              confidence: 0.9,
              reason: 'Matched similar transaction',
            };
          }

          return t;
        });

        set({ transactions: newTransactions });
      },

      bulkUpdateCategory: (ids, category, subCategory) => {
        const { transactions } = get();
        const firstTx = transactions.find((t) => ids.includes(t.id));
        if (firstTx) learnPattern(firstTx, category, subCategory);

        const newTransactions = transactions.map((tx) => {
          if (ids.includes(tx.id)) {
            return {
              ...tx,
              category,
              subCategory,
              isLearned: true,
              isApproved: true, // Bulk update automatically approves
              confidence: 1.0,
              reason: 'Bulk correction',
            };
          }
          return tx;
        });
        set({ transactions: newTransactions });
      },

      approveTransaction: (id: string) => {
        const { transactions } = get();
        const tx = transactions.find((t) => t.id === id);

        if (tx) {
          // Approving means the current category is correct, so we learn it
          learnPattern(tx, tx.category, tx.subCategory);
        }

        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, isApproved: true, isLearned: true, confidence: 1.0 } : t
          ),
        }));
      },

      applyLocalPatterns: () => {
        let count = 0;
        set((state) => {
          const result = applyPatterns(state.transactions);
          count = result.appliedCount;
          return { transactions: result.transactions };
        });
        return count;
      },

      setParsing: (status) => set({ isParsing: status }),
      setCategorizing: (status) => set({ isCategorizing: status }),
      setProgressCounts: (processed, total) =>
        set({ processedCount: processed, totalToProcess: total }),
      setError: (error) => set({ error }),

      clearAll: () => {
        set({ transactions: [], error: null, processedCount: 0, totalToProcess: 0 });
      },
    }),
    {
      name: 'moneymind-transactions',
      storage: createJSONStorage(() => transactionStorage),
      partialize: (state) => ({ transactions: state.transactions }),
    }
  )
);
