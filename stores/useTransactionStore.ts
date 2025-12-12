import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Transaction, TransactionCategory } from '../types';
import { learnPattern, clearPatterns } from '../lib/localStorage';

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
  
  // New action for real-time updates
  updateTransactionBatch: (updates: Transaction[]) => void;
  
  updateCategory: (id: string, category: TransactionCategory) => void;
  bulkUpdateCategory: (ids: string[], category: TransactionCategory) => void;
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
      
      addTransactions: (newTransactions) => set((state) => ({ 
          transactions: [...state.transactions, ...newTransactions],
          error: null 
      })),

      // efficiently updates a batch of transactions by ID
      updateTransactionBatch: (updates) => set((state) => {
        const updateMap = new Map(updates.map(u => [u.id, u]));
        const newTransactions = state.transactions.map(t => 
            updateMap.has(t.id) ? updateMap.get(t.id)! : t
        );
        return { transactions: newTransactions };
      }),
      
      updateCategory: (id, category) => {
        const { transactions } = get();
        const txIndex = transactions.findIndex(t => t.id === id);
        if (txIndex === -1) return;

        const tx = transactions[txIndex];
        learnPattern(tx, category);

        const newTransactions = [...transactions];
        newTransactions[txIndex] = { ...tx, category, isLearned: true, confidence: 1.0, reason: 'Manual correction' };
        set({ transactions: newTransactions });
      },

      bulkUpdateCategory: (ids, category) => {
        const { transactions } = get();
        const firstTx = transactions.find(t => ids.includes(t.id));
        if (firstTx) learnPattern(firstTx, category);

        const newTransactions = transactions.map(tx => {
          if (ids.includes(tx.id)) {
            return { ...tx, category, isLearned: true, confidence: 1.0, reason: 'Bulk correction' };
          }
          return tx;
        });
        set({ transactions: newTransactions });
      },

      setParsing: (status) => set({ isParsing: status }),
      setCategorizing: (status) => set({ isCategorizing: status }),
      setProgressCounts: (processed, total) => set({ processedCount: processed, totalToProcess: total }),
      setError: (error) => set({ error }),
      
      clearAll: () => {
        if(confirm('Are you sure you want to clear all data? This does not delete learned patterns.')) {
            set({ transactions: [], error: null, processedCount: 0, totalToProcess: 0 });
        }
      }
    }),
    {
      name: 'moneymind-transactions',
      partialize: (state) => ({ transactions: state.transactions }), // Only persist transactions
    }
  )
);