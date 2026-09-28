import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Overview from './Overview';
import { householdQuarter, makeTx, usd } from '../lib/finance/fixtures.test-util';
import { buildFinanceModel, buildLedger, periodFor } from '../lib/finance';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useViewStore } from '../stores/useViewStore';
import { TransactionCategory, View } from '../types';

// jsdom lacks ResizeObserver; recharts' ResponsiveContainer needs the global.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

describe('Overview', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const render = (onNavigate: (view: View) => void = () => {}) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<Overview onNavigate={onNavigate} />);
    });
  };

  beforeEach(() => {
    useSettingsStore.setState({ currency: 'USD', isDemoMode: false, enableSpendingAlerts: false });
    useTransactionStore.setState({ transactions: householdQuarter(), error: null });
    useViewStore.setState({ granularity: 'month', anchor: '2026-04-30' });
  });

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
    useTransactionStore.getState().clearAll();
    useViewStore.setState({ granularity: 'month', anchor: null });
  });

  it('renders the April month view from the engine model', () => {
    render();

    expect(container.querySelector('h1')?.textContent).toBe('April 2026');
    // Score ring + grade summary.
    expect(container.querySelector('[aria-label="Score 71 of 100"]')).not.toBeNull();
    expect(container.textContent).toContain('Grade C · Fair');
    // Prioritized insights.
    expect(container.textContent).toContain('Housing costs are 35% of income');
    expect(container.textContent).toContain('Free up $400.00 a month to reach a 20% savings rate');
    // Recurring table.
    expect(container.textContent).toContain('Landlord Rent');
    // Methodology disclosure.
    expect(container.textContent).toContain('How MoneyMind calculates these numbers');
  });

  it('uses day-to-day spending in the week view, with no income/spending deltas', () => {
    useViewStore.setState({ granularity: 'week', anchor: '2026-04-15' });
    render();

    expect(container.querySelector('h1')?.textContent).toBe('Apr 13 – 19, 2026');
    expect(container.textContent).toContain('Day-to-day spending');
    // Explanatory captions replace the deltas on the other cards in week view.
    expect(container.textContent).toContain('Weekly income depends on paydays');
    expect(container.textContent).toContain('Includes bills due this week');
    expect(container.textContent).toContain('Judge savings over months — see Financial health');
  });

  it('labels period impacts "this period" when the period is complete', () => {
    const ledger = buildLedger(householdQuarter());
    const week = periodFor(ledger, 'week', '2026-04-15');
    const model = buildFinanceModel(ledger, week!, usd);
    const periodImpact = model.insights.find((i) => i.impact?.per === 'period');
    expect(periodImpact).toBeDefined();

    useViewStore.setState({ granularity: 'week', anchor: '2026-04-15' });
    render();
    expect(container.textContent).toContain(`${usd(periodImpact!.impact!.amount)} this period`);
  });

  it('shows the score reason when no income exists in the window', () => {
    const spendingOnly = [
      makeTx('2026-02-05', 'SHOP', -100, TransactionCategory.NiceToHave),
      makeTx('2026-03-05', 'SHOP', -100, TransactionCategory.NiceToHave),
      makeTx('2026-04-05', 'SHOP', -100, TransactionCategory.NiceToHave),
    ];
    useTransactionStore.setState({ transactions: spendingOnly });
    useViewStore.setState({ granularity: 'month', anchor: '2026-04-30' });

    const ledger = buildLedger(spendingOnly);
    const period = periodFor(ledger, 'month', '2026-04-30')!;
    const model = buildFinanceModel(ledger, period, usd);
    expect(model.score.score).toBeNull();

    render();
    expect(container.textContent).toContain(model.score.reason);
    expect(container.textContent).toContain('Review transactions');
  });

  it('shows the empty state when transactions are cleared', () => {
    useTransactionStore.setState({ transactions: [] });
    render();
    expect(container.textContent).toContain('Load demo data');
    expect(container.textContent).toContain('Add manually');
    expect(container.textContent).toContain('Import CSV');
  });
});
