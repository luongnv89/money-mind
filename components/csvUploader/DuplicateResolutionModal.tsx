import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '../UI';
import { formatCurrency } from '../../lib/utils';
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
  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 space-y-2">
    <div className="flex justify-between">
      <span className="text-sm font-medium text-orange-900">New Transaction</span>
      <Badge variant="outline" className="bg-white text-orange-600 border-orange-200">
        {transaction.duplicateReason}
      </Badge>
    </div>
    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
      <div>
        <span className="text-xs text-orange-700/70 block uppercase">Date</span>
        <span className="font-medium text-orange-900">{transaction.date}</span>
      </div>
      <div className="text-right">
        <span className="text-xs text-orange-700/70 block uppercase">Amount</span>
        <span className="font-medium text-orange-900 font-mono">
          {formatCurrency(transaction.amount)}
        </span>
      </div>
      <div className="col-span-2">
        <span className="text-xs text-orange-700/70 block uppercase">Description</span>
        <span className="font-medium text-orange-900 truncate block">
          {transaction.description}
        </span>
      </div>
    </div>
  </div>
);

const ExistingMatch: React.FC<{ match: Transaction }> = ({ match }) => (
  <div className="p-3 bg-gray-50 rounded border border-gray-200 opacity-75">
    <div className="flex justify-between text-sm text-gray-700">
      <span>{match.date}</span>
      <span className="font-mono">{formatCurrency(match.amount)}</span>
    </div>
    <p className="text-xs text-gray-500 mt-1 truncate">{match.description}</p>
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
  // Find potential matches in existing data to show why it's a duplicate
  const exactMatches = findExactMatches(transaction, allTransactions);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <Card className="w-full max-w-lg bg-white shadow-xl animate-in zoom-in-95 duration-200">
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Duplicate Detected
            </CardTitle>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              This transaction appears to be a duplicate of an existing record or another entry in
              this file.
            </p>
            <NewTransactionPanel transaction={transaction} />
          </div>

          {exactMatches.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
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
            <Button onClick={onImport} className="bg-orange-600 hover:bg-orange-700 text-white">
              Import Anyway
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
