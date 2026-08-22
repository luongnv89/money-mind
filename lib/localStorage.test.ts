import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyPatterns,
  buildPatternIndex,
  clearPatterns,
  extractMerchantName,
  findBestPatternIndexed,
  getPatterns,
  importPatterns,
  learnPattern,
  matchesKeyword,
  MIN_KEYWORD_LENGTH,
} from './localStorage';
import { LocalPattern, Transaction, TransactionCategory } from '../types';

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

  it('does not let UBER EATS collide with a learned UBER TRIP pattern (issue #37, F-BUG-015)', () => {
    learnPattern(tx({ description: 'UBER TRIP 01/15' }), TransactionCategory.MustHave, 'Transport');

    const eats = applyPatterns([
      tx({
        id: 'eats',
        description: 'UBER EATS 02/20',
        category: TransactionCategory.Uncategorized,
      }),
    ]);

    expect(eats.appliedCount).toBe(0);
    expect(eats.transactions[0].category).toBe(TransactionCategory.Uncategorized);

    const trip = applyPatterns([
      tx({
        id: 'trip',
        description: 'UBER TRIP 02/21',
        category: TransactionCategory.Uncategorized,
      }),
    ]);

    expect(trip.appliedCount).toBe(1);
    expect(trip.transactions[0].category).toBe(TransactionCategory.MustHave);
  });

  it('prefers the longest matching keyword over a shorter prefix', () => {
    localStorage.setItem(
      'financePatterns',
      JSON.stringify([
        {
          keyword: 'UBER',
          category: TransactionCategory.Waste,
          subCategory: undefined,
          confidence: 0.9,
          timesApplied: 5,
          learnedFrom: 'UBER',
          correctedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          keyword: 'UBER TRIP',
          category: TransactionCategory.MustHave,
          subCategory: 'Transport',
          confidence: 0.9,
          timesApplied: 3,
          learnedFrom: 'UBER TRIP',
          correctedAt: '2026-01-01T00:00:00.000Z',
        },
      ])
    );

    const result = applyPatterns([tx({ description: 'UBER TRIP 03/04' })]);

    expect(result.appliedCount).toBe(1);
    expect(result.transactions[0].category).toBe(TransactionCategory.MustHave);
  });

  it('matches whole tokens inside the merchant string, but never a bare substring', () => {
    expect(matchesKeyword('SQ COFFEE SHOP', 'COFFEE')).toBe(true);
    expect(matchesKeyword('SUBWAY', 'BWAY')).toBe(false);
    expect(matchesKeyword('NETFLIX', 'FLIX')).toBe(false);
  });

  it(`ignores keywords shorter than ${MIN_KEYWORD_LENGTH} characters`, () => {
    expect(matchesKeyword('AMAZON MKT', 'AM')).toBe(false);
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

describe('buildPatternIndex / findBestPatternIndexed (issue #40, F-PERF-006)', () => {
  const pattern = (
    keyword: string,
    category: TransactionCategory = TransactionCategory.Waste
  ): LocalPattern => ({
    keyword,
    category,
    subCategory: undefined,
    confidence: 0.9,
    timesApplied: 1,
    learnedFrom: keyword,
    correctedAt: '2026-01-01T00:00:00.000Z',
  });

  /** The previous full-scan matcher, kept as the equivalence oracle. */
  const findBestPatternScan = (
    merchant: string,
    patterns: LocalPattern[]
  ): LocalPattern | undefined => {
    const matches = patterns.filter((p) => matchesKeyword(merchant, p.keyword));
    if (matches.length === 0) return undefined;
    return matches.sort((a, b) => b.keyword.length - a.keyword.length)[0];
  };

  it('indexes by keyword and skips keywords that can never match', () => {
    const patterns = [pattern('UBER TRIP'), pattern('AM'), pattern('NETFLIX')];
    const index = buildPatternIndex(patterns);

    expect(index.size).toBe(2);
    expect(index.get('UBER TRIP')?.pattern.keyword).toBe('UBER TRIP');
    // 'AM' is skipped but still consumes array position 1, so NETFLIX is 2.
    expect(index.get('NETFLIX')?.order).toBe(2);
  });

  it('keeps the first stored pattern when a keyword repeats', () => {
    const first = pattern('UBER', TransactionCategory.MustHave);
    const second = pattern('UBER', TransactionCategory.Waste);
    const index = buildPatternIndex([first, second]);

    expect(index.get('UBER')?.pattern).toBe(first);
  });

  it('prefers the longest keyword, breaking length ties by first stored', () => {
    const short = pattern('UBER');
    const long = pattern('UBER TRIP', TransactionCategory.MustHave);
    const tied = pattern('TRIP', TransactionCategory.NiceToHave);
    const index = buildPatternIndex([short, long, tied]);

    expect(findBestPatternIndexed('UBER TRIP', index)?.keyword).toBe('UBER TRIP');
    expect(findBestPatternIndexed('SQ TRIP', index)?.keyword).toBe('TRIP');
    expect(findBestPatternIndexed('UBER EATS', index)?.keyword).toBe('UBER');
  });

  it('never matches a bare substring, exactly like matchesKeyword', () => {
    const index = buildPatternIndex([pattern('COFFEE')]);
    expect(findBestPatternIndexed('SQ COFFEE SHOP', index)?.keyword).toBe('COFFEE');
    expect(findBestPatternIndexed('MYCOFFEELADY', index)).toBeUndefined();
  });

  it('is equivalent to the previous full scan across a generated corpus', () => {
    const keywords = [
      'UBER',
      'UBER TRIP',
      'UBER EATS',
      'SQ COFFEE SHOP',
      'COFFEE',
      'NETFLIX',
      'AMAZON MKTPLACE',
      'TST* CAFE LUCA',
      'CAFE',
      'LUCA',
      'SHELL OIL',
      'CHEVRON',
      'ACH DELTA AIR',
      'DELTA',
      'AIR',
      'PNP KINGPRONTO',
    ];
    const patterns = keywords.map((k) => pattern(k));
    const index = buildPatternIndex(patterns);

    const merchants = [
      'UBER TRIP',
      'UBER EATS',
      'UBER',
      'SQ COFFEE SHOP',
      'COFFEE SHOP',
      'NETFLIX.COM',
      'AMAZON MKTPLACE P',
      'TST* CAFE LUCA',
      'CAFE LUCA',
      'SHELL OIL 4449',
      'CHEVRON 0093',
      'ACH DELTA AIR 00',
      'DELTA AIR',
      'PNP KINGPRONTO',
      'AIR CANADA',
      'KINGPRONTO',
      'UNRELATED GROCER',
      'MYCOFFEELADY',
      'CAFE',
      'AIR',
    ];

    merchants.forEach((merchant) => {
      expect(findBestPatternIndexed(merchant, index)).toEqual(
        findBestPatternScan(merchant, patterns)
      );
    });
  });

  it('benchmarks 5,000 rows against 500 patterns in under 200 ms', () => {
    const KEYWORD_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const keywords: string[] = [];
    for (let i = 0; i < 500; i++) {
      // Distinct, realistic (<=20 char) uppercase keywords with token structure.
      const stem = (i * 7919).toString(36).toUpperCase().padEnd(8, 'X').slice(0, 8);
      keywords.push(`${stem} ${KEYWORD_POOL[i % 26]}${i}`);
    }
    const patterns: LocalPattern[] = keywords.map((k) => pattern(k, TransactionCategory.MustHave));
    // Persist so applyPatterns reads exactly 500 patterns from storage.
    localStorage.setItem('financePatterns', JSON.stringify(patterns));

    const rows: Transaction[] = Array.from({ length: 5000 }, (_, i) =>
      tx({
        id: `row-${i}`,
        // extractMerchantName strips the trailing "#NNNN", leaving the keyword.
        description: `${keywords[i % keywords.length]} #${100000 + i}`,
      })
    );

    const start = performance.now();
    const result = applyPatterns(rows);
    const elapsed = performance.now() - start;

    expect(result.transactions).toHaveLength(5000);
    // Most rows hit a learned pattern at 0.9 confidence (> 0.6 gate).
    expect(result.appliedCount).toBeGreaterThan(4000);
    expect(elapsed).toBeLessThan(200);
  });
});
