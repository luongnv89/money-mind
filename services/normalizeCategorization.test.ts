import { describe, expect, it } from 'vitest';
import { normalizeCategorization } from './normalizeCategorization';
import { TransactionCategory } from '../types';

describe('normalizeCategorization (Phase A5)', () => {
  it('keeps a well-formed result and preserves the id', () => {
    expect(
      normalizeCategorization(
        {
          id: 't1',
          category: 'Waste',
          subCategory: 'Late Fees & Penalties',
          confidence: 0.9,
          reason: 'fee',
        },
        'AI'
      )
    ).toEqual({
      id: 't1',
      category: TransactionCategory.Waste,
      subCategory: 'Late Fees & Penalties',
      confidence: 0.9,
      reason: 'fee',
    });
  });

  it('canon-matches category spellings regardless of case/punctuation', () => {
    for (const raw of ['nice-to-have', 'Nice To Have!', 'NICETOHAVE', 'Must-Have']) {
      const r = normalizeCategorization({ id: 'x', category: raw }, 'AI');
      expect(r.confidence).toBe(0.5); // confidence missing → 0.5
      expect([TransactionCategory.NiceToHave, TransactionCategory.MustHave]).toContain(r.category);
    }
  });

  it.each([
    ['Savings', TransactionCategory.Save],
    ['investments', TransactionCategory.Invest],
    ['Transfer', TransactionCategory.InternalTransfer],
    ['essential', TransactionCategory.MustHave],
    ['wants', TransactionCategory.NiceToHave],
  ])('maps synonym "%s" to %s', (raw, expected) => {
    expect(normalizeCategorization({ id: 'x', category: raw }, 'AI').category).toBe(expected);
  });

  it('degrades unknown/missing categories to zero-confidence Uncategorized', () => {
    const unknown = normalizeCategorization({ id: 'x', category: 'Arts & Crafts' }, 'AI');
    expect(unknown).toMatchObject({
      category: TransactionCategory.Uncategorized,
      confidence: 0,
      reason: 'AI returned an unrecognized category "Arts & Crafts"',
    });

    const missing = normalizeCategorization({ id: 'x' }, 'AI');
    expect(missing).toMatchObject({
      category: TransactionCategory.Uncategorized,
      confidence: 0,
      reason: 'AI returned an unrecognized category ""',
    });
  });

  it('keeps only subcategories that canon-match the resolved category hierarchy', () => {
    const ok = normalizeCategorization(
      { id: 'x', category: 'Must-have', subCategory: 'food &  groceries' },
      'AI'
    );
    expect(ok.subCategory).toBe('Food & Groceries');

    const wrongParent = normalizeCategorization(
      { id: 'x', category: 'Must-have', subCategory: 'Dining Out' },
      'AI'
    );
    expect(wrongParent.subCategory).toBeUndefined();
  });

  it.each([
    [0.4, 0.4],
    [0, 0],
    [1, 1],
    [87, 0.87], // 0–100 percentages divide by 100
    [undefined, 0.5],
    ['high', 0.5],
    [150, 0.5],
    [NaN, 0.5],
  ])('normalizes confidence %j → %j', (input, expected) => {
    const r = normalizeCategorization({ id: 'x', category: 'Waste', confidence: input }, 'AI');
    expect(r.confidence).toBe(expected);
  });

  it('falls back to the default reason when the model gives none', () => {
    expect(normalizeCategorization({ id: 'x', category: 'Waste' }, 'Groq AI').reason).toBe(
      'Groq AI'
    );
    expect(normalizeCategorization({ id: 'x', category: 'Waste', reason: '  ' }, 'AI').reason).toBe(
      'AI'
    );
  });
});
