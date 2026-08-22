import { useMemo, useState, useEffect } from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useSettingsStore, useAIReady } from '../../stores/useSettingsStore';
import { getPatterns, learnPattern } from '../../lib/localStorage';
import { checkFinancialHealth } from '../../services/alertService';
import { useToastStore, ToastType } from '../../stores/useToastStore';
import { Transaction } from '../../types';
import { useAIAnalysis, AnalysisStats } from './useAIAnalysis';
import { useDashboardData, guarded } from './useDashboardData';
import type { TimeRange, TabView } from './TimeFilterBar';

/** Alerts, AI-config state, and manual-add/rules handlers for the Dashboard. */
const useDashboardSetup = () => {
  const { transactions, isCategorizing, addTransactions, applyLocalPatterns, setError } =
    useTransactionStore();
  const { aiMode, isDemoMode, enableFunnyAlerts } = useSettingsStore();
  const aiReady = useAIReady();
  const { addToast } = useToastStore();

  // Run Alert Check on Mount or when transactions change significantly.
  // F-PERF-009: depend on the count, not the array identity — analysis batches
  // (`updateTransactionBatch`) swap the array ~200 times per run without
  // changing its length, and each swap re-armed this timer for nothing.
  const txCount = transactions.length;
  useEffect(() => {
    if (enableFunnyAlerts && txCount > 0 && !isCategorizing) {
      // Delay slightly to allow UI to settle
      const timer = setTimeout(() => {
        const alerts = checkFinancialHealth(useTransactionStore.getState().transactions);
        alerts.forEach((alert) => {
          addToast(alert.message, alert.type as ToastType, 6000);
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
    // `transactions` is read from the store inside the timer so the dep array
    // can stay coarse without reading a stale array.
  }, [txCount, isCategorizing, enableFunnyAlerts, addToast]);

  // Check if AI is configured or in demo mode — a single memoized read of the
  // shared selector (F-UX-007), no third hand-rolled definition.
  const isAIConfigured = useMemo(() => isDemoMode || aiReady, [isDemoMode, aiReady]);

  // Check if we have local patterns
  const hasPatterns = useMemo(() => {
    return getPatterns().length > 0;
    // Re-check when transactions change (implies potential learning)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  return {
    transactions,
    isCategorizing,
    aiMode,
    isAIConfigured,
    hasPatterns,
    applyLocalPatterns,
    addTransactions,
    setError,
  };
};

interface DashboardActionsDeps {
  setup: ReturnType<typeof useDashboardSetup>;
  setAnalysisStats: (s: AnalysisStats | null) => void;
  setIsAddModalOpen: (open: boolean) => void;
}

/** Rules-application and manual-add handlers. */
const useDashboardActions = ({
  setup,
  setAnalysisStats,
  setIsAddModalOpen,
}: DashboardActionsDeps) => {
  const handleApplyRules = () => {
    const count = setup.applyLocalPatterns();
    setAnalysisStats({
      total: setup.transactions.length, // Context: scanned all transactions
      changed: count,
      highConfidence: count, // Patterns represent high confidence
      mediumConfidence: 0,
      lowConfidence: 0,
      duration: 0.1,
    });
  };

  const handleManualAdd = (newTx: Transaction) => {
    setup.addTransactions([newTx]);
    // Learn from manual entry so future CSV imports of this description are categorized automatically
    learnPattern(newTx, newTx.category, newTx.subCategory);
    setIsAddModalOpen(false);
  };

  return { handleApplyRules, handleManualAdd };
};

/** Everything the Dashboard renders from: state, derived data, and handlers. */
export const useDashboardViewModel = (onNavigate: (view: 'settings' | 'upload') => void) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [activeTab, setActiveTab] = useState<TabView>('insights');
  const [analysisStats, setAnalysisStats] = useState<AnalysisStats | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const setup = useDashboardSetup();
  const data = useDashboardData(timeRange);
  const ai = useAIAnalysis(setup.aiMode, setAnalysisStats);
  const actions = useDashboardActions({ setup, setAnalysisStats, setIsAddModalOpen });

  return {
    timeRange,
    setTimeRange,
    activeTab,
    setActiveTab,
    analysisStats,
    setAnalysisStats,
    isAddModalOpen,
    setIsAddModalOpen,
    isAIConfigured: setup.isAIConfigured,
    hasPatterns: setup.hasPatterns,
    isCategorizing: setup.isCategorizing,
    data,
    withGuard: guarded(setup.isAIConfigured, onNavigate),
    handlers: { ...ai, ...actions },
  };
};
