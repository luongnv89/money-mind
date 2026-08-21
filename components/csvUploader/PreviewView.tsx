import React from 'react';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '../UI';
import { cn } from '../../lib/utils';
import { Transaction } from '../../types';
import { DuplicateTransaction } from './dedupe';
import { DuplicateResolutionModal } from './DuplicateResolutionModal';
import { PreviewTable } from './PreviewTable';

export const ITEMS_PER_PAGE = 10;

export type PreviewTab = 'new' | 'duplicates';

interface PreviewTabsProps {
  activeTab: PreviewTab;
  newCount: number;
  duplicateCount: number;
  onSelect: (tab: PreviewTab) => void;
}

const PreviewTabs: React.FC<PreviewTabsProps> = ({
  activeTab,
  newCount,
  duplicateCount,
  onSelect,
}) => (
  <div className="flex space-x-2 bg-white/50 p-1 rounded-lg border border-gray-200 w-fit">
    <button
      onClick={() => onSelect('new')}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2',
        activeTab === 'new' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'
      )}
    >
      New Transactions
      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{newCount}</span>
    </button>

    <button
      onClick={() => onSelect('duplicates')}
      disabled={duplicateCount === 0}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2',
        activeTab === 'duplicates' ? 'bg-white shadow text-gray-900' : 'text-gray-500',
        duplicateCount === 0 && 'opacity-50 cursor-not-allowed'
      )}
    >
      Duplicates
      {duplicateCount > 0 && (
        <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs">
          {duplicateCount}
        </span>
      )}
    </button>
  </div>
);

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}) => (
  <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
    <span className="text-xs text-gray-500">
      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
      {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems}
    </span>
    <div className="flex gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        className="h-7 w-7 p-0"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="flex items-center px-2 text-xs font-medium text-gray-600">
        {currentPage} / {totalPages || 1}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === totalPages || totalPages === 0}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        className="h-7 w-7 p-0"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  </div>
);

export interface PreviewViewProps {
  stagedTransactions: Transaction[];
  duplicateTransactions: DuplicateTransaction[];
  existingTransactions: Transaction[];
  activeTab: PreviewTab;
  currentPage: number;
  rejectedCount: number;
  selectedDuplicate: DuplicateTransaction | null;
  onSelectTab: (tab: PreviewTab) => void;
  onPageChange: (page: number) => void;
  onRemoveStaged: (id: string) => void;
  onRestoreDuplicate: (t: DuplicateTransaction) => void;
  onSelectDuplicate: (t: DuplicateTransaction | null) => void;
  onCancel: () => void;
  onBackToMapping: () => void;
  onConfirmImport: () => void;
}

export const PreviewView: React.FC<PreviewViewProps> = ({
  stagedTransactions,
  duplicateTransactions,
  existingTransactions,
  activeTab,
  currentPage,
  rejectedCount,
  selectedDuplicate,
  onSelectTab,
  onPageChange,
  onRemoveStaged,
  onRestoreDuplicate,
  onSelectDuplicate,
  onCancel,
  onBackToMapping,
  onConfirmImport,
}) => {
  const displayData = activeTab === 'new' ? stagedTransactions : duplicateTransactions;
  const totalPages = Math.ceil(displayData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = displayData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <>
      {/* Modal Overlay for Duplicate Details */}
      {selectedDuplicate && (
        <DuplicateResolutionModal
          transaction={selectedDuplicate}
          allTransactions={[
            ...existingTransactions,
            ...stagedTransactions,
            ...duplicateTransactions,
          ]}
          onClose={() => onSelectDuplicate(null)}
          onImport={() => {
            onRestoreDuplicate(selectedDuplicate);
            onSelectDuplicate(null);
          }}
        />
      )}

      <Card className="w-full max-w-2xl mx-auto mt-10 border-accent/20 bg-accent/5 relative">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center mb-4">
            <CardTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-accent" />
              Validate Data
            </CardTitle>
            {rejectedCount > 0 && (
              <Badge
                variant="accent"
                className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100"
              >
                <AlertTriangle className="w-4 h-4" />
                {rejectedCount} rejected row{rejectedCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          <PreviewTabs
            activeTab={activeTab}
            newCount={stagedTransactions.length}
            duplicateCount={duplicateTransactions.length}
            onSelect={onSelectTab}
          />
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Table Area */}
          <div className="bg-white rounded-lg border border-gray-200 min-h-[300px] flex flex-col">
            <PreviewTable
              paginatedData={paginatedData}
              activeTab={activeTab}
              onRemove={onRemoveStaged}
              onRestore={onRestoreDuplicate}
              onSelectDuplicate={onSelectDuplicate}
            />

            {displayData.length > 0 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={displayData.length}
                onPageChange={onPageChange}
              />
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button
              variant="ghost"
              onClick={onCancel}
              className="text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onBackToMapping}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Mapping
              </Button>
              <Button onClick={onConfirmImport} disabled={stagedTransactions.length === 0}>
                Import {stagedTransactions.length} Transactions
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
