import React, { useState, useEffect, useId } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { X, DollarSign, Calendar, Tag } from 'lucide-react';
import { Button, Input } from './UI';
import { Transaction, TransactionCategory } from '../types';
import { CATEGORY_HIERARCHY } from '../constants';
import { cn, todayLocalISO } from '../lib/utils';
import { closeOnBackdrop, useDialog } from '../lib/useDialog';

interface AddTransactionModalProps {
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ onClose, onSave }) => {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [date, setDate] = useState(todayLocalISO());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<TransactionCategory>(TransactionCategory.Uncategorized);
  const [subCategory, setSubCategory] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const baseId = useId();
  const titleId = `${baseId}-title`;
  const panelRef = useDialog<HTMLDivElement>(true, onClose);

  // Reset subcategory when category changes
  useEffect(() => {
    setSubCategory('');
  }, [category]);

  // Handle type change logic
  useEffect(() => {
    if (type === 'income') {
      setCategory(TransactionCategory.Income);
    } else {
      // If switching to expense, reset to Uncategorized to force user selection
      setCategory(TransactionCategory.Uncategorized);
    }
  }, [type]);

  const availableCategories = Object.keys(CATEGORY_HIERARCHY).filter((cat) => {
    if (cat === TransactionCategory.Uncategorized) return false;

    if (type === 'income') {
      return cat === TransactionCategory.Income;
    } else {
      return cat !== TransactionCategory.Income;
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!description.trim()) newErrors.description = 'Description is required';
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) === 0)
      newErrors.amount = 'Valid amount is required';
    if (category === TransactionCategory.Uncategorized)
      newErrors.category = 'Please select a category';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const numericAmount = parseFloat(amount);
    const finalAmount = type === 'expense' ? -Math.abs(numericAmount) : Math.abs(numericAmount);

    const newTransaction: Transaction = {
      id: uuidv4(),
      date: date,
      description: description.trim(),
      amount: finalAmount,
      category: category,
      subCategory: subCategory || undefined,
      confidence: 1.0,
      isApproved: true,
      isLearned: true,
      reason: 'Manually added',
      originalCategory: 'Manual Entry',
    };

    onSave(newTransaction);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs"
      onClick={closeOnBackdrop(onClose)}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md animate-rise overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_8px_40px_-12px_rgba(15,27,45,.25)]"
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <h3 id={titleId} className="font-display text-lg text-ink">
            Add Transaction
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted transition-colors hover:text-ink"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type Toggle — mutually exclusive; aria-pressed exposes the
              selected state (which flips the amount sign) to AT. */}
          <div
            role="group"
            aria-label="Transaction type"
            className="flex rounded-lg border border-line bg-surface-muted p-1"
          >
            <button
              type="button"
              aria-pressed={type === 'expense'}
              onClick={() => setType('expense')}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-all',
                type === 'expense'
                  ? 'bg-surface text-negative shadow-xs'
                  : 'text-muted hover:text-ink'
              )}
            >
              Expense
            </button>
            <button
              type="button"
              aria-pressed={type === 'income'}
              onClick={() => setType('income')}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-all',
                type === 'income'
                  ? 'bg-surface text-positive shadow-xs'
                  : 'text-muted hover:text-ink'
              )}
            >
              Income
            </button>
          </div>

          {/* Amount & Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor={`${baseId}-date`}
                className="text-xs font-semibold uppercase tracking-wide text-muted"
              >
                Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-muted" />
                <Input
                  id={`${baseId}-date`}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`${baseId}-amount`}
                className="text-xs font-semibold uppercase tracking-wide text-muted"
              >
                Amount
              </label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-2.5 w-4 h-4 text-muted" />
                <Input
                  id={`${baseId}-amount`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (errors.amount) setErrors({ ...errors, amount: '' });
                  }}
                  aria-invalid={!!errors.amount}
                  aria-describedby={errors.amount ? `${baseId}-amount-error` : undefined}
                  className={cn(
                    'pl-9',
                    errors.amount ? 'border-negative/60 focus-visible:ring-negative/30' : ''
                  )}
                />
              </div>
              {errors.amount && (
                <p id={`${baseId}-amount-error`} className="text-xs text-negative">
                  {errors.amount}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label
              htmlFor={`${baseId}-description`}
              className="text-xs font-semibold uppercase tracking-wide text-muted"
            >
              Description
            </label>
            <Input
              id={`${baseId}-description`}
              placeholder="e.g. Grocery Store, Rent, Salary"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors({ ...errors, description: '' });
              }}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? `${baseId}-description-error` : undefined}
              className={cn(
                errors.description ? 'border-negative/60 focus-visible:ring-negative/30' : ''
              )}
            />
            {errors.description && (
              <p id={`${baseId}-description-error`} className="text-xs text-negative">
                {errors.description}
              </p>
            )}
          </div>

          {/* Category Selection */}
          <div className="space-y-1.5">
            <label
              htmlFor={`${baseId}-category`}
              className="text-xs font-semibold uppercase tracking-wide text-muted"
            >
              Category
            </label>
            <div className="relative">
              <Tag className="absolute left-2.5 top-2.5 w-4 h-4 text-muted" />
              <select
                id={`${baseId}-category`}
                value={category}
                onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                aria-invalid={!!errors.category}
                aria-describedby={errors.category ? `${baseId}-category-error` : undefined}
                className={cn(
                  'flex h-10 w-full rounded-md border border-line-strong bg-surface px-3 py-2 pl-9 text-sm text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50',
                  errors.category ? 'border-negative/60 focus-visible:ring-negative/30' : ''
                )}
              >
                <option value={TransactionCategory.Uncategorized} disabled>
                  Select a category
                </option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            {errors.category && (
              <p id={`${baseId}-category-error`} className="text-xs text-negative">
                {errors.category}
              </p>
            )}
          </div>

          {/* Subcategory Selection */}
          {category !== TransactionCategory.Uncategorized && (
            <div className="space-y-1.5 animate-rise">
              <label
                htmlFor={`${baseId}-subcategory`}
                className="text-xs font-semibold uppercase tracking-wide text-muted"
              >
                Subcategory
              </label>
              <Input
                id={`${baseId}-subcategory`}
                list={`${baseId}-subcategories`}
                placeholder="Select or type..."
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
              />
              <datalist id={`${baseId}-subcategories`}>
                {CATEGORY_HIERARCHY[category]?.map((sub) => (
                  <option key={sub} value={sub} />
                ))}
              </datalist>
            </div>
          )}

          <div className="flex gap-3 pt-4 mt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save Transaction
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
