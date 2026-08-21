import React from 'react';
import DashboardHeaderActions, { DashboardHeader } from './DashboardHeader';
import { AnalysisProgressCard } from './DashboardPanels';

export interface DashboardToolbarProps {
  transactionCount: number;
  isCategorizing: boolean;
  processedCount: number;
  totalToProcess: number;
  progressPercent: number;
  actionsProps: React.ComponentProps<typeof DashboardHeaderActions>;
}

/** Page header with the analysis progress card or the action buttons. */
export const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
  transactionCount,
  isCategorizing,
  processedCount,
  totalToProcess,
  progressPercent,
  actionsProps,
}) => (
  <DashboardHeader
    transactionCount={transactionCount}
    isCategorizing={isCategorizing}
    progress={
      <AnalysisProgressCard
        processedCount={processedCount}
        totalToProcess={totalToProcess}
        progressPercent={progressPercent}
      />
    }
    actions={<DashboardHeaderActions {...actionsProps} />}
  />
);
