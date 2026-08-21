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
    <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded-md w-fit">
      <Database className="w-3 h-3" />
      <span className="font-medium">In Database</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-1 rounded-md w-fit">
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
      'hover:bg-gray-50/80 group transition-colors',
      activeTab === 'duplicates' ? 'cursor-pointer' : ''
    )}
  >
    <td className="p-3 text-gray-500 whitespace-nowrap">{t.date}</td>
    <td className="p-3 truncate max-w-[200px]" title={t.description}>
      {t.description}
      {t.originalCategory && (
        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
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

    <td className="p-3 text-right font-mono">{formatCurrency(t.amount)}</td>
    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
      {activeTab === 'new' ? (
        <button
          onClick={() => onRemove(t.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
          title="Remove transaction"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={() => onRestore(t as DuplicateTransaction)}
          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
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
      <thead className="bg-gray-50 border-b border-gray-100">
        <tr>
          <th className="p-3 font-medium text-gray-500">Date</th>
          <th className="p-3 font-medium text-gray-500">Description</th>
          {activeTab === 'duplicates' && <th className="p-3 font-medium text-gray-500">Reason</th>}
          <th className="p-3 font-medium text-gray-500 text-right">Amount</th>
          <th className="p-3 font-medium text-gray-500 w-16 text-center">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
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
              className="p-8 text-center text-gray-400 italic"
            >
              {activeTab === 'new' ? 'No transactions ready to import.' : 'No duplicates found.'}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);
