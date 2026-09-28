import React, { useId } from 'react';
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
}) => {
  const selectId = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={selectId} className="text-sm font-medium flex items-center gap-1">
        {label} {optional && <span className="text-muted font-normal">(Optional)</span>}
      </label>
      <select
        id={selectId}
        className={cn(
          'w-full rounded-md border border-line bg-surface p-2 text-sm text-ink',
          optional && 'bg-surface-muted'
        )}
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
};

const PreviewRow: React.FC<{ row: Transaction }> = ({ row }) => (
  <tr className="hover:bg-surface-muted/60">
    <td className="px-4 py-2 text-muted whitespace-nowrap text-xs">
      {row.date ? row.date : <span className="text-negative italic">Empty</span>}
    </td>
    <td className="px-4 py-2 text-ink truncate max-w-[200px] text-xs">
      {row.description ? row.description : <span className="text-negative italic">Empty</span>}
    </td>
    <td className="px-4 py-2 text-muted truncate max-w-[120px] text-xs">
      {row.originalCategory || <span className="text-muted italic">N/A</span>}
    </td>
    <td
      className={cn(
        'px-4 py-2 text-right num text-xs',
        isNaN(row.amount) ? 'text-negative' : 'text-ink-soft'
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
      <p className="text-sm text-muted">
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

      {!mapping.debitCreditCols && (
        <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-muted p-3">
          <input
            id="invert-amounts"
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-accent"
            checked={!!mapping.invertAmounts}
            onChange={(e) => onMappingChange({ ...mapping, invertAmounts: e.target.checked })}
          />
          <label htmlFor="invert-amounts" className="text-left text-sm text-ink-soft">
            <span className="font-medium text-ink">Flip amount signs</span>
            <span className="block text-xs text-muted mt-0.5">
              Turn on when charges appear as positive numbers — typical for credit-card exports such
              as American Express or Discover.
            </span>
          </label>
        </div>
      )}

      {/* Mapping Preview Table */}
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="flex items-center justify-between border-b border-line bg-surface-muted px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Preview</span>
          <span className="text-xs text-muted">Showing first 10 rows based on current mapping</span>
        </div>
        <div className="overflow-x-auto max-h-60">
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 z-10 border-b border-line bg-surface text-muted">
              <tr>
                <th className="bg-surface-muted/60 px-4 py-2 font-medium">Date</th>
                <th className="bg-surface-muted/60 px-4 py-2 font-medium">Description</th>
                <th className="bg-surface-muted/60 px-4 py-2 font-medium">Category (Raw)</th>
                <th className="bg-surface-muted/60 px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {mappingPreview.length > 0 ? (
                mappingPreview.map((row) => <PreviewRow key={row.id} row={row} />)
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center italic text-muted">
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
