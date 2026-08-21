import React from 'react';
import { AlertOctagon, Plus } from 'lucide-react';
import { Button } from '../../components/UI';
import { AddTransactionModal } from '../../components/AddTransactionModal';
import { Transaction } from '../../types';

export interface EmptyStateProps {
  isAddModalOpen: boolean;
  onOpenModal: () => void;
  onCloseModal: () => void;
  onNavigate: (view: 'settings' | 'upload' | 'dashboard') => void;
  onManualAdd: (tx: Transaction) => void;
}

/** Zero-transactions placeholder with upload / manual-add entry points. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  isAddModalOpen,
  onOpenModal,
  onCloseModal,
  onNavigate,
  onManualAdd,
}) => (
  <div className="text-center py-20 animate-in fade-in duration-500">
    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <AlertOctagon className="w-8 h-8 text-gray-400" />
    </div>
    <h3 className="text-lg font-medium text-gray-900">No transactions yet</h3>
    <p className="text-gray-500 mt-2 max-w-sm mx-auto">
      Upload a bank statement or add a transaction to get started.
    </p>
    <div className="flex gap-3 justify-center mt-6">
      <Button onClick={() => onNavigate('upload')}>Upload File</Button>
      <Button variant="outline" onClick={onOpenModal}>
        <Plus className="w-4 h-4 mr-2" />
        Add Manually
      </Button>
    </div>
    {isAddModalOpen && <AddTransactionModal onClose={onCloseModal} onSave={onManualAdd} />}
  </div>
);
