import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFinanceModel, buildLedger, Period, periodFor } from '../../lib/finance';
import { householdQuarter, usd } from '../../lib/finance/fixtures.test-util';
import { CashFlowChart } from './CashFlowChart';

let clickedPeriod: Period;
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: ({
    dataKey,
    onClick,
  }: {
    dataKey: string;
    onClick: (entry: { payload: { period: Period } }, index: number) => void;
  }) => (
    <button type="button" onClick={() => onClick({ payload: { period: clickedPeriod } }, 0)}>
      {dataKey}
    </button>
  ),
  Cell: () => null,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

describe('CashFlowChart bar selection', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
  });

  it('selects the period in the Recharts wrapper payload for both bars', () => {
    const ledger = buildLedger(householdQuarter());
    const period = periodFor(ledger, 'month', '2026-04-30')!;
    const model = buildFinanceModel(ledger, period, usd);
    clickedPeriod = model.trend[0].period;
    const onSelectPeriod = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() =>
      root.render(<CashFlowChart model={model} fmt={usd} onSelectPeriod={onSelectPeriod} />)
    );

    for (const key of ['income', 'spending']) {
      const bar = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === key
      )!;
      React.act(() => (bar as HTMLButtonElement).click());
    }
    expect(onSelectPeriod).toHaveBeenCalledTimes(2);
    expect(onSelectPeriod).toHaveBeenNthCalledWith(1, clickedPeriod);
    expect(onSelectPeriod).toHaveBeenNthCalledWith(2, clickedPeriod);
  });
});
