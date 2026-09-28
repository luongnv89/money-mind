import { TransactionCategory, BankFormat, AIMode, ModelInfo } from './types';

/**
 * Chart/swatch colors per category — the Private Wealth palette. Also the
 * source of truth for pill tints below (muted washes of the same hues).
 */
export const CATEGORY_CHART_COLORS: Record<TransactionCategory, string> = {
  [TransactionCategory.MustHave]: '#1F3A5F',
  [TransactionCategory.NiceToHave]: '#B08D57',
  [TransactionCategory.Waste]: '#A23B3B',
  [TransactionCategory.Save]: '#0E7A5A',
  [TransactionCategory.Invest]: '#3B7C8C',
  [TransactionCategory.Income]: '#0E6B55',
  [TransactionCategory.InternalTransfer]: '#9AA0A6',
  [TransactionCategory.Uncategorized]: '#BDB6A8',
};

/**
 * Category pill styling — muted tints of CATEGORY_CHART_COLORS with text
 * dark enough for ≥4.5:1 contrast. Literal class strings only (Tailwind
 * scans this file via the @source glob in src/index.css).
 */
export const CATEGORY_COLORS = {
  [TransactionCategory.Income]: {
    bg: 'bg-[#E0EEE9]',
    text: 'text-[#0E6B55]',
    border: 'border-[#C2DCD3]',
  },
  [TransactionCategory.InternalTransfer]: {
    bg: 'bg-[#F0F1F2]',
    text: 'text-[#5E6673]',
    border: 'border-[#DDE0E3]',
  },
  [TransactionCategory.MustHave]: {
    bg: 'bg-[#E9EEF5]',
    text: 'text-[#1F3A5F]',
    border: 'border-[#C9D4E4]',
  },
  [TransactionCategory.NiceToHave]: {
    bg: 'bg-[#F3EBDD]',
    text: 'text-[#7A5E33]',
    border: 'border-[#E3D4BB]',
  },
  [TransactionCategory.Waste]: {
    bg: 'bg-[#F5E4E4]',
    text: 'text-[#A23B3B]',
    border: 'border-[#E8C9C9]',
  },
  [TransactionCategory.Save]: {
    bg: 'bg-[#E2F0EA]',
    text: 'text-[#0E7A5A]',
    border: 'border-[#C4E0D4]',
  },
  [TransactionCategory.Invest]: {
    bg: 'bg-[#E4EFF2]',
    text: 'text-[#2E6472]',
    border: 'border-[#C8DEE4]',
  },
  [TransactionCategory.Uncategorized]: {
    bg: 'bg-surface-muted',
    text: 'text-muted',
    border: 'border-dashed border-line-strong',
  },
};

/** User-facing provider names, shared by Settings, Transactions and the Assistant. */
export const AI_PROVIDER_LABELS: Record<AIMode, string> = {
  cloud: 'Gemini',
  groq: 'Groq',
  local: 'Ollama',
  custom: 'Custom endpoint',
};

export const CATEGORY_HIERARCHY: Record<TransactionCategory, string[]> = {
  [TransactionCategory.Income]: [
    'Salary',
    'Freelance & Consulting',
    'Business Income',
    'Rental Income',
    'Investment Returns',
    'Bonus & Commissions',
    'Side Hustle',
    'Gifts & Inheritance',
    'Refunds & Reimbursements',
    'Government Benefits',
    'Pension & Retirement',
    'Other Income',
  ],
  [TransactionCategory.InternalTransfer]: [
    'Account to Account',
    'ATM Withdrawal/Deposit',
    'Credit Card Payment',
    'Investment Transfer',
    'Loan/Line of Credit',
  ],
  [TransactionCategory.MustHave]: [
    'Food & Groceries',
    'Health & Medical',
    'Housing',
    'Transportation',
    'Debt Payments',
    'Insurance',
    'Taxes',
    'Childcare',
    'Work Expenses',
    'Basic Clothing',
  ],
  [TransactionCategory.NiceToHave]: [
    'Dining Out',
    'Entertainment',
    'Shopping',
    'Personal Care',
    'Fitness & Sports',
    'Education',
    'Travel & Leisure',
    'Home Improvement',
    'Technology',
    'Gifts',
  ],
  [TransactionCategory.Waste]: [
    'Impulse Purchases',
    'Excessive Dining',
    'Unused Subscriptions',
    'Duplicated Items',
    'Poor Quality Purchases',
    'Late Fees & Penalties',
    'Gambling',
    'Overpriced Services',
    'Brand Premium',
    'Emotional Spending',
  ],
  [TransactionCategory.Save]: [
    'Emergency Fund',
    'Retirement Savings',
    'Short-term Savings',
    'Long-term Savings',
    'Child Education Fund',
    'House Down Payment',
    'Car Replacement',
    'Vacation Fund',
    'Medical Fund',
    'General Savings',
  ],
  [TransactionCategory.Invest]: [
    'Stock Market',
    'Real Estate',
    'Business Investment',
    'Cryptocurrency',
    'Bonds',
    'Education Investment',
    'Equipment & Tools',
    'Health Investment',
    'Network Investment',
    'Self Development',
  ],
  [TransactionCategory.Uncategorized]: [],
};

export const SUPPORTED_BANKS: BankFormat[] = [
  {
    name: 'Chase',
    dateCol: 'Transaction Date',
    descCol: 'Description',
    amountCol: 'Amount',
    categoryCol: 'Category',
  },
  {
    // AmEx must precede Bank of America: both share Date/Description/Amount/
    // Category headers, so AmEx is distinguished by its extra 'Card Member'
    // column. AmEx exports charges as positive and payments as negative, so
    // amounts are inverted on import.
    name: 'AmEx',
    dateCol: 'Date',
    descCol: 'Description',
    amountCol: 'Amount',
    categoryCol: 'Category',
    requiredCols: ['Card Member'],
    invertAmounts: true,
  },
  {
    name: 'Bank of America',
    dateCol: 'Date',
    descCol: 'Description',
    amountCol: 'Amount',
    categoryCol: 'Category',
  },
  {
    name: 'Wells Fargo',
    dateCol: 'Date',
    descCol: 'Description',
    amountCol: 'Amount',
    categoryCol: 'Category',
  }, // Often 'Category' or 'Type'
  {
    name: 'Citi',
    dateCol: 'Date',
    descCol: 'Description',
    amountCol: '',
    debitCreditCols: true,
    debitCol: 'Debit',
    creditCol: 'Credit',
  },
];

export const MAX_FILE_SIZE_MB = 10;

// --- AI model catalog (issue #79) ---

/**
 * Default model per provider — the single source of truth for the settings
 * store's initial and reset state (issue #79).
 */
export const DEFAULT_MODELS: Record<AIMode, string> = {
  cloud: 'models/gemini-flash-latest',
  groq: 'llama-3.1-8b-instant',
  local: 'llama3.2',
  custom: 'gpt-3.5-turbo',
};

/**
 * Curated fallback shown when a provider's live model list cannot be fetched
 * (missing key, network failure, API change). These are the last models known
 * to work at release time; live lists replace them once loaded (issue #79).
 */
export const FALLBACK_MODEL_CATALOG: Record<AIMode, ModelInfo[]> = {
  cloud: [
    { id: 'models/gemini-flash-latest', label: 'gemini-flash-latest (Recommended)' },
    { id: 'models/gemini-flash-lite-latest', label: 'gemini-flash-lite-latest (Fastest)' },
    { id: 'models/gemini-3-pro-preview', label: 'gemini-3-pro-preview (Most Capable)' },
  ],
  groq: [
    { id: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant (Recommended)' },
    { id: 'openai/gpt-oss-20b', label: 'openai/gpt-oss-20b (Most Capable)' },
  ],
  local: [{ id: 'llama3.2', label: 'llama3.2' }],
  // Common OpenAI-compatible aliases — arbitrary servers accept their own ids
  // via free-text entry, so this list is only a starting point (issue #82).
  custom: [
    { id: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo (Common alias)' },
    { id: 'gpt-4o-mini', label: 'gpt-4o-mini (Common alias)' },
  ],
};

export const TYPESAFE_API_BASE = '/typesafe-api';

export const TYPESAFE_MODEL = 'jev-latest';
