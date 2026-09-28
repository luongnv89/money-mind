import { CategorizationResult, TransactionCategory } from '../types';
import { CATEGORY_HIERARCHY } from '../constants';

const canon = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '');

const CATEGORY_BY_CANON = new Map<string, TransactionCategory>(
  Object.values(TransactionCategory).map((value) => [canon(value), value])
);

// Common words models emit instead of our exact category labels.
const CATEGORY_SYNONYMS = new Map<string, TransactionCategory>([
  ['savings', TransactionCategory.Save],
  ['saving', TransactionCategory.Save],
  ['investment', TransactionCategory.Invest],
  ['investments', TransactionCategory.Invest],
  ['investing', TransactionCategory.Invest],
  ['transfer', TransactionCategory.InternalTransfer],
  ['transfers', TransactionCategory.InternalTransfer],
  ['needs', TransactionCategory.MustHave],
  ['essential', TransactionCategory.MustHave],
  ['essentials', TransactionCategory.MustHave],
  ['wants', TransactionCategory.NiceToHave],
  ['discretionary', TransactionCategory.NiceToHave],
]);

const normalizeConfidence = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0.5;
  if (value >= 0 && value <= 1) return value;
  if (value > 1 && value <= 100) return value / 100;
  return 0.5;
};

/**
 * Validate one raw LLM categorization entry before it reaches the store:
 * categories are canonicalized against `TransactionCategory` (plus a few
 * synonyms), subcategories must canon-match the hierarchy, confidence is
 * clamped to [0,1] (accepting 0–100 percentages), and unrecognized categories
 * degrade to a zero-confidence Uncategorized instead of being trusted.
 */
export const normalizeCategorization = (
  raw: unknown,
  defaultReason: string
): CategorizationResult => {
  const item = (raw ?? {}) as {
    id?: unknown;
    category?: unknown;
    subCategory?: unknown;
    confidence?: unknown;
    reason?: unknown;
  };

  const reason =
    typeof item.reason === 'string' && item.reason.trim() ? item.reason : defaultReason;
  const categoryRaw = typeof item.category === 'string' ? item.category : '';
  const resolvedCategory = categoryRaw
    ? (CATEGORY_BY_CANON.get(canon(categoryRaw)) ?? CATEGORY_SYNONYMS.get(canon(categoryRaw)))
    : undefined;

  if (!resolvedCategory) {
    return {
      id: typeof item.id === 'string' ? item.id : String(item.id ?? ''),
      category: TransactionCategory.Uncategorized,
      subCategory: undefined,
      confidence: 0,
      reason: `AI returned an unrecognized category "${categoryRaw}"`,
    };
  }

  const subCategoryRaw = typeof item.subCategory === 'string' ? item.subCategory : '';
  const subCategory = subCategoryRaw
    ? CATEGORY_HIERARCHY[resolvedCategory].find((s) => canon(s) === canon(subCategoryRaw))
    : undefined;

  return {
    id: typeof item.id === 'string' ? item.id : String(item.id ?? ''),
    category: resolvedCategory,
    subCategory,
    confidence: normalizeConfidence(item.confidence),
    reason,
  };
};
