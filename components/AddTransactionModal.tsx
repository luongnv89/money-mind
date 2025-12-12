
import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { X, Check, DollarSign, Calendar, Type as TypeIcon, Tag } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from './UI';
import { Transaction, TransactionCategory } from '../types';
import { CATEGORY_HIERARCHY } from '../constants';
import { cn } from '../lib/utils';

interface AddTransactionModalProps {
    onClose: () => void;
    onSave: (transaction: Transaction) => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ onClose, onSave }) => {
    const [type, setType] = useState<'expense' | 'income'>('expense');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<TransactionCategory>(TransactionCategory.Uncategorized);
    const [subCategory, setSubCategory] = useState<string>('');
    const [errors, setErrors] = useState<Record<string, string>>({});

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

    const availableCategories = Object.keys(CATEGORY_HIERARCHY).filter(cat => {
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

        if (!description.trim()) newErrors.description = "Description is required";
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) === 0) newErrors.amount = "Valid amount is required";
        if (category === TransactionCategory.Uncategorized) newErrors.category = "Please select a category";

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
            originalCategory: 'Manual Entry'
        };

        onSave(newTransaction);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-lg font-semibold text-gray-900">Add Transaction</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Type Toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setType('expense')}
                            className={cn(
                                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                                type === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            Expense
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('income')}
                            className={cn(
                                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                                type === 'income' ? "bg-white text-green-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            Income
                        </button>
                    </div>

                    {/* Amount & Date Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="pl-9"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</label>
                            <div className="relative">
                                <DollarSign className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => {
                                        setAmount(e.target.value);
                                        if (errors.amount) setErrors({...errors, amount: ''});
                                    }}
                                    className={cn("pl-9", errors.amount ? "border-red-300 focus-visible:ring-red-200" : "")}
                                />
                            </div>
                            {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
                        <Input
                            placeholder="e.g. Grocery Store, Rent, Salary"
                            value={description}
                            onChange={(e) => {
                                setDescription(e.target.value);
                                if (errors.description) setErrors({...errors, description: ''});
                            }}
                            className={cn(errors.description ? "border-red-300 focus-visible:ring-red-200" : "")}
                        />
                         {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
                    </div>

                    {/* Category Selection */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</label>
                        <div className="relative">
                            <Tag className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                                className={cn(
                                    "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 pl-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
                                    errors.category ? "border-red-300 focus-visible:ring-red-200" : ""
                                )}
                            >
                                <option value={TransactionCategory.Uncategorized} disabled>Select a category</option>
                                {availableCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        {errors.category && <p className="text-xs text-red-500">{errors.category}</p>}
                    </div>

                    {/* Subcategory Selection */}
                    {category !== TransactionCategory.Uncategorized && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subcategory</label>
                            <Input
                                list="subcategories"
                                placeholder="Select or type..."
                                value={subCategory}
                                onChange={(e) => setSubCategory(e.target.value)}
                            />
                            <datalist id="subcategories">
                                {CATEGORY_HIERARCHY[category]?.map(sub => (
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
