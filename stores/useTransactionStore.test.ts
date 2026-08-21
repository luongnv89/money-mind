import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransactionStore, transactionStorage } from './useTransactionStore';
import { Transaction, TransactionCategory } from '../types';

const PERSIST_KEY = 'moneymind-transactions';

const makeTx = (i: number): Transaction => ({
  id: `tx-${i}`,
  date: '2026-01-15',
  description: `Tx ${i}`,
  amount: -10,
  category: TransactionCategory.Uncategorized,
  confidence: 0,
});

describe('useTransactionStore persisted writes (F-PERF-001)', () => {
  let writes: string[];

  beforeEach(() => {
    // The reset itself performs one persisted write, but it happens before the
    // spy is installed, so it is uncounted — like an analysis run that starts
    // on an already-persisted state.
    useTransactionStore.setState({
      transactions: [],
      error: null,
      isParsing: false,
      isCategorizing: false,
      processedCount: 0,
      totalToProcess: 0,
    });
    writes = [];
    // Spy where setItem actually lives. On Node 26 the setup file installs a
    // plain-object localStorage (own setItem), but on Node 24 (CI) jsdom
    // supplies a Storage whose setItem is prototype-inherited and immune to
    // instance-level spies — spying the holder that owns the method observes
    // the write in both environments.
    const backing = globalThis.localStorage;
    const prototype = Object.getPrototypeOf(backing) as Storage | null;
    const holder: Pick<Storage, 'setItem'> =
      prototype?.setItem === backing.setItem ? prototype : backing;
    const realSetItem: (key: string, value: string) => void = holder.setItem.bind(backing);
    vi.spyOn(holder, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === PERSIST_KEY) writes.push(value);
      realSetItem(key, value);
    });
    return () => vi.restoreAllMocks();
  });

  it('performs fewer than 20 localStorage writes across a 200-batch analysis', () => {
    const { setTransactions, updateTransactionBatch } = useTransactionStore.getState();

    // Commit one store update per AI batch: 200 batches delivered as fast as
    // the (mocked) AI supplies them. Before the throttle this was 200
    // synchronous full-array localStorage writes; the acceptance criterion is
    // fewer than 20. The whole burst lands inside one throttle interval, so it
    // stays pending until the trailing edge (or flush) — which is the point.
    setTransactions(Array.from({ length: 200 }, (_, i) => makeTx(i)));
    for (let i = 0; i < 200; i++) {
      const updated = { ...makeTx(i), category: TransactionCategory.MustHave, confidence: 0.9 };
      updateTransactionBatch([updated]);
    }

    expect(writes.length).toBeLessThan(20);

    // The burst is coalesced into a single trailing write that carries the
    // final state — nothing is lost.
    transactionStorage.flush();
    expect(writes.length).toBeGreaterThanOrEqual(1);
    expect(writes.length).toBeLessThan(20);

    const persisted = JSON.parse(globalThis.localStorage.getItem(PERSIST_KEY) || '{}') as {
      state?: { transactions?: Transaction[] };
    };
    const transactions = persisted.state?.transactions ?? [];
    expect(transactions).toHaveLength(200);
    expect(transactions.every((t) => t.category === TransactionCategory.MustHave)).toBe(true);
  });
});
