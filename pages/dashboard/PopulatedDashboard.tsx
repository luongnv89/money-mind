import React from 'react';
import { DashboardToolbar } from './DashboardToolbar';
import { AnalysisStatsPanel, ErrorBanner } from './DashboardPanels';
import { DashboardContent } from './DashboardContent';
import type { useDashboardViewModel } from './useDashboardViewModel';
import type { AnalysisStats } from './useAIAnalysis';

type Vm = ReturnType<typeof useDashboardViewModel>;

interface BannerProps {
  error: string | null;
  onDismiss: () => void;
  onOpenSettings: () => void;
}

const Banner: React.FC<BannerProps> = ({ error, onDismiss, onOpenSettings }) =>
  error ? (
    <ErrorBanner error={error} onDismiss={onDismiss} onOpenSettings={onOpenSettings} />
  ) : null;

const Stats: React.FC<{ stats: AnalysisStats | null; onDismiss: () => void }> = ({
  stats,
  onDismiss,
}) => (stats ? <AnalysisStatsPanel stats={stats} onDismiss={onDismiss} /> : null);

const Toolbar: React.FC<{ vm: Vm; onOpenSettings: () => void }> = ({ vm, onOpenSettings }) => {
  const { data, handlers } = vm;
  return (
    <DashboardToolbar
      transactionCount={data.transactions.length}
      isCategorizing={vm.isCategorizing}
      processedCount={data.processedCount}
      totalToProcess={data.totalToProcess}
      progressPercent={data.progressPercent}
      actionsProps={{
        isAIConfigured: vm.isAIConfigured,
        hasPatterns: vm.hasPatterns,
        uncategorizedCount: data.uncategorizedCount,
        failedCount: data.failedCount,
        unapprovedCount: data.unapprovedCount,
        onAdd: () => vm.setIsAddModalOpen(true),
        onRetryFailed: vm.withGuard(handlers.handleRetryFailed),
        onApplyRules: handlers.handleApplyRules,
        onInitialCategorize: vm.withGuard(handlers.handleInitialCategorize),
        onReanalyzeAll: vm.withGuard(handlers.handleReanalyzeAll),
        onOpenSettings,
      }}
    />
  );
};

export interface PopulatedDashboardProps {
  vm: Vm;
  error: string | null;
  onDismissError: () => void;
  onOpenSettings: () => void;
}

/** The populated Dashboard layout once transactions exist. */
export const PopulatedDashboard: React.FC<PopulatedDashboardProps> = ({
  vm,
  error,
  onDismissError,
  onOpenSettings,
}) => {
  const { data, handlers } = vm;

  return (
    <DashboardContent
      activeTab={vm.activeTab}
      onTabChange={vm.setActiveTab}
      timeRange={vm.timeRange}
      dateRangeDisplay={data.dateRangeDisplay}
      onTimeRangeChange={vm.setTimeRange}
      transactions={data.transactions}
      displayedTransactions={data.displayedTransactions}
      toolbar={<Toolbar vm={vm} onOpenSettings={onOpenSettings} />}
      banner={<Banner error={error} onDismiss={onDismissError} onOpenSettings={onOpenSettings} />}
      statsPanel={<Stats stats={vm.analysisStats} onDismiss={() => vm.setAnalysisStats(null)} />}
      isAddModalOpen={vm.isAddModalOpen}
      onCloseModal={() => vm.setIsAddModalOpen(false)}
      onManualAdd={handlers.handleManualAdd}
    />
  );
};
