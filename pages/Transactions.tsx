import React, { useMemo, useState } from 'react';
import { BookMarked, Plus, RefreshCcw, Settings as SettingsIcon, Wand2 } from 'lucide-react';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { QuickFilter, TransactionTable } from '../components/TransactionTable';
import { Button } from '../components/UI';
import { AI_PROVIDER_LABELS } from '../constants';
import { transactionsInPeriod } from '../lib/finance';
import { getPatterns } from '../lib/localStorage';
import { formatCurrency } from '../lib/utils';
import { useFinanceView, useSpendingAlerts } from '../lib/useFinance';
import {
  getTypesafeApiKey,
  useAIReady,
  useCategorizationReady,
  useSettingsStore,
} from '../stores/useSettingsStore';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useToastStore } from '../stores/useToastStore';
import { getDemoTransactions } from '../lib/demoData';
import { View } from '../types';
import { PeriodBar } from './shared/PeriodBar';
import {
  AnalysisProgressCard,
  AnalysisStatsPanel,
  ErrorBanner,
} from './transactions/AnalysisPanels';
import { EmptyState } from './transactions/EmptyState';
import { AnalysisStats, useAIAnalysis } from './transactions/useAIAnalysis';
import { guarded, summarizeTransactions } from './transactions/actions';

interface TransactionsProps {
  onNavigate: (view: View) => void;
}

/** Which categorizer will run — names the service the global actions below use. */
const CategorizerLine: React.FC<{ onNavigate: (view: View) => void }> = ({ onNavigate }) => {
  const settings = useSettingsStore();
  const aiReady = useAIReady();
  const typeSafeSet = !!getTypesafeApiKey({ typesafeConfig: settings.typesafeConfig });

  if (typeSafeSet) {
    return <span>Categorizing with TypeSafe Jev</span>;
  }
  if (aiReady) {
    return (
      <span>Categorizing with {AI_PROVIDER_LABELS[settings.aiMode]} (language-model fallback)</span>
    );
  }
  if (settings.isDemoMode) {
    return <span>Demo mode: simulated categorization</span>;
  }
  return (
    <span>
      Categorization not set up —{' '}
      <button
        type="button"
        onClick={() => onNavigate('settings')}
        className="font-medium text-accent underline-offset-2 hover:underline"
      >
        Configure in Settings
      </button>
    </span>
  );
};

const Transactions: React.FC<TransactionsProps> = ({ onNavigate }) => {
  const view = useFinanceView();
  const { model, ledger, period } = view;
  const currency = useSettingsStore((s) => s.currency);
  const aiMode = useSettingsStore((s) => s.aiMode);
  const isCategorizing = useTransactionStore((s) => s.isCategorizing);
  const {
    transactions,
    addTransactions,
    clearAll,
    error,
    setError,
    processedCount,
    totalToProcess,
    applyLocalPatterns,
  } = useTransactionStore();
  const categorizationReady = useCategorizationReady();
  const setDemoMode = useSettingsStore((s) => s.setDemoMode);
  const addToast = useToastStore((s) => s.addToast);

  const [analysisStats, setAnalysisStats] = useState<AnalysisStats | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  useSpendingAlerts(model);

  const fmt = (n: number) => formatCurrency(n, currency);

  const { handleInitialCategorize, handleReanalyzeAll, handleRetryFailed } = useAIAnalysis(
    aiMode,
    setAnalysisStats
  );

  const guard = guarded(categorizationReady, onNavigate);

  const counts = useMemo(() => summarizeTransactions(transactions), [transactions]);
  const hasPatterns = getPatterns().length > 0;

  const periodTransactions = useMemo(
    () => (period ? transactionsInPeriod(ledger, period) : []),
    [ledger, period]
  );

  const handleLoadDemo = () => {
    clearAll();
    setDemoMode(true);
    addTransactions(getDemoTransactions());
    addToast('Loaded demo data.', 'success');
  };

  if (transactions.length === 0) {
    return (
      <>
        <EmptyState
          onNavigate={onNavigate}
          onAddManually={() => setIsAddModalOpen(true)}
          onLoadDemo={handleLoadDemo}
          importedTransactions={transactions}
        />
        {isAddModalOpen && (
          <AddTransactionModal
            onClose={() => setIsAddModalOpen(false)}
            onSave={(tx) => {
              addTransactions([tx]);
              setIsAddModalOpen(false);
            }}
          />
        )}
      </>
    );
  }

  const quality = model?.summary.quality;
  const progressPercent =
    totalToProcess > 0 ? Math.round((processedCount / totalToProcess) * 100) : 0;

  return (
    <div className="space-y-6">
      <PeriodBar eyebrow="Transactions" view={view} />

      {model && (
        <p className="num -mt-2 text-sm text-ink-soft">
          {fmt(model.summary.totals.income)} in · {fmt(model.summary.totals.spending)} out
          {quality && quality.needsReviewCount > 0 && (
            <>
              {' '}
              ·{' '}
              <button
                type="button"
                onClick={() => setQuickFilter('needsReview')}
                className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning hover:bg-warning/20"
              >
                {quality.needsReviewCount} need review
              </button>
            </>
          )}
          {quality && quality.uncategorizedCount > 0 && (
            <>
              {' '}
              ·{' '}
              <button
                type="button"
                onClick={() => setQuickFilter('uncategorized')}
                className="rounded-full bg-line px-2 py-0.5 text-xs font-medium text-ink-soft hover:bg-line-strong"
              >
                {quality.uncategorizedCount} uncategorized
              </button>
            </>
          )}
        </p>
      )}

      {/* Global actions — these operate on ALL transactions, not the period. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {counts.uncategorizedCount > 0 ? (
            <Button
              onClick={guard(handleInitialCategorize)}
              disabled={isCategorizing}
              title={`Categorizes all ${counts.uncategorizedCount} uncategorized transactions (all periods)`}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Categorize {counts.uncategorizedCount} pending
            </Button>
          ) : counts.reanalyzableCount > 0 ? (
            <Button
              variant="outline"
              onClick={guard(handleReanalyzeAll)}
              disabled={isCategorizing}
              title={`Re-analyzes all ${counts.reanalyzableCount} unapproved transactions (all periods)`}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Re-analyze {counts.reanalyzableCount}
            </Button>
          ) : null}

          {counts.failedCount > 0 && (
            <Button
              variant="outline"
              onClick={guard(handleRetryFailed)}
              disabled={isCategorizing}
              title={`Retries the ${counts.failedCount} transactions that failed (all periods)`}
            >
              Retry {counts.failedCount} failed
            </Button>
          )}

          {hasPatterns && (
            <Button
              variant="outline"
              onClick={() => {
                const applied = applyLocalPatterns();
                addToast(
                  applied > 0
                    ? `Applied rules to ${applied} transactions.`
                    : 'No transactions matched your rules.',
                  applied > 0 ? 'success' : 'info'
                );
              }}
              title="Applies your learned rules to all transactions (all periods)"
            >
              <BookMarked className="mr-2 h-4 w-4" />
              Apply rules
            </Button>
          )}

          <Button variant="ghost" onClick={() => setIsAddModalOpen(true)} className="ml-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add transaction
          </Button>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted">
          <SettingsIcon className="h-3 w-3" aria-hidden="true" />
          <CategorizerLine onNavigate={onNavigate} />
          <span className="text-muted/70">· actions apply to all data</span>
        </p>
      </div>

      {error && (
        <ErrorBanner
          error={error}
          onDismiss={() => setError(null)}
          onOpenSettings={() => onNavigate('settings')}
        />
      )}
      {isCategorizing && (
        <AnalysisProgressCard
          processedCount={processedCount}
          totalToProcess={totalToProcess}
          progressPercent={progressPercent}
        />
      )}
      {analysisStats && !isCategorizing && (
        <AnalysisStatsPanel stats={analysisStats} onDismiss={() => setAnalysisStats(null)} />
      )}

      <TransactionTable
        transactions={periodTransactions}
        quickFilter={quickFilter}
        onQuickFilterChange={setQuickFilter}
      />

      {isAddModalOpen && (
        <AddTransactionModal
          onClose={() => setIsAddModalOpen(false)}
          onSave={(tx) => {
            addTransactions([tx]);
            setIsAddModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default Transactions;
