import { Transaction, LocalPattern, TransactionCategory } from '../types';

const STORAGE_KEY = 'financePatterns';

export const getPatterns = (): LocalPattern[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const savePatterns = (patterns: LocalPattern[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
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

export const learnPattern = (transaction: Transaction, newCategory: TransactionCategory) => {
  const patterns = getPatterns();
  const keyword = extractMerchantName(transaction.description);
  
  const existingIndex = patterns.findIndex((p) => p.keyword === keyword);
  
  if (existingIndex >= 0) {
    patterns[existingIndex] = {
      ...patterns[existingIndex],
      category: newCategory,
      confidence: Math.min(patterns[existingIndex].confidence + 0.1, 1.0),
      timesApplied: patterns[existingIndex].timesApplied + 1,
      correctedAt: new Date().toISOString(),
    };
  } else {
    patterns.push({
      keyword,
      category: newCategory,
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

export const applyPatterns = (transactions: Transaction[]): Transaction[] => {
  const patterns = getPatterns();
  if (patterns.length === 0) return transactions;

  return transactions.map((tx) => {
    const merchant = extractMerchantName(tx.description);
    const match = patterns.find((p) => merchant.includes(p.keyword) || p.keyword.includes(merchant));
    
    if (match && match.confidence > 0.6) {
      return {
        ...tx,
        category: match.category,
        confidence: match.confidence,
        reason: 'Learned from your history',
        isLearned: true,
      };
    }
    return tx;
  });
};

export const clearPatterns = () => {
  localStorage.removeItem(STORAGE_KEY);
};
