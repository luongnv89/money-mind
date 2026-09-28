import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, StatusDot } from '../../components/UI';

interface AIOverviewSectionProps {
  providerName: string;
  typesafeKeySet: boolean;
  aiReady: boolean;
  selectedModel: string;
}

/** "How MoneyMind uses AI" — explains the two AI jobs and shows live status. */
export const AIOverviewSection: React.FC<AIOverviewSectionProps> = ({
  providerName,
  typesafeKeySet,
  aiReady,
  selectedModel,
}) => (
  <Card>
    <CardHeader>
      <CardTitle>How MoneyMind uses AI</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-soft">
        Your metrics, health score and advice are calculated on this device with fixed formulas — no
        AI is involved, so the same data always gives the same numbers. AI is used for two jobs
        only:
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
        <li>
          Categorizing transactions — TypeSafe Jev when a TypeSafe key is set (recommended);
          otherwise the language model below.
        </li>
        <li>
          Answering Assistant questions — the language model below, using figures computed on this
          device.
        </li>
      </ol>
      <p className="border-l-2 border-brass bg-surface-muted px-3 py-2 text-xs leading-relaxed text-ink-soft">
        Your own rules always come first: categories you correct and transactions you verify become
        rules that are applied before any AI and are never overwritten by it.
      </p>

      <div className="divide-y divide-line rounded-xl border border-line">
        <div className="px-4 py-3">
          <p className="text-sm font-medium text-ink">Categorization</p>
          {typesafeKeySet ? (
            <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
              <StatusDot variant="positive" /> TypeSafe Jev
            </p>
          ) : aiReady ? (
            <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
              <StatusDot variant="warning" /> Language model fallback · {providerName}
              <span className="text-muted">
                — Add a TypeSafe key for calibrated, consistent results.
              </span>
            </p>
          ) : (
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <StatusDot variant="neutral" /> Not set up — you can still categorize manually.
            </p>
          )}
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-medium text-ink">Assistant</p>
          {aiReady ? (
            <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
              <StatusDot variant="positive" /> {providerName} · {selectedModel}
            </p>
          ) : (
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <StatusDot variant="neutral" /> Not set up
            </p>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);
