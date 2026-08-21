import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyPatterns,
  clearPatterns,
  extractMerchantName,
  getPatterns,
  importPatterns,
  learnPattern,
} from './localStorage';
import { Transaction, TransactionCategory } from '../types';

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  date: '2025-03-09',
  description: 'STARBUCKS #12345',
  amount: -5.75,
  category: TransactionCategory.Uncategorized,
  confidence: 0,
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
});

describe('extractMerchantName', () => {
  it('uppercases and strips dates, hash codes and long digit runs', () => {
    const merchant = extractMerchantName('Starbucks #12345 01/15 store 987654');
    expect(merchant).toContain('STARBUCKS');
    expect(merchant).not.toContain('#');
    expect(merchant).not.toContain('01/15');
    expect(merchant).not.toMatch(/\d{4,}/);
  });

  it('caps the keyword at 20 characters', () => {
    expect(extractMerchantName('A'.repeat(50)).length).toBeLessThanOrEqual(20);
  });
});

describe('learnPattern', () => {
  it('stores a new pattern at 0.8 confidence', () => {
    learnPattern(tx(), TransactionCategory.NiceToHave, 'Dining Out');

    const patterns = getPatterns();
    expect(patterns).toHaveLength(1);
    expect(patterns[0].category).toBe(TransactionCategory.NiceToHave);
    expect(patterns[0].subCategory).toBe('Dining Out');
    expect(patterns[0].confidence).toBe(0.8);
    expect(patterns[0].timesApplied).toBe(1);
  });

  it('reinforces an existing keyword rather than duplicating it', () => {
    learnPattern(tx(), TransactionCategory.NiceToHave, 'Dining Out');
    learnPattern(tx({ id: 'tx-2' }), TransactionCategory.Waste, 'Excessive Dining');

    const patterns = getPatterns();
    expect(patterns).toHaveLength(1);
    expect(patterns[0].category).toBe(TransactionCategory.Waste);
    expect(patterns[0].confidence).toBeCloseTo(0.9);
    expect(patterns[0].timesApplied).toBe(2);
  });

  it('never pushes confidence above 1.0', () => {
    for (let i = 0; i < 10; i++) {
      learnPattern(tx(), TransactionCategory.Waste);
    }
    expect(getPatterns()[0].confidence).toBeLessThanOrEqual(1.0);
  });
});

describe('applyPatterns', () => {
  it('is a no-op when nothing has been learned', () => {
    const input = [tx()];
    const result = applyPatterns(input);

    expect(result.appliedCount).toBe(0);
    expect(result.transactions).toBe(input);
  });

  it('recategorizes a matching transaction and marks it learned', () => {
    learnPattern(tx(), TransactionCategory.NiceToHave, 'Dining Out');

    const result = applyPatterns([tx({ id: 'tx-2', description: 'STARBUCKS #99887' })]);

    expect(result.appliedCount).toBe(1);
    expect(result.transactions[0].category).toBe(TransactionCategory.NiceToHave);
    expect(result.transactions[0].isLearned).toBe(true);
    expect(result.transactions[0].reason).toBe('Learned from your history');
  });

  it('leaves user-approved transactions alone', () => {
    learnPattern(tx(), TransactionCategory.NiceToHave, 'Dining Out');

    const approved = tx({ isApproved: true, category: TransactionCategory.MustHave });
    const result = applyPatterns([approved]);

    expect(result.appliedCount).toBe(0);
    expect(result.transactions[0].category).toBe(TransactionCategory.MustHave);
  });
});

describe('importPatterns', () => {
  it('rejects JSON whose root is not an array', () => {
    const result = importPatterns('{"keyword":"X"}');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/must be an array/i);
  });

  it('rejects malformed JSON without throwing', () => {
    expect(importPatterns('{oops').success).toBe(false);
  });

  it('imports valid entries and skips entries missing required fields', () => {
    const payload = JSON.stringify([
      { keyword: 'NETFLIX', category: TransactionCategory.NiceToHave },
      { category: TransactionCategory.Waste },
    ]);

    const result = importPatterns(payload);

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(getPatterns()[0].confidence).toBe(1.0);
  });
});

describe('clearPatterns', () => {
  it('empties the store', () => {
    learnPattern(tx(), TransactionCategory.Waste);
    clearPatterns();
    expect(getPatterns()).toEqual([]);
  });
});

describe('getPatterns with corrupt storage', () => {
  it('returns an empty array instead of throwing on malformed JSON', () => {
    localStorage.setItem('financePatterns', '{not valid json');
    expect(() => getPatterns()).not.toThrow();
    expect(getPatterns()).toEqual([]);
  });

  it('returns an empty array when stored value is not an array', () => {
    localStorage.setItem('financePatterns', '{"keyword":"X"}');
    expect(getPatterns()).toEqual([]);
  });

  it('recovers: patterns can be learned again after corruption', () => {
    localStorage.setItem('financePatterns', '{broken');
    expect(getPatterns()).toEqual([]);
    learnPattern(tx(), TransactionCategory.NiceToHave, 'Dining Out');
    expect(getPatterns()).toHaveLength(1);
  });
});
