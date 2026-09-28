import React from 'react';
import { FileSpreadsheet, Plus, Sparkles } from 'lucide-react';
import { Button } from '../../components/UI';
import { Transaction, View } from '../../types';

interface EmptyStateProps {
  onNavigate: (view: View) => void;
  onAddManually: () => void;
  onLoadDemo?: () => void;
  importedTransactions?: Transaction[];
}

const EmptyIllustration: React.FC = () => (
  <div className="w-24 h-24 bg-surface-muted rounded-full flex items-center justify-center border border-line mb-6 shadow-soft">
    <FileSpreadsheet className="w-10 h-10 text-muted" />
  </div>
);

const PreviewRow: React.FC<{ t: Transaction }> = ({ t }) => (
  <div className="flex justify-between text-sm py-1.5 border-b border-line last:border-0">
    <div className="flex items-center gap-2 truncate mr-3">
      <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
      <span className="text-ink-soft truncate">{t.description}</span>
    </div>
    <span className={`num font-medium ${t.amount > 0 ? 'text-positive' : 'text-ink-soft'}`}>
      {t.amount}
    </span>
  </div>
);

/** Small preview card when parsed-but-not-committed rows exist. */
const PreviewCard: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => (
  <div className="w-full max-w-sm bg-surface rounded-xl p-4 border border-line mb-6 text-left shadow-card">
    <p className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">
      Reviewing Import ({transactions.length})
    </p>
    <div className="space-y-1">
      {transactions.slice(0, 3).map((t) => (
        <PreviewRow key={t.id} t={t} />
      ))}
      {transactions.length > 3 && (
        <p className="text-xs text-muted text-center pt-1">+ {transactions.length - 3} more</p>
      )}
    </div>
  </div>
);

export const EmptyState: React.FC<EmptyStateProps> = ({
  onNavigate,
  onAddManually,
  onLoadDemo,
  importedTransactions,
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-rise">
    <EmptyIllustration />

    <h2 className="font-display text-3xl text-ink mb-3">No data yet</h2>
    <p className="text-ink-soft max-w-md mb-8 leading-relaxed">
      Import your bank statement CSV to see your financial picture — or start with the deterministic
      sample dataset to explore first.
    </p>

    {importedTransactions && importedTransactions.length > 0 && (
      <PreviewCard transactions={importedTransactions} />
    )}

    <div className="flex flex-col sm:flex-row gap-3 items-center">
      <Button onClick={() => onNavigate('upload')} className="w-full sm:w-auto px-8" size="lg">
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Import CSV
      </Button>

      {onLoadDemo && (
        <Button variant="outline" onClick={onLoadDemo} className="w-full sm:w-auto px-8" size="lg">
          <Sparkles className="mr-2 h-4 w-4" />
          Load demo data
        </Button>
      )}

      <Button variant="ghost" onClick={onAddManually} className="w-full sm:w-auto" size="lg">
        <Plus className="mr-2 h-4 w-4" />
        Add manually
      </Button>
    </div>
  </div>
);
