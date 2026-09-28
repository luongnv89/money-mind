import React from 'react';
import { Copy, Database, Info, PlusCircle, Trash2 } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { Transaction } from '../../types';
import { DuplicateTransaction } from './dedupe';
import type { PreviewTab } from './PreviewView';

const DuplicateReasonCell: React.FC<{ reason: DuplicateTransaction['duplicateReason'] }> = ({
  reason,
}) =>
  reason === 'Already Imported' ? (
    <div className="flex w-fit items-center gap-1.5 rounded-md bg-info/10 px-2 py-1 text-info">
      <Database className="w-3 h-3" />
      <span className="font-medium">In Database</span>
    </div>
  ) : (
    <div className="flex w-fit items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-warning">
      <Copy className="w-3 h-3" />
      <span className="font-medium">File Duplicate</span>
    </div>
  );

interface PreviewRowProps {
  t: Transaction | DuplicateTransaction;
  activeTab: PreviewTab;
  onRemove: (id: string) => void;
  onRestore: (t: DuplicateTransaction) => void;
  onSelectDuplicate: (t: DuplicateTransaction) => void;
}

const PreviewRow: React.FC<PreviewRowProps> = ({
  t,
  activeTab,
  onRemove,
  onRestore,
  onSelectDuplicate,
}) => (
  <tr
    key={t.id}
    onClick={() => activeTab === 'duplicates' && onSelectDuplicate(t as DuplicateTransaction)}
    className={cn(
      'group transition-colors hover:bg-surface-muted/70',
      activeTab === 'duplicates' ? 'cursor-pointer' : ''
    )}
  >
    <td className="num whitespace-nowrap p-3 text-muted">{t.date}</td>
    <td className="p-3 truncate max-w-[200px]" title={t.description}>
      {t.description}
      {t.originalCategory && (
        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
          <Info className="w-3 h-3" />
          Cat: {t.originalCategory}
        </div>
      )}
    </td>

    {activeTab === 'duplicates' && (
      <td className="p-3">
        <DuplicateReasonCell reason={(t as DuplicateTransaction).duplicateReason} />
      </td>
    )}

    <td className="num p-3 text-right">{formatCurrency(t.amount)}</td>
    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
      {activeTab === 'new' ? (
        <button
          onClick={() => onRemove(t.id)}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-negative/10 hover:text-negative"
          title="Remove transaction"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={() => onRestore(t as DuplicateTransaction)}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-positive/10 hover:text-positive"
          title="Add anyway (as duplicate)"
        >
          <PlusCircle className="w-4 h-4" />
        </button>
      )}
    </td>
  </tr>
);

export interface PreviewTableProps {
  paginatedData: (Transaction | DuplicateTransaction)[];
  activeTab: PreviewTab;
  onRemove: (id: string) => void;
  onRestore: (t: DuplicateTransaction) => void;
  onSelectDuplicate: (t: DuplicateTransaction) => void;
}

/** Paginated staged/duplicate transaction table with per-row actions. */
export const PreviewTable: React.FC<PreviewTableProps> = ({
  paginatedData,
  activeTab,
  onRemove,
  onRestore,
  onSelectDuplicate,
}) => (
  <div className="overflow-x-auto flex-1">
    <table className="w-full text-xs text-left">
      <thead className="border-b border-line bg-surface-muted">
        <tr>
          <th className="p-3 font-medium text-muted">Date</th>
          <th className="p-3 font-medium text-muted">Description</th>
          {activeTab === 'duplicates' && <th className="p-3 font-medium text-muted">Reason</th>}
          <th className="p-3 text-right font-medium text-muted">Amount</th>
          <th className="w-16 p-3 text-center font-medium text-muted">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {paginatedData.length > 0 ? (
          paginatedData.map((t) => (
            <PreviewRow
              key={t.id}
              t={t}
              activeTab={activeTab}
              onRemove={onRemove}
              onRestore={onRestore}
              onSelectDuplicate={onSelectDuplicate}
            />
          ))
        ) : (
          <tr>
            <td
              colSpan={activeTab === 'duplicates' ? 5 : 4}
              className="p-8 text-center italic text-muted"
            >
              {activeTab === 'new' ? 'No transactions ready to import.' : 'No duplicates found.'}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);
