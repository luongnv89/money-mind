import { describe, expect, it } from 'vitest';
import { demoCategoryFor, getDemoTransactions } from './demoData';
import { TransactionCategory } from '../types';

const TODAY = new Date(2026, 5, 15); // 2026-06-15 (local)

describe('getDemoTransactions', () => {
  const demo = getDemoTransactions(TODAY);

  it('is deterministic for a fixed date', () => {
    expect(getDemoTransactions(TODAY)).toEqual(getDemoTransactions(new Date(2026, 5, 15)));
  });

  it('produces a non-empty dataset with unique ids', () => {
    expect(demo.length).toBeGreaterThan(40);
    expect(new Set(demo.map((t) => t.id)).size).toBe(demo.length);
  });

  it('spans three full calendar months plus the current month to date', () => {
    const months = new Set(demo.map((t) => t.date.slice(0, 7)));
    expect(months).toEqual(new Set(['2026-03', '2026-04', '2026-05', '2026-06']));
    // A fixed 25th-of-month charge lands in the full months.
    expect(
      demo.some((t) => t.date === '2026-03-25' && t.description === 'CHASE CARD AUTOPAY')
    ).toBe(true);
  });

  it('never emits future dates and stops the current month at today', () => {
    for (const t of demo) {
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.date <= '2026-06-15').toBe(true);
    }
    // Day-22 subscription must not appear before the 22nd of the current month.
    expect(demo.some((t) => t.date === '2026-06-22')).toBe(false);
    // …but it does appear in the three complete months.
    expect(demo.some((t) => t.date === '2026-05-22' && t.description === 'OPENAI *CHATGPT')).toBe(
      true
    );
  });

  it('pre-categorizes every row except the deliberately unmapped check', () => {
    const uncategorized = demo.filter((t) => t.category === TransactionCategory.Uncategorized);
    expect(uncategorized.map((t) => t.description)).toEqual(['CHECK 1043']);
    expect(uncategorized[0].amount).toBe(-250.0);
    expect(uncategorized[0].date).toBe('2026-05-11');
    for (const t of demo.filter((t) => t.category !== TransactionCategory.Uncategorized)) {
      expect(t.confidence).toBe(0.85);
      expect(t.isApproved).toBe(false);
      expect(t.reason).toBe('Demo data');
    }
  });

  it('includes the month extras', () => {
    const bestBuy = demo.find((t) => t.description === 'BEST BUY');
    expect(bestBuy).toMatchObject({ amount: -429.99, date: '2026-06-06' });
    const refund = demo.find((t) => t.description === 'AMAZON.COM REFUND');
    expect(refund).toMatchObject({ amount: 42.99, date: '2026-05-23' });
    expect(demo.some((t) => t.description === 'UPWORK ESCROW' && t.amount === 600)).toBe(true);
    expect(demo.some((t) => t.description === 'DELTA AIR LINES')).toBe(true);
  });
});

describe('demoCategoryFor', () => {
  it('maps demo labels into the category hierarchy', () => {
    expect(demoCategoryFor('Payroll')).toEqual([TransactionCategory.Income, 'Salary']);
    expect(demoCategoryFor('Freelance')).toEqual([
      TransactionCategory.Income,
      'Freelance & Consulting',
    ]);
    expect(demoCategoryFor('Rent')).toEqual([TransactionCategory.MustHave, 'Housing']);
    expect(demoCategoryFor('Auto Loan')).toEqual([TransactionCategory.MustHave, 'Debt Payments']);
    expect(demoCategoryFor('Card Payment')).toEqual([
      TransactionCategory.InternalTransfer,
      'Credit Card Payment',
    ]);
    expect(demoCategoryFor('Investment')).toEqual([TransactionCategory.Invest, 'Stock Market']);
    expect(demoCategoryFor('Fees')).toEqual([TransactionCategory.Waste, 'Late Fees & Penalties']);
  });

  it('returns null for anything unmapped', () => {
    expect(demoCategoryFor('Check')).toBeNull();
    expect(demoCategoryFor('mystery')).toBeNull();
    expect(demoCategoryFor(undefined)).toBeNull();
  });
});
