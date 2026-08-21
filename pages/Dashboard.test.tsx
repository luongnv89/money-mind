import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { TransactionCategory, Transaction } from '../types';

vi.mock('../services/aiService', async () => {
  const { TransactionCategory: Cat } = await import('../types');
  const { useTransactionStore: useStore } = await import('../stores/useTransactionStore');
  return {
    categorizeWithAI: vi.fn(async (txs: Transaction[], _mode: string, onBatch: unknown) => {
      const cb = onBatch as (results: unknown[]) => void;
      const size = 25;
      for (let i = 0; i < txs.length; i += size) {
        const batch = txs.slice(i, i + size);
        if (i > 0) {
          useStore.getState().approveTransaction(txs[i].id);
        }
        cb(
          batch.map((t) => ({
            id: t.id,
            category: Cat.MustHave,
            subCategory: 'Housing',
            confidence: 0.95,
            reason: 'Rent',
          }))
        );
        await new Promise((r) => setTimeout(r, 0));
      }
    }),
  };
});

const makeTx = (i: number): Transaction => ({
  id: `tx-${i}`,
  date: '2026-01-15',
  description: `Tx ${i}`,
  amount: -10,
  category: TransactionCategory.Uncategorized,
  confidence: 0,
});

describe('Dashboard batch analysis (issue #21)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    useSettingsStore.setState({ isDemoMode: true });
    useTransactionStore.setState({
      transactions: Array.from({ length: 75 }, (_, i) => makeTx(i)),
      error: null,
      isCategorizing: false,
      processedCount: 0,
      totalToProcess: 0,
    });
  });

  afterEach(() => {
    if (root) React.act(() => root.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  it('keeps all three batches of results in the final store', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<Dashboard onNavigate={() => {}} />);
    });

    const analyzeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Pending')
    );
    expect(analyzeBtn).toBeDefined();

    await React.act(async () => {
      analyzeBtn!.click();
      await Promise.resolve();
    });

    const { categorizeWithAI } = await import('../services/aiService');
    const pending = vi.mocked(categorizeWithAI).mock.results[0]?.value as Promise<void>;
    expect(pending).toBeDefined();

    await React.act(async () => {
      await pending;
    });

    const final = useTransactionStore.getState().transactions;
    expect(final).toHaveLength(75);
    expect(final.every((t) => t.category === TransactionCategory.MustHave)).toBe(true);

    const approvedDuringAnalysis = final.find((t) => t.id === 'tx-25');
    expect(approvedDuringAnalysis?.isApproved).toBe(true);
  });
});
