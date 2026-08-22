import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../UI';
import { cn, formatCurrency } from '../../lib/utils';
import { CsvMapping, Transaction } from '../../types';

interface ColumnSelectProps {
  label: React.ReactNode;
  value: string;
  headers: string[];
  optional?: boolean;
  onChange: (value: string) => void;
}

const ColumnSelect: React.FC<ColumnSelectProps> = ({
  label,
  value,
  headers,
  optional,
  onChange,
}) => (
  <div className="space-y-2">
    <label className="text-sm font-medium flex items-center gap-1">
      {label} {optional && <span className="text-gray-400 font-normal">(Optional)</span>}
    </label>
    <select
      className={cn('w-full p-2 border rounded-md', optional && 'bg-gray-50')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {optional && <option value="">-- None --</option>}
      {headers.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  </div>
);

const PreviewRow: React.FC<{ row: Transaction }> = ({ row }) => (
  <tr className="hover:bg-gray-50/50">
    <td className="px-4 py-2 text-gray-600 whitespace-nowrap text-xs">
      {row.date ? row.date : <span className="text-red-300 italic">Empty</span>}
    </td>
    <td className="px-4 py-2 text-gray-900 truncate max-w-[200px] text-xs">
      {row.description ? row.description : <span className="text-red-300 italic">Empty</span>}
    </td>
    <td className="px-4 py-2 text-gray-500 truncate max-w-[120px] text-xs">
      {row.originalCategory || <span className="text-gray-300 italic">N/A</span>}
    </td>
    <td
      className={cn(
        'px-4 py-2 text-right font-mono text-xs',
        isNaN(row.amount) ? 'text-red-400' : 'text-gray-700'
      )}
    >
      {isNaN(row.amount) ? 'NaN' : formatCurrency(row.amount)}
    </td>
  </tr>
);

export interface MappingViewProps {
  headers: string[];
  mapping: CsvMapping;
  /** Whether bank-format or header detection filled the mapping in; the
   * heading words the ask accordingly instead of blaming detection on success
   * (F-UX-005). */
  autoDetected: boolean;
  mappingPreview: Transaction[];
  onMappingChange: (mapping: CsvMapping) => void;
  onCancel: () => void;
  onNext: () => void;
}

export const MappingView: React.FC<MappingViewProps> = ({
  headers,
  mapping,
  autoDetected,
  mappingPreview,
  onMappingChange,
  onCancel,
  onNext,
}) => (
  <Card className="w-full max-w-2xl mx-auto mt-10">
    <CardHeader>
      <CardTitle>Map Columns</CardTitle>
      <p className="text-sm text-gray-500">
        {autoDetected
          ? 'We auto-detected your columns — review the mapping below and adjust anything that looks wrong.'
          : "We couldn't auto-detect your bank format. Please map the columns below."}
      </p>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ColumnSelect
          label="Date Column"
          value={mapping.dateCol}
          headers={headers}
          onChange={(v) => onMappingChange({ ...mapping, dateCol: v })}
        />
        <ColumnSelect
          label="Description"
          value={mapping.descCol}
          headers={headers}
          onChange={(v) => onMappingChange({ ...mapping, descCol: v })}
        />
        <ColumnSelect
          label="Amount"
          value={mapping.amountCol}
          headers={headers}
          onChange={(v) => onMappingChange({ ...mapping, amountCol: v })}
        />
        <ColumnSelect
          label="Category"
          value={mapping.categoryCol || ''}
          headers={headers}
          optional
          onChange={(v) => onMappingChange({ ...mapping, categoryCol: v })}
        />
      </div>

      {/* Mapping Preview Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Preview
          </span>
          <span className="text-xs text-gray-400">
            Showing first 10 rows based on current mapping
          </span>
        </div>
        <div className="overflow-x-auto max-h-60">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-gray-500 border-b border-gray-100 sticky top-0 shadow-xs z-10">
              <tr>
                <th className="px-4 py-2 font-medium bg-gray-50/50">Date</th>
                <th className="px-4 py-2 font-medium bg-gray-50/50">Description</th>
                <th className="px-4 py-2 font-medium bg-gray-50/50">Category (Raw)</th>
                <th className="px-4 py-2 font-medium text-right bg-gray-50/50">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {mappingPreview.length > 0 ? (
                mappingPreview.map((row) => <PreviewRow key={row.id} row={row} />)
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">
                    No preview available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onNext}>
          Next <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </CardContent>
  </Card>
);
