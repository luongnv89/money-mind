import { Transaction, LocalPattern, TransactionCategory } from '../types';
import { logger } from './logger';

const STORAGE_KEY = 'financePatterns';

export const getPatterns = (): LocalPattern[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      logger.warn('Corrupt financePatterns storage, resetting to empty.');
      clearPatterns();
      return [];
    }
    return parsed as LocalPattern[];
  } catch {
    logger.warn('Corrupt financePatterns storage, resetting to empty.');
    clearPatterns();
    return [];
  }
};

const savePatterns = (patterns: LocalPattern[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
};

export const importPatterns = (
  json: string
): { success: boolean; count: number; error?: string } => {
  try {
    const imported = JSON.parse(json);
    if (!Array.isArray(imported)) {
      return { success: false, count: 0, error: 'Invalid file format: Root must be an array.' };
    }

    const currentPatterns = getPatterns();
    const map = new Map(currentPatterns.map((p) => [p.keyword, p]));
    let newCount = 0;

    imported.forEach((p: Partial<LocalPattern>) => {
      // Basic validation ensuring required fields exist
      if (typeof p.keyword === 'string' && typeof p.category === 'string') {
        const validPattern: LocalPattern = {
          keyword: p.keyword,
          category: p.category as TransactionCategory,
          subCategory: p.subCategory,
          // Use imported confidence or default to high confidence if manually imported
          confidence: typeof p.confidence === 'number' ? p.confidence : 1.0,
          timesApplied: typeof p.timesApplied === 'number' ? p.timesApplied : 1,
          learnedFrom: p.learnedFrom || 'Imported',
          correctedAt: p.correctedAt || new Date().toISOString(),
        };

        // Overwrite existing pattern for this keyword
        map.set(p.keyword, validPattern);
        newCount++;
      }
    });

    savePatterns(Array.from(map.values()));
    return { success: true, count: newCount };
  } catch (e: unknown) {
    return { success: false, count: 0, error: e instanceof Error ? e.message : 'Unknown error' };
  }
};

export const extractMerchantName = (description: string): string => {
  let cleaned = description.toUpperCase();
  // Remove dates
  cleaned = cleaned.replace(/\d{2}\/\d{2}/g, '');
  // Remove common garbage numbers/codes
  cleaned = cleaned.replace(/#\d+/g, '');
  cleaned = cleaned.replace(/\d{4,}/g, '');
  // Remove common location indicators
  cleaned = cleaned.replace(/\s(CA|NY|TX|FL|WA|DE)\s\d{5}/g, '');
  // Remove special chars
  cleaned = cleaned.replace(/[*#]/g, ' ');
  return cleaned.trim().substring(0, 20); // Limit length
};

export const learnPattern = (
  transaction: Transaction,
  newCategory: TransactionCategory,
  newSubCategory?: string
) => {
  const patterns = getPatterns();
  const keyword = extractMerchantName(transaction.description);

  const existingIndex = patterns.findIndex((p) => p.keyword === keyword);

  if (existingIndex >= 0) {
    patterns[existingIndex] = {
      ...patterns[existingIndex],
      category: newCategory,
      subCategory: newSubCategory,
      confidence: Math.min(patterns[existingIndex].confidence + 0.1, 1.0),
      timesApplied: patterns[existingIndex].timesApplied + 1,
      correctedAt: new Date().toISOString(),
    };
  } else {
    patterns.push({
      keyword,
      category: newCategory,
      subCategory: newSubCategory,
      confidence: 0.8,
      learnedFrom: transaction.description,
      correctedAt: new Date().toISOString(),
      timesApplied: 1,
    });
  }

  // Prune if too many
  if (patterns.length > 500) {
    patterns.sort((a, b) => a.timesApplied - b.timesApplied);
    patterns.splice(0, patterns.length - 500);
  }

  savePatterns(patterns);
};

/** Learned keywords shorter than this are too ambiguous to auto-apply. */
export const MIN_KEYWORD_LENGTH = 3;

/**
 * A learned keyword matches only on exact, prefix, or whole-token boundaries —
 * never a bare substring — so `UBER EATS` and `UBER TRIP` cannot collide.
 */
export const matchesKeyword = (merchant: string, keyword: string): boolean => {
  if (keyword.length < MIN_KEYWORD_LENGTH) return false;
  return merchant === keyword || merchant.startsWith(keyword) || merchant.includes(` ${keyword}`);
};

/** Prefer the longest matching keyword so the most specific pattern wins. */
const findBestPattern = (merchant: string, patterns: LocalPattern[]): LocalPattern | undefined => {
  const matches = patterns.filter((p) => matchesKeyword(merchant, p.keyword));
  if (matches.length === 0) return undefined;
  return matches.sort((a, b) => b.keyword.length - a.keyword.length)[0];
};

export const applyPatterns = (
  transactions: Transaction[]
): { transactions: Transaction[]; appliedCount: number } => {
  const patterns = getPatterns();
  if (patterns.length === 0) return { transactions, appliedCount: 0 };

  let appliedCount = 0;
  const newTransactions = transactions.map((tx) => {
    // Skip transactions that are already approved/verified by the user
    if (tx.isApproved) return tx;

    const merchant = extractMerchantName(tx.description);
    const match = findBestPattern(merchant, patterns);

    if (match && match.confidence > 0.6) {
      // Check if we are actually changing anything (category or upgrading confidence)
      const isUpgrade = tx.confidence < match.confidence;
      const isChange = tx.category !== match.category || tx.subCategory !== match.subCategory;

      if (isChange || isUpgrade) {
        appliedCount++;
        return {
          ...tx,
          category: match.category,
          subCategory: match.subCategory,
          confidence: match.confidence,
          reason: 'Learned from your history',
          isLearned: true,
        };
      }
    }
    return tx;
  });

  return { transactions: newTransactions, appliedCount };
};

export const clearPatterns = () => {
  localStorage.removeItem(STORAGE_KEY);
};
