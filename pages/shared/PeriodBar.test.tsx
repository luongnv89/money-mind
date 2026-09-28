import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PeriodBar } from './PeriodBar';
import { FinanceView, useFinanceView } from '../../lib/useFinance';
import { householdQuarter, makeTx } from '../../lib/finance/fixtures.test-util';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useViewStore } from '../../stores/useViewStore';
import { TransactionCategory } from '../../types';

const Harness: React.FC<{ eyebrow?: string }> = ({ eyebrow = 'Overview' }) => {
  const view: FinanceView = useFinanceView();
  return <PeriodBar eyebrow={eyebrow} view={view} />;
};

describe('PeriodBar', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const render = (eyebrow?: string) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<Harness eyebrow={eyebrow} />);
    });
  };

  const prevButton = () =>
    container.querySelector('button[aria-label="Previous month"]') as HTMLButtonElement;
  const nextButton = () =>
    container.querySelector('button[aria-label="Next month"]') as HTMLButtonElement;

  beforeEach(() => {
    useTransactionStore.setState({ transactions: householdQuarter(), error: null });
    useViewStore.setState({ granularity: 'month', anchor: '2026-04-30' });
  });

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
    useTransactionStore.getState().clearAll();
    useViewStore.setState({ granularity: 'month', anchor: null });
  });

  it('shows the eyebrow, period label and the date/count subline', () => {
    render();

    expect(container.textContent).toContain('Overview');
    expect(container.querySelector('h1')?.textContent).toBe('April 2026');
    expect(container.textContent).toContain('Apr 1, 2026 – Apr 30, 2026 · 8 transactions');
  });

  it('disables previous/next at the data edges', () => {
    render();
    // April is the latest month of data.
    expect(nextButton().disabled).toBe(true);
    expect(prevButton().disabled).toBe(false);

    React.act(() => {
      useViewStore.getState().setAnchor('2026-02-28');
    });
    expect(prevButton().disabled).toBe(true);
    expect(nextButton().disabled).toBe(false);
  });

  it('keeps all five granularity options in a constrained scrollable strip', () => {
    render();

    const group = container.querySelector('[role="radiogroup"]') as HTMLElement;
    expect(group.className).toContain('max-w-full');
    expect(group.className).toContain('overflow-x-auto');
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(5);
  });

  it('lists available periods in the select and switches on change', () => {
    render();
    const select = container.querySelector('select') as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toEqual(['April 2026', 'March 2026', 'February 2026']);

    React.act(() => {
      select.value = '2026-02';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('h1')?.textContent).toBe('February 2026');
  });

  it('marks an in-progress period with a status chip', () => {
    React.act(() => {
      useTransactionStore.setState({
        transactions: [
          ...householdQuarter(),
          makeTx('2026-05-05', 'SHOP', -10, TransactionCategory.NiceToHave),
        ],
      });
      useViewStore.setState({ granularity: 'month', anchor: '2026-05-05' });
    });
    render();
    expect(container.textContent).toContain('In progress · data through May 5, 2026');
  });

  it('switching granularity keeps the user’s place', () => {
    render();
    const quarter = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (r) => r.textContent === 'Quarter'
    ) as HTMLElement;
    React.act(() => {
      quarter.click();
    });
    expect(container.querySelector('h1')?.textContent).toBe('Q2 2026');
    expect(useViewStore.getState().anchor).toBe('2026-04-30');
  });

  it('hides period navigation for All time', () => {
    render();
    const allTime = Array.from(container.querySelectorAll('[role="radio"]')).find(
      (r) => r.textContent === 'All time'
    ) as HTMLElement;
    React.act(() => {
      allTime.click();
    });
    expect(container.querySelector('button[aria-label^="Previous"]')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('All time');
  });
});
