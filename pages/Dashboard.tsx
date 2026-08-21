import React from 'react';
import { useTransactionStore } from '../stores/useTransactionStore';
import { EmptyState } from './dashboard/EmptyState';
import { PopulatedDashboard } from './dashboard/PopulatedDashboard';
import { useDashboardViewModel } from './dashboard/useDashboardViewModel';

interface DashboardProps {
  onNavigate: (view: 'settings' | 'upload' | 'dashboard') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const vm = useDashboardViewModel(onNavigate);
  const { error, setError } = useTransactionStore();

  if (vm.data.transactions.length === 0) {
    return (
      <EmptyState
        isAddModalOpen={vm.isAddModalOpen}
        onOpenModal={() => vm.setIsAddModalOpen(true)}
        onCloseModal={() => vm.setIsAddModalOpen(false)}
        onNavigate={onNavigate}
        onManualAdd={vm.handlers.handleManualAdd}
      />
    );
  }

  return (
    <PopulatedDashboard
      vm={vm}
      error={error}
      onDismissError={() => setError(null)}
      onOpenSettings={() => onNavigate('settings')}
    />
  );
};
