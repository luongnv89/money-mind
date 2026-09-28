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
  <div className="flex w-fit space-x-2 rounded-lg border border-line bg-surface-muted p-1">
    <button
      aria-pressed={activeTab === 'new'}
      onClick={() => onSelect('new')}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2',
        activeTab === 'new' ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink'
      )}
    >
      New Transactions
      <span className="rounded-full bg-line/60 px-2 py-0.5 text-xs text-ink-soft">{newCount}</span>
    </button>

    <button
      aria-pressed={activeTab === 'duplicates'}
      onClick={() => onSelect('duplicates')}
      disabled={duplicateCount === 0}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2',
        activeTab === 'duplicates' ? 'bg-surface text-ink shadow-xs' : 'text-muted',
        duplicateCount === 0 && 'opacity-50 cursor-not-allowed'
      )}
    >
      Duplicates
      {duplicateCount > 0 && (
        <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
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
  <div className="flex items-center justify-between border-t border-line bg-surface-muted p-3">
    <span className="num text-xs text-muted">
      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
      {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems}
    </span>
    <div className="flex gap-1">
      <Button
        variant="outline"
        size="sm"
        aria-label="Previous page"
        disabled={currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        className="h-7 w-7 p-0"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="num flex items-center px-2 text-xs font-medium text-ink-soft">
        {currentPage} / {totalPages || 1}
      </div>
      <Button
        variant="outline"
        size="sm"
        aria-label="Next page"
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

  // Credit-card exports (e.g. AmEx, Discover) list charges as positive; warn
  // before import when nearly everything looks like money in.
  const positiveCount = stagedTransactions.filter((t) => t.amount > 0).length;
  const mostlyPositive =
    stagedTransactions.length >= 5 && positiveCount / stagedTransactions.length >= 0.8;

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

      <Card className="relative mx-auto w-full max-w-2xl">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center mb-4">
            <CardTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-accent" />
              Validate Data
            </CardTitle>
            {rejectedCount > 0 && (
              <Badge variant="negative" className="flex items-center gap-1">
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
          {mostlyPositive && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Most amounts are positive (money in). If this is a credit-card statement, go back to
                mapping and turn on &quot;Flip amount signs&quot;.
              </p>
            </div>
          )}
          {/* Table Area */}
          <div className="flex min-h-[300px] flex-col rounded-lg border border-line bg-surface">
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
              className="text-muted hover:bg-surface-muted hover:text-ink"
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
