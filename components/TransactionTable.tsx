import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTransactionStore } from '../stores/useTransactionStore';
import { TransactionCategory, Transaction } from '../types';
import { CATEGORY_COLORS, CATEGORY_HIERARCHY } from '../constants';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { Button } from './UI';
import { Edit2, Download, ChevronLeft, ChevronRight, Search, Check, CheckCircle2, CircleDashed } from 'lucide-react';
import Papa from 'papaparse';

const ITEMS_PER_PAGE = 10;

// --- Category Dropdown Component ---

interface CategoryDropdownProps {
    anchorRect: DOMRect;
    currentCategory: TransactionCategory;
    currentSubCategory?: string;
    onSelect: (category: TransactionCategory, subCategory?: string) => void;
    onClose: () => void;
}

const CategoryDropdown: React.FC<CategoryDropdownProps> = ({ anchorRect, currentCategory, currentSubCategory, onSelect, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-focus search on open
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Handle scroll to close dropdown, but ONLY if scrolling outside
    useEffect(() => {
        const handleScroll = (e: Event) => {
            // Check if the scroll event originated from inside the dropdown container
            if (containerRef.current && containerRef.current.contains(e.target as Node)) {
                return;
            }
            // If scrolling happens outside (e.g. main body), close the dropdown to keep it anchored correctly
            onClose();
        };

        // Capture true is needed to catch scroll events which don't bubble
        window.addEventListener('scroll', handleScroll, { capture: true });
        return () => window.removeEventListener('scroll', handleScroll, { capture: true });
    }, [onClose]);

    // Calculate position (viewport relative since we use fixed container)
    const positionStyle = useMemo(() => {
        const padding = 8;
        const width = 300;
        const maxDropdownHeight = 400; 
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        // Default: Drop down
        let top: number | undefined = anchorRect.bottom + padding;
        let bottom: number | undefined = undefined;
        let left = anchorRect.left;

        // Check vertical space
        const spaceBelow = viewportHeight - anchorRect.bottom;
        const spaceAbove = anchorRect.top;

        // If not enough space below AND more space above, flip upwards
        if (spaceBelow < maxDropdownHeight && spaceAbove > spaceBelow) {
             top = undefined;
             bottom = viewportHeight - anchorRect.top + padding;
        }

        // Check horizontal space
        if (left + width > viewportWidth) {
            left = viewportWidth - width - padding;
        }
        
        // Ensure it doesn't go off the left edge
        left = Math.max(padding, left);

        return { top, bottom, left, width };
    }, [anchorRect]);

    // Filter categories
    const filteredHierarchy = useMemo(() => {
        const term = searchTerm.toLowerCase();
        const result: Record<string, string[]> = {};

        Object.entries(CATEGORY_HIERARCHY).forEach(([cat, subs]) => {
            // If header matches, show all. If subs match, show them.
            if (cat.toLowerCase().includes(term)) {
                result[cat] = subs;
            } else {
                const matchingSubs = subs.filter(s => s.toLowerCase().includes(term));
                if (matchingSubs.length > 0) {
                    result[cat] = matchingSubs;
                }
            }
        });
        return result;
    }, [searchTerm]);

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-start" style={{ pointerEvents: 'none' }}>
            {/* Backdrop for click outside */}
            <div 
                className="absolute inset-0 bg-transparent" 
                style={{ pointerEvents: 'auto' }} 
                onClick={onClose} 
            />
            
            {/* Dropdown Panel */}
            <div 
                ref={containerRef}
                className={cn(
                    "absolute bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100",
                    positionStyle.bottom !== undefined ? "origin-bottom-left" : "origin-top-left"
                )}
                style={{ 
                    top: positionStyle.top, 
                    bottom: positionStyle.bottom,
                    left: positionStyle.left, 
                    width: positionStyle.width,
                    maxHeight: '400px',
                    pointerEvents: 'auto'
                }}
            >
                {/* Search Header */}
                <div className="p-2 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            ref={inputRef}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                            placeholder="Search category..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') onClose();
                            }}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1 py-1">
                    {Object.entries(filteredHierarchy).length > 0 ? (
                        Object.entries(filteredHierarchy).map(([cat, subs]: [string, string[]]) => {
                             const catStyle = CATEGORY_COLORS[cat as TransactionCategory] || CATEGORY_COLORS[TransactionCategory.Uncategorized];
                             return (
                                <div key={cat} className="mb-1">
                                    <div className={cn(
                                        "px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50/80 sticky top-0 backdrop-blur-sm",
                                        catStyle.text
                                    )}>
                                        {cat}
                                    </div>
                                    
                                    {/* General Option */}
                                    {(searchTerm === '' || cat.toLowerCase().includes(searchTerm.toLowerCase())) && (
                                        <button
                                            onClick={() => onSelect(cat as TransactionCategory, undefined)}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors",
                                                currentCategory === cat && !currentSubCategory ? "bg-accent/5 text-accent font-medium" : "text-gray-700"
                                            )}
                                        >
                                            <span>{cat} (General)</span>
                                            {currentCategory === cat && !currentSubCategory && <Check className="w-4 h-4" />}
                                        </button>
                                    )}

                                    {/* Subcategories */}
                                    {subs.map((sub: string) => (
                                        <button
                                            key={sub}
                                            onClick={() => onSelect(cat as TransactionCategory, sub)}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors pl-6",
                                                currentCategory === cat && currentSubCategory === sub ? "bg-accent/5 text-accent font-medium" : "text-gray-600"
                                            )}
                                        >
                                            <span>{sub}</span>
                                            {currentCategory === cat && currentSubCategory === sub && <Check className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            No matching categories found
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- Main Table Component ---

interface TransactionTableProps {
  transactions: Transaction[];
}

export const TransactionTable: React.FC<TransactionTableProps> = ({ transactions }) => {
  const { updateCategory, approveTransaction } = useTransactionStore();
  const [filter, setFilter] = useState<TransactionCategory | 'All'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Dropdown State
  const [activeDropdown, setActiveDropdown] = useState<{ id: string, rect: DOMRect } | null>(null);

  // Filter data (Category filter on top of Time filter)
  const filteredData = transactions.filter(t => filter === 'All' || t.category === filter);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
      setCurrentPage(1);
  }, [filter, transactions.length]);

  useEffect(() => {
      if (currentPage > totalPages && totalPages > 0) {
          setCurrentPage(totalPages);
      }
  }, [totalPages, currentPage]);

  const handleCategorySelect = (id: string, category: TransactionCategory, subCategory?: string) => {
      updateCategory(id, category, subCategory);
      setActiveDropdown(null);
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
                <th className="px-6 py-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedData.map((t) => {
                // Safely get colors with fallback
                const categoryColors = CATEGORY_COLORS[t.category] || CATEGORY_COLORS[TransactionCategory.Uncategorized];
                
                return (
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
                    <button 
                        onClick={(e) => {
                            // Use getBoundingClientRect to get absolute viewport position
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActiveDropdown({ id: t.id, rect });
                        }}
                        className={cn(
                            "flex flex-col items-start px-3 py-1.5 rounded-md border cursor-pointer hover:shadow-sm transition-all w-full max-w-[180px] group",
                            categoryColors.bg,
                            categoryColors.border,
                            activeDropdown?.id === t.id ? "ring-2 ring-accent/50" : ""
                        )}
                    >
                        <div className="flex items-center justify-between w-full">
                            <span className={cn("text-[10px] font-bold uppercase tracking-wide", categoryColors.text)}>
                                {t.category}
                            </span>
                            <Edit2 className={cn("w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity", categoryColors.text)} />
                        </div>
                        {t.subCategory && (
                            <span className={cn("text-xs font-medium truncate w-full text-left mt-0.5", categoryColors.text)}>
                                {t.subCategory}
                            </span>
                        )}
                    </button>
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
                  <td className="px-6 py-3 text-center">
                    {t.isApproved ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200" title="Approved">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Approved</span>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                             <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                <CircleDashed className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-medium">Wait</span>
                             </div>
                             <button 
                                onClick={() => approveTransaction(t.id)}
                                className="p-1.5 rounded-full bg-white border border-gray-300 text-gray-400 hover:text-green-600 hover:border-green-500 hover:bg-green-50 transition-all shadow-sm"
                                title="Click to Approve"
                             >
                                <Check className="w-4 h-4" />
                             </button>
                        </div>
                    )}
                  </td>
                </tr>
              )})}
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

      {/* Render Portal Dropdown */}
      {activeDropdown && (
          <CategoryDropdown 
              anchorRect={activeDropdown.rect}
              currentCategory={transactions.find(t => t.id === activeDropdown.id)?.category || TransactionCategory.Uncategorized}
              currentSubCategory={transactions.find(t => t.id === activeDropdown.id)?.subCategory}
              onClose={() => setActiveDropdown(null)}
              onSelect={(cat, sub) => handleCategorySelect(activeDropdown.id, cat, sub)}
          />
      )}
    </div>
  );
};