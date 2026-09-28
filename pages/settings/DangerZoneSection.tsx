import React from 'react';
import { Button, Disclosure } from '../../components/UI';

interface DangerZoneSectionProps {
  patternCount: number;
  onDeleteTransactions: () => void;
  onClearPatterns: () => void;
  onResetSettings: () => void;
}

/** Collapsed-by-default destructive actions. */
export const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({
  patternCount,
  onDeleteTransactions,
  onClearPatterns,
  onResetSettings,
}) => (
  <Disclosure summary="Delete data &amp; reset" aside="Hidden to prevent accidents">
    <div className="divide-y divide-line">
      <div className="flex items-start justify-between gap-4 pb-5">
        <div>
          <p className="text-sm font-medium text-ink">Delete all transactions</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Removes every imported and manually added transaction from this browser. Your rules and
            settings stay.
          </p>
        </div>
        <Button size="sm" variant="danger" className="shrink-0" onClick={onDeleteTransactions}>
          Delete all transactions
        </Button>
      </div>
      <div className="flex items-start justify-between gap-4 py-5">
        <div>
          <p className="text-sm font-medium text-ink">Clear learned rules</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Removes all {patternCount} rules. Future imports won&apos;t be pre-categorized.
          </p>
        </div>
        <Button size="sm" variant="danger" className="shrink-0" onClick={onClearPatterns}>
          Clear learned rules
        </Button>
      </div>
      <div className="flex items-start justify-between gap-4 pt-5">
        <div>
          <p className="text-sm font-medium text-ink">Reset settings</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Restores default settings and removes all saved API keys.
          </p>
        </div>
        <Button size="sm" variant="danger" className="shrink-0" onClick={onResetSettings}>
          Reset settings
        </Button>
      </div>
    </div>
  </Disclosure>
);
