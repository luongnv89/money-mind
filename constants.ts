import { TransactionCategory, BankFormat } from './types';

export const CATEGORY_COLORS = {
  [TransactionCategory.Income]: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  }, // #22c55e
  [TransactionCategory.InternalTransfer]: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
  }, // #6b7280
  [TransactionCategory.MustHave]: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  }, // #ef4444
  [TransactionCategory.NiceToHave]: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  }, // #3b82f6
  [TransactionCategory.Waste]: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  }, // #f59e0b
  [TransactionCategory.Save]: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  }, // #10b981
  [TransactionCategory.Invest]: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
  }, // #8b5cf6
  [TransactionCategory.Uncategorized]: {
    bg: 'bg-white',
    text: 'text-gray-500',
    border: 'border-dashed border-gray-300',
  },
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
    name: 'AmEx',
    dateCol: 'Date',
    descCol: 'Description',
    amountCol: 'Amount',
    categoryCol: 'Category',
  },
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
export const MAX_TRANSACTIONS = 5000;
