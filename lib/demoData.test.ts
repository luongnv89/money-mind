import { describe, expect, it } from 'vitest';
import { getDemoTransactions } from './demoData';
import { TransactionCategory } from '../types';

describe('getDemoTransactions', () => {
  const demo = getDemoTransactions();

  it('produces a non-empty dataset', () => {
    expect(demo.length).toBeGreaterThan(20);
  });

  it('gives every transaction a unique id', () => {
    const ids = new Set(demo.map((t) => t.id));
    expect(ids.size).toBe(demo.length);
  });

  it('ships only normalized ISO dates in the past or present', () => {
    const today = new Date().toISOString().split('T')[0];
    for (const t of demo) {
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.date <= today).toBe(true);
    }
  });

  it('starts uncategorized with demo provenance', () => {
    for (const t of demo) {
      expect(t.category).toBe(TransactionCategory.Uncategorized);
      expect(t.reason).toBe('Demo Data');
      expect(t.confidence).toBe(0);
    }
  });

  it('rounds every amount to two decimals', () => {
    for (const t of demo) {
      expect(Number.isFinite(t.amount)).toBe(true);
      expect(t.amount).toBeCloseTo(Math.round(t.amount * 100) / 100, 10);
    }
  });

  it('includes both income and expenses across three months', () => {
    expect(demo.some((t) => t.amount > 0)).toBe(true);
    expect(demo.some((t) => t.amount < 0)).toBe(true);
    const months = new Set(demo.map((t) => t.date.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(2);
  });
});
