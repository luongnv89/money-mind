import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Toggle } from '../../components/UI';

const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CHF',
  'CAD',
  'AUD',
  'NZD',
  'JPY',
  'CNY',
  'INR',
  'SGD',
  'VND',
];

interface PreferencesSectionProps {
  currency: string;
  onCurrencyChange: (currency: string) => void;
  applyPatterns: boolean;
  onToggleApplyPatterns: () => void;
  enableSpendingAlerts: boolean;
  onToggleSpendingAlerts: () => void;
}

/** Display currency + behavior toggles. */
export const PreferencesSection: React.FC<PreferencesSectionProps> = ({
  currency,
  onCurrencyChange,
  applyPatterns,
  onToggleApplyPatterns,
  enableSpendingAlerts,
  onToggleSpendingAlerts,
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Preferences</CardTitle>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="currency" className="text-sm font-medium text-ink">
          Currency
        </label>
        <select
          id="currency"
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="flex h-10 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">
          Used to display amounts. MoneyMind doesn&apos;t convert between currencies — import
          statements in one currency.
        </p>
      </div>
      <Toggle
        checked={applyPatterns}
        onChange={onToggleApplyPatterns}
        label="Apply my rules on import"
        description="Categorize new imports with your learned rules before any AI runs."
      />
      <Toggle
        checked={enableSpendingAlerts}
        onChange={onToggleSpendingAlerts}
        label="Spending alerts"
        description="Notify me when a spending category runs 20% or more above its recent average."
      />
    </CardContent>
  </Card>
);
