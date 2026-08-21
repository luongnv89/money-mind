import React from 'react';
import { BookOpen, Plus, RefreshCw, RotateCcw, Settings, Zap } from 'lucide-react';
import { Button } from '../../components/UI';

export interface DashboardHeaderActionsProps {
  isAIConfigured: boolean;
  hasPatterns: boolean;
  uncategorizedCount: number;
  failedCount: number;
  unapprovedCount: number;
  onAdd: () => void;
  onRetryFailed: () => void;
  onApplyRules: () => void;
  onInitialCategorize: () => void;
  onReanalyzeAll: () => void;
  onOpenSettings: () => void;
}

const DashboardHeaderActions: React.FC<DashboardHeaderActionsProps> = ({
  isAIConfigured,
  hasPatterns,
  uncategorizedCount,
  failedCount,
  unapprovedCount,
  onAdd,
  onRetryFailed,
  onApplyRules,
  onInitialCategorize,
  onReanalyzeAll,
  onOpenSettings,
}) => (
  <div className="flex flex-col items-end gap-1.5">
    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
      {/* New Add Button */}
      <Button variant="outline" onClick={onAdd} className="border-gray-300">
        <Plus className="w-4 h-4 mr-2" />
        Add
      </Button>

      {/* Retry Failed Button */}
      {failedCount > 0 && (
        <Button
          onClick={onRetryFailed}
          size="lg"
          variant="outline"
          className="border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Retry {failedCount} Failed
        </Button>
      )}

      {/* Apply Rules Button */}
      {hasPatterns && unapprovedCount > 0 && (
        <Button
          onClick={onApplyRules}
          size="lg"
          variant="outline"
          className="border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
          title="Apply learned rules to unverified transactions"
        >
          <BookOpen className="w-4 h-4 mr-2" />
          Apply Rules
        </Button>
      )}

      {/* Main Analyze Buttons */}
      {uncategorizedCount > 0 ? (
        <Button
          onClick={onInitialCategorize}
          size="lg"
          className="shadow-lg shadow-accent/20"
          variant={isAIConfigured ? 'primary' : 'secondary'}
        >
          <Zap className="w-4 h-4 mr-2 fill-current" />
          Analyze {uncategorizedCount} Pending
        </Button>
      ) : unapprovedCount > 0 ? (
        <Button
          onClick={onReanalyzeAll}
          size="lg"
          variant="outline"
          className="border-gray-300 text-gray-700 hover:bg-gray-50"
          title="Re-analyze all unapproved transactions"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Re-analyze
        </Button>
      ) : null}

      {!isAIConfigured && (
        <Button
          onClick={onOpenSettings}
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-100"
        >
          <Settings className="w-4 h-4 mr-2" />
          Config AI
        </Button>
      )}
    </div>

    {!isAIConfigured && (
      <span className="text-[10px] text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded border border-gray-100">
        Configure AI to enable automatic categorization &amp; analysis
      </span>
    )}
  </div>
);

export interface DashboardHeaderProps {
  transactionCount: number;
  isCategorizing: boolean;
  progress: React.ReactNode;
  actions: React.ReactNode;
}

/** Page header: title plus either the progress card or the action buttons. */
export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  transactionCount,
  isCategorizing,
  progress,
  actions,
}) => (
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Financial Intelligence</h2>
      <p className="text-sm text-gray-500">{transactionCount} transactions loaded</p>
    </div>

    {/* Action Area */}
    {isCategorizing ? progress : actions}
  </div>
);

export default DashboardHeaderActions;
