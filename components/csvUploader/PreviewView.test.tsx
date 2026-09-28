import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewView, PreviewTab } from './PreviewView';
import { DuplicateTransaction } from './dedupe';
import { Transaction, TransactionCategory } from '../../types';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  date: '2026-01-01',
  description: 'Coffee',
  amount: -4.5,
  category: TransactionCategory.Uncategorized,
  confidence: 0,
  ...over,
});

const dup: DuplicateTransaction = {
  ...tx({ id: 'd1', description: 'Duplicate Coffee' }),
  duplicateReason: 'Already Imported',
};

const findButton = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text)
  ) as HTMLButtonElement;

describe('PreviewView — tab selected state (review F15, WCAG 4.1.2)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const render = async (
    activeTab: PreviewTab = 'new',
    duplicates: DuplicateTransaction[] = [dup]
  ) => {
    const onSelectTab = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await React.act(async () => {
      root.render(
        <PreviewView
          stagedTransactions={[tx()]}
          duplicateTransactions={duplicates}
          existingTransactions={[]}
          activeTab={activeTab}
          currentPage={1}
          rejectedCount={0}
          selectedDuplicate={null}
          onSelectTab={onSelectTab}
          onPageChange={() => {}}
          onRemoveStaged={() => {}}
          onRestoreDuplicate={() => {}}
          onSelectDuplicate={() => {}}
          onCancel={() => {}}
          onBackToMapping={() => {}}
          onConfirmImport={() => {}}
        />
      );
    });
    return onSelectTab;
  };

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  it('exposes aria-pressed on both tabs, matching activeTab', async () => {
    await render('new');
    expect(findButton(container, 'New Transactions').getAttribute('aria-pressed')).toBe('true');
    expect(findButton(container, 'Duplicates').getAttribute('aria-pressed')).toBe('false');
  });

  it('flips aria-pressed when the duplicates tab is active', async () => {
    await render('duplicates');
    expect(findButton(container, 'New Transactions').getAttribute('aria-pressed')).toBe('false');
    expect(findButton(container, 'Duplicates').getAttribute('aria-pressed')).toBe('true');
    expect(container.textContent).toContain('In Database');
  });

  it('calls onSelectTab when a tab is clicked', async () => {
    const onSelectTab = await render('new', [dup]);
    await React.act(async () => {
      findButton(container, 'Duplicates').click();
    });
    expect(onSelectTab).toHaveBeenCalledWith('duplicates');
  });

  it('keeps the Duplicates tab disabled when there are none', async () => {
    await render('new', []);
    expect(findButton(container, 'Duplicates').disabled).toBe(true);
    expect(findButton(container, 'New Transactions').getAttribute('aria-pressed')).toBe('true');
  });
});
