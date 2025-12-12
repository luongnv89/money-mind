export enum TransactionCategory {
  Essential = 'Essential',
  Growth = 'Growth',
  Joy = 'Joy',
  Drift = 'Drift',
  Uncategorized = 'Uncategorized'
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: TransactionCategory;
  confidence: number;
  reason?: string;
  isLearned?: boolean;
  raw?: Record<string, any>;
  index?: number; // Original CSV row number
}

export interface LocalPattern {
  keyword: string;
  category: TransactionCategory;
  confidence: number;
  learnedFrom: string;
  correctedAt: string;
  timesApplied: number;
}

export type AIMode = 'cloud' | 'local';

export interface GeminiConfig {
  apiKey: string; // Stored obfuscated
  model: string;
}

export interface OllamaConfig {
  baseUrl: string;
  port: string;
  model: string;
}

export interface AppSettings {
  aiMode: AIMode;
  applyPatterns: boolean;
  geminiConfig: GeminiConfig;
  ollamaConfig: OllamaConfig;
}

export interface BankFormat {
  name: string;
  dateCol: string;
  descCol: string;
  amountCol: string;
  debitCreditCols?: boolean; // For Citi/Capital One style split columns
}

export interface CsvMapping {
  dateCol: string;
  descCol: string;
  amountCol: string;
  hasHeader: boolean;
  delimiter?: string;
}