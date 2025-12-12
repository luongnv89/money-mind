import { TransactionCategory, BankFormat } from './types';

export const CATEGORY_COLORS = {
  [TransactionCategory.Essential]: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
  [TransactionCategory.Growth]: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  [TransactionCategory.Joy]: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  [TransactionCategory.Drift]: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  [TransactionCategory.Uncategorized]: { bg: 'bg-white', text: 'text-gray-500', border: 'border-dashed border-gray-300' },
};

export const SUPPORTED_BANKS: BankFormat[] = [
  { name: 'Chase', dateCol: 'Transaction Date', descCol: 'Description', amountCol: 'Amount' },
  { name: 'Bank of America', dateCol: 'Date', descCol: 'Description', amountCol: 'Amount' },
  { name: 'Wells Fargo', dateCol: 'Date', descCol: 'Description', amountCol: 'Amount' },
  { name: 'AmEx', dateCol: 'Date', descCol: 'Description', amountCol: 'Amount' },
  { name: 'Citi', dateCol: 'Date', descCol: 'Description', amountCol: '', debitCreditCols: true }, // Logic handled in parser
];

export const MAX_FILE_SIZE_MB = 10;
export const MAX_TRANSACTIONS = 5000;
