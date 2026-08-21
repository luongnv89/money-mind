import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CSVUploader } from './CSVUploader';
import { useTransactionStore } from '../stores/useTransactionStore';

vi.mock('../lib/csvParser', () => ({
  getCSVHeaders: vi.fn().mockResolvedValue({
    headers: ['Date', 'Description', 'Amount'],
    delimiter: ',',
  }),
  detectBankFormat: vi.fn().mockReturnValue(null),
  autoDetectMapping: vi.fn().mockReturnValue({
    dateCol: 'Date',
    descCol: 'Description',
    amountCol: 'Amount',
    categoryCol: '',
    hasHeader: true,
    delimiter: ',',
  }),
  getPreviewTransactions: vi.fn().mockResolvedValue([]),
  parseCSVWithMapping: vi.fn().mockResolvedValue({
    accepted: [
      {
        id: 'tx-1',
        date: '2026-01-01',
        description: 'Coffee',
        amount: -4.5,
        category: 'Uncategorized',
        subCategory: '',
        isApproved: false,
        confidence: 0,
        reason: '',
      },
    ],
    rejected: [],
  }),
}));

const flush = async () => {
  await React.act(async () => {
    await Promise.resolve();
  });
};

describe('CSVUploader lifecycle reset (issue #21)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    useTransactionStore.setState({ transactions: [], error: null });
  });

  afterEach(() => {
    if (root) React.act(() => root.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  const render = () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<CSVUploader />);
    });
  };

  const selectFile = async () => {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['Date,Description,Amount'], 'statement.csv', { type: 'text/csv' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await React.act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });
    await flush();
    await flush();
  };

  it('walks idle → mapping → processing → preview without resetting mid-flow', async () => {
    render();

    expect(container.textContent).toContain('Drop your bank statement here');

    await selectFile();

    expect(container.textContent).toContain('Map Columns');
    expect(useTransactionStore.getState().error).toBeNull();

    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Next')
    );
    expect(nextBtn).toBeDefined();

    await React.act(async () => {
      nextBtn!.click();
      await Promise.resolve();
    });
    await flush();
    await flush();

    expect(container.textContent).toContain('Validate Data');
    expect(container.textContent).toContain('Coffee');
    expect(container.textContent).not.toContain('Drop your bank statement here');

    const backBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Back to Mapping')
    );
    expect(backBtn).toBeDefined();

    await React.act(async () => {
      backBtn!.click();
      await Promise.resolve();
    });
    await flush();

    expect(container.textContent).toContain('Map Columns');
    expect(container.textContent).not.toContain('Drop your bank statement here');
  });
});
