export enum TransactionCategory {
  Income = 'Income',
  InternalTransfer = 'Internal Transfer',
  MustHave = 'Must-have',
  NiceToHave = 'Nice-to-have',
  Waste = 'Waste',
  Save = 'Save',
  Invest = 'Invest',
  Uncategorized = 'Uncategorized',
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: TransactionCategory;
  subCategory?: string;
  originalCategory?: string; // Category from bank import
  confidence: number;
  reason?: string;
  isLearned?: boolean;
  isApproved?: boolean; // User has verified this transaction
  raw?: Record<string, unknown>;
  index?: number; // Original CSV row number
}

export interface LocalPattern {
  keyword: string;
  category: TransactionCategory;
  subCategory?: string;
  confidence: number;
  learnedFrom: string;
  correctedAt: string;
  timesApplied: number;
}

export type AIMode = 'cloud' | 'local' | 'groq';

export interface GeminiConfig {
  apiKey: string; // Stored obfuscated
  model: string;
}

export interface GroqConfig {
  apiKey: string; // Stored obfuscated
  model: string;
}

export interface OllamaConfig {
  baseUrl: string;
  port: string;
  model: string;
}

/**
 * How a provider's model list was resolved (issue #79): straight from the
 * provider's API, from the local TTL cache, or the curated fallback list.
 */
export type ModelCatalogStatus = 'live' | 'cached' | 'fallback';

/** One selectable AI model; `id` is the exact string sent to the provider. */
export interface ModelInfo {
  id: string;
  label: string;
}

/** Resolved model catalog for a single provider (issue #79). */
export interface ModelCatalog {
  provider: AIMode;
  status: ModelCatalogStatus;
  models: ModelInfo[];
  /** Shown in Settings when the live list could not be loaded (degraded mode). */
  notice?: string;
}

export interface UsageStats {
  txAnalyzed: number;
  chatMessages: number;
  lastReset: string;
}

export interface AppSettings {
  aiMode: AIMode;
  isDemoMode: boolean;
  applyPatterns: boolean;
  enableFunnyAlerts: boolean; // New setting
  geminiConfig: GeminiConfig;
  groqConfig: GroqConfig;
  ollamaConfig: OllamaConfig;
  usage: UsageStats; // Budget control
}

export interface BankFormat {
  name: string;
  dateCol: string;
  descCol: string;
  amountCol: string;
  categoryCol?: string;
  debitCreditCols?: boolean; // For Citi/Capital One style split columns
  debitCol?: string; // Column holding money-out values when debitCreditCols is set
  creditCol?: string; // Column holding money-in values when debitCreditCols is set
}

export interface CsvMapping {
  dateCol: string;
  descCol: string;
  amountCol: string;
  categoryCol?: string;
  hasHeader: boolean;
  delimiter?: string;
  debitCreditCols?: boolean; // Amount lives in separate debit/credit columns
  debitCol?: string;
  creditCol?: string;
}
