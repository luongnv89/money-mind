import React, { useState } from 'react';
import { useTransactionStore } from '../stores/useTransactionStore';
import { TransactionCategory, Transaction } from '../types';
import { CATEGORY_COLORS } from '../constants';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { Badge, Button } from './UI';
import { Check, Edit2, Download, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';

export const TransactionTable: React.FC = () => {
  const { transactions, updateCategory, bulkUpdateCategory } = useTransactionStore();
  const [filter, setFilter] = useState<TransactionCategory | 'All'>('All');
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredData = transactions.filter(t => filter === 'All' || t.category === filter);

  const handleCategoryChange = (id: string, category: TransactionCategory) => {
    updateCategory(id, category);
    setEditingId(null);
  };
  
  const handleExport = () => {
      const csv = Papa.unparse(transactions.map(({id, isLearned, ...rest}) => rest));
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `moneymind_export_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  if (transactions.length === 0) return null;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto">
          {['All', ...Object.values(TransactionCategory)].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat as any)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                filter === cat 
                  ? "bg-gray-900 text-white" 
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-900">Date</th>
                <th className="px-6 py-4 font-semibold text-gray-900">Description</th>
                <th className="px-6 py-4 font-semibold text-gray-900">Amount</th>
                <th className="px-6 py-4 font-semibold text-gray-900">Category</th>
                <th className="px-6 py-4 font-semibold text-gray-900">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredData.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="px-6 py-4 text-gray-900 font-medium max-w-xs truncate" title={t.description}>
                    {t.description}
                    {t.isLearned && <span className="ml-2 text-[10px] text-accent font-bold uppercase tracking-wide">Learned</span>}
                  </td>
                  <td className={cn("px-6 py-4 font-mono", t.amount > 0 ? "text-gray-900" : "text-green-600")}>
                    {formatCurrency(t.amount)}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === t.id ? (
                        <select 
                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-accent focus:border-accent block w-full p-2.5"
                            autoFocus
                            onBlur={() => setEditingId(null)}
                            onChange={(e) => handleCategoryChange(t.id, e.target.value as TransactionCategory)}
                            defaultValue={t.category}
                        >
                            {Object.values(TransactionCategory).map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    ) : (
                        <button 
                            onClick={() => setEditingId(t.id)}
                            className={cn(
                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border cursor-pointer hover:opacity-80",
                                CATEGORY_COLORS[t.category].bg,
                                CATEGORY_COLORS[t.category].text,
                                CATEGORY_COLORS[t.category].border
                            )}
                        >
                            {t.category}
                            <Edit2 className="w-3 h-3 ml-1.5 opacity-50" />
                        </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                                className={cn("h-full rounded-full", t.confidence > 0.8 ? "bg-green-500" : t.confidence > 0.5 ? "bg-yellow-500" : "bg-red-500")}
                                style={{ width: `${t.confidence * 100}%` }}
                            />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round(t.confidence * 100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredData.length === 0 && (
            <div className="p-12 text-center text-gray-500">
                No transactions found for this filter.
            </div>
        )}
      </div>
    </div>
  );
};