import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';
import { useTransactionStore } from '../stores/useTransactionStore';
import { Transaction, TransactionCategory } from '../types';

const makeTx = (i: number): Transaction => ({
  id: `tx-${i}`,
  date: '2026-01-15',
  description: `Tx ${i}`,
  amount: -10,
  category: TransactionCategory.Uncategorized,
  confidence: 0,
});

describe('App', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(() => {
    if (root) React.act(() => root.unmount());
    container?.remove();
    useTransactionStore.getState().clearAll();
  });

  it('mounts without throwing and renders the upload view when empty', () => {
    container = document.createElement('div');
    document.body.appendChild(container);

    root = createRoot(container);
    expect(() => {
      React.act(() => {
        root.render(<App />);
      });
    }).not.toThrow();

    expect(container.textContent).toContain('MoneyMind');
    expect(container.textContent).toContain('Drop your bank statement here');
  });

  it('lazy-loads the dashboard chunk when transactions exist (F-PERF-005)', async () => {
    useTransactionStore.setState({ transactions: [makeTx(0), makeTx(1)] });

    container = document.createElement('div');
    document.body.appendChild(container);

    root = createRoot(container);
    React.act(() => {
      root.render(<App />);
    });

    // React 19 defers the lazy retry to the next act boundary, so await the
    // same dynamic import the lazy component uses INSIDE act; when act exits
    // it flushes the retry and the Suspense boundary swaps in the dashboard.
    await React.act(async () => {
      await import('../pages/Dashboard');
    });
    React.act(() => {
      // flush of any remaining act-queued updates
    });

    expect(container.textContent).toContain('Financial Intelligence');
  });
});
