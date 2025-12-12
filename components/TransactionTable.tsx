
import React, { useState, useEffect } from 'react';
import { useTransactionStore } from '../stores/useTransactionStore';
import { TransactionCategory, Transaction } from '../types';
import { CATEGORY_COLORS, CATEGORY_HIERARCHY } from '../constants';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { Button } from './UI';
import { Edit2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import Papa from 'papaparse';

const ITEMS_PER_PAGE = 10;

interface TransactionTableProps {
  transactions: Transaction[];
}

export const TransactionTable: React.FC<TransactionTableProps> = ({ transactions }) => {
  const { updateCategory } = useTransactionStore();
  const [filter, setFilter] = useState<TransactionCategory | 'All'>('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data (Category filter on top of Time filter)
  const filteredData = transactions.filter(t => filter === 'All' || t.category === filter);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
  );

  // BUG FIX: Only reset page if filter changes or the length of dataset drastically changes (new load).
  // Do not reset on every single transaction update (reference change).
  useEffect(() => {
      setCurrentPage(1);
  }, [filter, transactions.length]);

  // Ensure current page remains valid if data shrinks (e.g. items moved out of current filter)
  useEffect(() => {
      if (currentPage > totalPages && totalPages > 0) {
          setCurrentPage(totalPages);
      }
  }, [totalPages, currentPage]);

  const handleCategoryChange = (id: string, value: string) => {
    // Value format: "MainCategory:SubCategory"
    const [main, sub] = value.split(':');
    if (main) {
        updateCategory(id, main as TransactionCategory, sub || undefined);
    }
    setEditingId(null);
  };
  
  const handleExport = () => {
      // Export currently displayed (filtered by time) transactions
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

  if (transactions.length === 0) {
      return (
        <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            No transactions found for this time period.
        </div>
      );
  }

  return (
    <div className="w-full space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto scrollbar-hide">
          {['All', ...Object.values(TransactionCategory)].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat as any)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                filter === cat 
                  ? "bg-gray-900 text-white" 
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
            <Download className="w-3 h-3 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Description</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedData.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-6 py-3 text-gray-500 whitespace-nowrap text-xs">{formatDate(t.date)}</td>
                  <td className="px-6 py-3 text-gray-900 font-medium max-w-xs truncate" title={t.description}>
                    {t.description}
                    {t.isLearned && <span className="ml-2 text-[10px] text-accent font-bold uppercase tracking-wide">Learned</span>}
                  </td>
                  <td className={cn(
                      "px-6 py-3 font-mono text-sm font-semibold", 
                      t.amount > 0 ? "text-green-600" : t.amount < 0 ? "text-red-600" : "text-gray-900"
                  )}>
                    {t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}
                  </td>
                  <td className="px-6 py-3">
                    {editingId === t.id ? (
                        <select 
                            className="bg-white border border-gray-300 text-gray-900 text-xs rounded focus:ring-accent focus:border-accent block w-full p-1"
                            autoFocus
                            onBlur={() => setEditingId(null)}
                            onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                            defaultValue={`${t.category}:${t.subCategory || ''}`}
                        >
                            {Object.entries(CATEGORY_HIERARCHY).map(([mainCat, subCats]) => (
                                <optgroup key={mainCat} label={mainCat}>
                                    <option value={`${mainCat}:`}>{mainCat} (General)</option>
                                    {subCats.map(sub => (
                                        <option key={sub} value={`${mainCat}:${sub}`}>{sub}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    ) : (
                        <button 
                            onClick={() => setEditingId(t.id)}
                            className={cn(
                                "flex flex-col items-start px-3 py-1 rounded-md border cursor-pointer hover:opacity-80 w-full max-w-[180px]",
                                CATEGORY_COLORS[t.category].bg,
                                CATEGORY_COLORS[t.category].border
                            )}
                        >
                            <span className={cn("text-[10px] font-bold uppercase tracking-wide", CATEGORY_COLORS[t.category].text)}>
                                {t.category}
                            </span>
                            {t.subCategory && (
                                <span className={cn("text-xs font-medium truncate w-full text-left", CATEGORY_COLORS[t.category].text)}>
                                    {t.subCategory}
                                </span>
                            )}
                        </button>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                        <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                                className={cn("h-full rounded-full", t.confidence > 0.8 ? "bg-green-500" : t.confidence > 0.5 ? "bg-yellow-500" : "bg-red-500")}
                                style={{ width: `${t.confidence * 100}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">{Math.round(t.confidence * 100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {filteredData.length > 0 ? (
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                    Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}</span> of <span className="font-medium">{filteredData.length}</span> results
                </span>
                <div className="flex gap-1">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center justify-center min-w-[3rem] text-xs font-medium text-gray-600">
                        {currentPage} / {totalPages}
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 w-7 p-0"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        ) : (
            <div className="p-12 text-center text-gray-500 italic text-sm">
                No transactions found for this filter.
            </div>
        )}
      </div>
    </div>
  );
};
