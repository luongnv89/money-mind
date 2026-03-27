
export enum TransactionCategory {
  Income = 'Income',
  InternalTransfer = 'Internal Transfer',
  MustHave = 'Must-have',
  NiceToHave = 'Nice-to-have',
  Waste = 'Waste',
  Save = 'Save',
  Invest = 'Invest',
  Uncategorized = 'Uncategorized'
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
}

export interface CsvMapping {
  dateCol: string;
  descCol: string;
  amountCol: string;
  categoryCol?: string;
  hasHeader: boolean;
  delimiter?: string;
}
