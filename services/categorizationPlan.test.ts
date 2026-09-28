import { describe, expect, it } from 'vitest';
import { categorizationKey, groupForCategorization } from './categorizationPlan';
import { Transaction, TransactionCategory } from '../types';

const tx = (overrides: Partial<Transaction> = {}): Transaction =>
  ({
    id: 't1',
    date: '2024-01-01',
    description: 'Coffee',
    amount: -4.5,
    category: TransactionCategory.Uncategorized,
    confidence: 0,
    ...overrides,
  }) as Transaction;

describe('categorizationKey', () => {
  it('is case- and whitespace-insensitive on description', () => {
    expect(categorizationKey(tx({ description: 'COFFEE  SHOP' }))).toBe(
      categorizationKey(tx({ description: '  coffee shop ' }))
    );
  });

  it('encodes direction: out, in, zero', () => {
    expect(categorizationKey(tx({ amount: -1 }))).not.toBe(categorizationKey(tx({ amount: 1 })));
    expect(categorizationKey(tx({ amount: 0 }))).toBe(categorizationKey(tx({ amount: 0 })));
    expect(categorizationKey(tx({ amount: 0 }))).not.toBe(categorizationKey(tx({ amount: 1 })));
  });

  it('distinguishes the bank category label (case-insensitive)', () => {
    expect(categorizationKey(tx({ originalCategory: 'Dining' }))).toBe(
      categorizationKey(tx({ originalCategory: 'dining ' }))
    );
    expect(categorizationKey(tx({ originalCategory: 'Dining' }))).not.toBe(
      categorizationKey(tx({ originalCategory: 'Shopping' }))
    );
    // Missing and empty labels normalize to the same empty slot.
    expect(categorizationKey(tx({}))).toBe(categorizationKey(tx({ originalCategory: '' })));
  });

  it('keeps digits significant (exact-text matching only)', () => {
    expect(categorizationKey(tx({ description: 'INVOICE 1234' }))).not.toBe(
      categorizationKey(tx({ description: 'INVOICE 5678' }))
    );
  });
});

describe('groupForCategorization', () => {
  it('sends the first occurrence as representative and groups members under it', () => {
    const a1 = tx({ id: 'a1', description: 'Coffee Shop' });
    const a2 = tx({ id: 'a2', description: 'COFFEE  SHOP' });
    const b1 = tx({ id: 'b1', description: 'Bookstore' });
    const a3 = tx({ id: 'a3', description: 'coffee shop' });

    const { representatives, membersByRepId } = groupForCategorization([a1, a2, b1, a3]);

    expect(representatives.map((t) => t.id)).toEqual(['a1', 'b1']);
    expect(membersByRepId.get('a1')).toEqual(['a1', 'a2', 'a3']);
    expect(membersByRepId.get('b1')).toEqual(['b1']);
  });

  it('handles an empty list', () => {
    const { representatives, membersByRepId } = groupForCategorization([]);
    expect(representatives).toEqual([]);
    expect(membersByRepId.size).toBe(0);
  });
});
