import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Transactions from './Transactions';
import { householdQuarter, makeTx } from '../lib/finance/fixtures.test-util';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useViewStore } from '../stores/useViewStore';
import { TransactionCategory, View } from '../types';

describe('Transactions', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const onNavigate = vi.fn<(view: View) => void>();

  const render = () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<Transactions onNavigate={onNavigate} />);
    });
  };

  beforeEach(() => {
    useSettingsStore.setState({
      currency: 'USD',
      isDemoMode: false,
      enableSpendingAlerts: false,
      aiMode: 'cloud',
      geminiConfig: { apiKey: '', model: 'm' },
      typesafeConfig: { apiKey: '' },
    });
    useViewStore.setState({ granularity: 'month', anchor: '2026-04-30' });
    onNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    React.act(() => root?.unmount());
    container?.remove();
    useTransactionStore.getState().clearAll();
    useViewStore.setState({ granularity: 'month', anchor: null });
  });

  it('lists only the selected period’s transactions', () => {
    useTransactionStore.setState({ transactions: householdQuarter() });
    render();

    expect(container.querySelector('h1')?.textContent).toBe('April 2026');
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(8); // householdMonth emits 8 rows per month
    expect(container.textContent).toContain('8 transactions');
  });

  it('offers the quick-filter chips', () => {
    useTransactionStore.setState({
      transactions: [
        ...householdQuarter(),
        makeTx('2026-04-20', 'MYSTERY', -30, TransactionCategory.Uncategorized, undefined, {
          isApproved: false,
          confidence: 0,
        }),
      ],
    });
    render();

    const chips = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(chips).toContain('Needs review');
    expect(chips).toContain('Uncategorized');
    expect(container.textContent).toContain('1 uncategorized');
  });

  it('allows categorizing demo transactions without redirecting to Settings', async () => {
    vi.useFakeTimers();
    useSettingsStore.getState().setDemoMode(true);
    useTransactionStore.setState({
      transactions: [
        makeTx('2026-04-10', 'MYSTERY', -30, TransactionCategory.Uncategorized, undefined, {
          isApproved: false,
          confidence: 0,
        }),
      ],
    });
    render();

    const categorize = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.match(/Categorize \d+ pending/)
    ) as HTMLButtonElement;
    React.act(() => categorize.click());
    expect(onNavigate).not.toHaveBeenCalledWith('settings');
    await React.act(async () => vi.advanceTimersByTimeAsync(800));
    expect(useTransactionStore.getState().isCategorizing).toBe(false);
    vi.useRealTimers();
  });

  it('routes the categorize action to Settings when nothing is configured', () => {
    useTransactionStore.setState({
      transactions: [
        makeTx('2026-04-10', 'MYSTERY', -30, TransactionCategory.Uncategorized, undefined, {
          isApproved: false,
          confidence: 0,
        }),
      ],
    });
    render();

    const categorize = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.match(/Categorize \d+ pending/)
    ) as HTMLButtonElement;
    expect(categorize).toBeDefined();

    React.act(() => {
      categorize.click();
    });
    expect(onNavigate).toHaveBeenCalledWith('settings');
  });
});
