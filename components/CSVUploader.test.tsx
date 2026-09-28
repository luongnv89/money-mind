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

  it('opens the file picker from the keyboard (Enter and Space)', () => {
    render();

    const dropzone = container.querySelector('[role="button"]') as HTMLElement;
    expect(dropzone).not.toBeNull();
    expect(dropzone.getAttribute('tabindex')).toBe('0');

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    React.act(() => {
      dropzone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    React.act(() => {
      dropzone.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it('announces parse errors via role="alert" outside the dropzone button (review F16)', () => {
    useTransactionStore.setState({ error: 'Only .csv files are supported.' });
    render();

    const alert = container.querySelector('[role="alert"]') as HTMLElement;
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('Only .csv files are supported.');

    // Descendants of role="button" are presentational — the alert must live
    // outside the dropzone or assistive tech would never see it.
    const dropzone = container.querySelector('[role="button"]') as HTMLElement;
    expect(dropzone.contains(alert)).toBe(false);
  });
});
