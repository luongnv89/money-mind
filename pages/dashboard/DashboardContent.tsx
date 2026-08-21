import React from 'react';
import { TransactionTable } from '../../components/TransactionTable';
import { InsightsDashboard, MonthlyPerformance } from '../../components/InsightsDashboard';
import { FinancialScoreCard } from '../../components/FinancialScoreCard';
import { AddTransactionModal } from '../../components/AddTransactionModal';
import { Transaction } from '../../types';
import { TimeFilterBar, DashboardTabs, TimeRange, TabView } from './TimeFilterBar';

export interface TabContentProps {
  activeTab: TabView;
  transactions: Transaction[];
  displayedTransactions: Transaction[];
}

/** Insights vs transactions tab bodies. */
const TabContent: React.FC<TabContentProps> = ({
  activeTab,
  transactions,
  displayedTransactions,
}) => {
  if (activeTab !== 'insights') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Transaction List
            <span className="text-gray-400 text-sm font-normal ml-2">
              ({displayedTransactions.length} visible)
            </span>
          </h3>
        </div>
        <TransactionTable transactions={displayedTransactions} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <MonthlyPerformance transactions={displayedTransactions} allTransactions={transactions} />
      <FinancialScoreCard transactions={transactions} />
      <InsightsDashboard transactions={displayedTransactions} allTransactions={transactions} />
    </div>
  );
};

export interface DashboardBodyProps extends TabContentProps {
  timeRange: TimeRange;
  dateRangeDisplay: string;
  onTimeRangeChange: (range: TimeRange) => void;
  onTabChange: (tab: TabView) => void;
  toolbar: React.ReactNode;
  banner: React.ReactNode;
  statsPanel: React.ReactNode;
  isAddModalOpen: boolean;
  onCloseModal: () => void;
  onManualAdd: (tx: Transaction) => void;
}

/** The populated Dashboard layout: toolbar, banners, tabs, filter, content, modal. */
export const DashboardContent: React.FC<DashboardBodyProps> = ({
  activeTab,
  transactions,
  displayedTransactions,
  timeRange,
  dateRangeDisplay,
  onTimeRangeChange,
  onTabChange,
  toolbar,
  banner,
  statsPanel,
  isAddModalOpen,
  onCloseModal,
  onManualAdd,
}) => (
  <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
    {toolbar}

    {/* Error Message for Budget Limits */}
    {banner}

    {/* Analysis Stats Summary */}
    {statsPanel}

    {/* Tabs */}
    <DashboardTabs activeTab={activeTab} onTabChange={onTabChange} />

    {/* Time Filter Controls */}
    <TimeFilterBar
      timeRange={timeRange}
      dateRangeDisplay={dateRangeDisplay}
      onTimeRangeChange={onTimeRangeChange}
    />

    {/* Content Area */}
    <TabContent
      activeTab={activeTab}
      transactions={transactions}
      displayedTransactions={displayedTransactions}
    />

    {isAddModalOpen && <AddTransactionModal onClose={onCloseModal} onSave={onManualAdd} />}
  </div>
);
