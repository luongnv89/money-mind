import React, { useId } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '../UI';
import { formatCurrency } from '../../lib/utils';
import { closeOnBackdrop, useDialog } from '../../lib/useDialog';
import { Transaction } from '../../types';
import type { DuplicateTransaction } from './dedupe';

const findExactMatches = (transaction: DuplicateTransaction, allTransactions: Transaction[]) =>
  allTransactions.filter(
    (t) =>
      t.date === transaction.date &&
      t.amount === transaction.amount &&
      t.description === transaction.description &&
      t.id !== transaction.id
  );

const NewTransactionPanel: React.FC<{ transaction: DuplicateTransaction }> = ({ transaction }) => (
  <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/10 p-4">
    <div className="flex justify-between">
      <span className="text-sm font-medium text-ink">New Transaction</span>
      <Badge variant="warning">{transaction.duplicateReason}</Badge>
    </div>
    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
      <div>
        <span className="block text-xs uppercase text-muted">Date</span>
        <span className="num font-medium text-ink">{transaction.date}</span>
      </div>
      <div className="text-right">
        <span className="block text-xs uppercase text-muted">Amount</span>
        <span className="num font-medium text-ink">{formatCurrency(transaction.amount)}</span>
      </div>
      <div className="col-span-2">
        <span className="block text-xs uppercase text-muted">Description</span>
        <span className="block truncate font-medium text-ink">{transaction.description}</span>
      </div>
    </div>
  </div>
);

const ExistingMatch: React.FC<{ match: Transaction }> = ({ match }) => (
  <div className="rounded-lg border border-line bg-surface-muted p-3 opacity-80">
    <div className="num flex justify-between text-sm text-ink-soft">
      <span>{match.date}</span>
      <span className="num">{formatCurrency(match.amount)}</span>
    </div>
    <p className="mt-1 truncate text-xs text-muted">{match.description}</p>
  </div>
);

export interface DuplicateResolutionModalProps {
  transaction: DuplicateTransaction;
  allTransactions: Transaction[];
  onClose: () => void;
  onImport: () => void;
}

export const DuplicateResolutionModal: React.FC<DuplicateResolutionModalProps> = ({
  transaction,
  allTransactions,
  onClose,
  onImport,
}) => {
  const titleId = useId();
  const panelRef = useDialog<HTMLDivElement>(true, onClose);

  // Find potential matches in existing data to show why it's a duplicate
  const exactMatches = findExactMatches(transaction, allTransactions);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
      onClick={closeOnBackdrop(onClose)}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-lg"
      >
        <Card className="w-full animate-rise bg-surface shadow-xl">
          <CardHeader className="border-b border-line pb-4">
            <div className="flex justify-between items-start">
              <CardTitle className="flex items-center gap-2 font-display text-lg text-warning">
                <span id={titleId} className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Duplicate Detected
                </span>
              </CardTitle>
              <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">
                This transaction appears to be a duplicate of an existing record or another entry in
                this file.
              </p>
              <NewTransactionPanel transaction={transaction} />
            </div>

            {exactMatches.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Existing Match ({exactMatches.length})
                </p>
                {exactMatches.slice(0, 1).map((match) => (
                  <ExistingMatch key={match.id} match={match} />
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onClose}>
                Discard
              </Button>
              <Button onClick={onImport} className="bg-warning text-white hover:bg-warning/90">
                Import Anyway
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
