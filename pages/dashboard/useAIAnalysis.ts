import { Transaction, TransactionCategory, AIMode } from '../../types';
import { categorizeWithAI } from '../../services/aiService';
import { useTransactionStore } from '../../stores/useTransactionStore';

export interface AnalysisStats {
  total: number;
  changed: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  duration: number;
}

/** Shape of a single AI categorization result chunk (mirrors aiService). */
interface CategorizationResult {
  id: string;
  category: string;
  subCategory?: string;
  confidence: number;
  reason: string;
}

/** Count results whose category or subcategory actually changed vs the store. */
const countChanges = (results: CategorizationResult[]): number => {
  const currentStore = useTransactionStore.getState().transactions;
  return results.filter((res) => {
    const original = currentStore.find((t) => t.id === res.id);
    return (
      original && (original.category !== res.category || original.subCategory !== res.subCategory)
    );
  }).length;
};

/** Merge AI results into full Transaction updates for batch commit. */
const toUpdates = (results: CategorizationResult[]): Transaction[] => {
  const currentStore = useTransactionStore.getState().transactions;
  return results
    .map((res) => {
      const original = currentStore.find((t) => t.id === res.id);
      if (!original) return null;
      return {
        ...original,
        category: res.category,
        subCategory: res.subCategory, // Ensure subCategory is passed
        confidence: res.confidence,
        reason: res.reason,
      };
    })
    .filter(Boolean) as Transaction[];
};

/** Summarize confidence bands for the processed transactions. */
const summarizeStats = (
  processed: Transaction[],
  changesDetected: number,
  duration: number
): AnalysisStats => ({
  total: processed.length,
  changed: changesDetected,
  highConfidence: processed.filter((t) => t.confidence >= 0.8).length,
  mediumConfidence: processed.filter((t) => t.confidence >= 0.5 && t.confidence < 0.8).length,
  lowConfidence: processed.filter((t) => t.confidence < 0.5).length,
  duration,
});

export interface UseAIAnalysisResult {
  performAIAnalysis: (transactionsToProcess: Transaction[]) => Promise<void>;
  handleInitialCategorize: () => Promise<void>;
  handleReanalyzeAll: () => Promise<void>;
  handleRetryFailed: () => Promise<void>;
}

interface RunAnalysisDeps {
  aiMode: AIMode;
  setAnalysisStats: (stats: AnalysisStats | null) => void;
  setCategorizing: (v: boolean) => void;
  updateTransactionBatch: (txs: Transaction[]) => void;
  setError: (e: string | null) => void;
  setProgressCounts: (processed: number, total: number) => void;
}

/** Run the full AI categorization pass with progress and final stats. */
const runAnalysis = async (
  transactionsToProcess: Transaction[],
  deps: RunAnalysisDeps
): Promise<void> => {
  const {
    aiMode,
    setAnalysisStats,
    setCategorizing,
    updateTransactionBatch,
    setError,
    setProgressCounts,
  } = deps;
  setCategorizing(true);
  setAnalysisStats(null);
  setError(null); // Clear previous errors
  setProgressCounts(0, transactionsToProcess.length);
  const startTime = Date.now();
  let changesDetected = 0;

  try {
    await categorizeWithAI(transactionsToProcess, aiMode, (results) => {
      // 1. Calculate changes before updating
      changesDetected += countChanges(results);

      // 2. Prepare updates
      const updates = toUpdates(results);

      // 3. Commit updates
      updateTransactionBatch(updates);
      const currentProcessed = useTransactionStore.getState().processedCount;
      setProgressCounts(currentProcessed + results.length, transactionsToProcess.length);
    });

    // Calculate final stats after completion
    const duration = (Date.now() - startTime) / 1000;
    const currentTransactions = useTransactionStore.getState().transactions;
    const processedIds = new Set(transactionsToProcess.map((t) => t.id));

    // Get the updated versions of the processed transactions
    const processed = currentTransactions.filter((t) => processedIds.has(t.id));

    if (processed.length > 0) {
      setAnalysisStats(summarizeStats(processed, changesDetected, duration));
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      setError(e.message);
    } else {
      setError(String(e));
    }
  } finally {
    setCategorizing(false);
    setProgressCounts(0, 0);
  }
};

/** Select which transactions each Dashboard action re-processes. */
const selectTargets = (transactions: Transaction[], kind: 'initial' | 'reanalyze' | 'retry') => {
  if (kind === 'initial') {
    return transactions.filter((t) => t.category === TransactionCategory.Uncategorized);
  }
  if (kind === 'reanalyze') {
    // Re-analyze everything that is NOT explicitly approved
    return transactions.filter((t) => !t.isApproved);
  }
  // Retry transactions that have an explicit error or are uncategorized with an error reason
  return transactions.filter((t) => t.reason?.includes('Failed') || t.reason?.includes('Error'));
};

/** AI analysis orchestration: batching, progress, and stats for the Dashboard. */
export const useAIAnalysis = (
  aiMode: AIMode,
  setAnalysisStats: (stats: AnalysisStats | null) => void
): UseAIAnalysisResult => {
  const { transactions, setCategorizing, updateTransactionBatch, setError, setProgressCounts } =
    useTransactionStore();

  const performAIAnalysis = (toProcess: Transaction[]) =>
    runAnalysis(toProcess, {
      aiMode,
      setAnalysisStats,
      setCategorizing,
      updateTransactionBatch,
      setError,
      setProgressCounts,
    });

  const runFiltered = async (kind: 'initial' | 'reanalyze' | 'retry') => {
    const toProcess = selectTargets(transactions, kind);
    if (toProcess.length === 0) return;
    await performAIAnalysis(toProcess);
  };

  return {
    performAIAnalysis,
    handleInitialCategorize: () => runFiltered('initial'),
    handleReanalyzeAll: () => runFiltered('reanalyze'),
    handleRetryFailed: () => runFiltered('retry'),
  };
};
