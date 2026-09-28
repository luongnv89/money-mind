import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTransactionStore } from '../stores/useTransactionStore';
import { TransactionCategory, Transaction } from '../types';
import { CATEGORY_COLORS, CATEGORY_HIERARCHY } from '../constants';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { useDebouncedValue } from '../lib/useDebounce';
import { Button, Input } from './UI';
import {
  Edit2,
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Trash2,
} from 'lucide-react';
import Papa from 'papaparse';
import { ConfirmDialog } from './ConfirmDialog';

const ITEMS_PER_PAGE = 25;

// --- Category Dropdown Component ---

interface CategoryDropdownProps {
  /** The button the dropdown is anchored to; live element so the dropdown can reposition while the page scrolls (F-UX-009). */
  anchorEl: HTMLElement;
  currentCategory: TransactionCategory;
  currentSubCategory?: string;
  onSelect: (category: TransactionCategory, subCategory?: string) => void;
  onClose: () => void;
}

const CategoryDropdown: React.FC<CategoryDropdownProps> = ({
  anchorEl,
  currentCategory,
  currentSubCategory,
  onSelect,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorRect, setAnchorRect] = useState<DOMRect>(() => anchorEl.getBoundingClientRect());
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const anchorElRef = useRef(anchorEl);

  useEffect(() => {
    onCloseRef.current = onClose;
    anchorElRef.current = anchorEl;
  });

  // Auto-focus search on open
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Escape closes from anywhere in the dropdown (not just the search input),
  // and closing returns focus to the row button that opened it (WCAG 2.4.3).
  // Mount-only effect: onClose/anchorEl are read through refs so parent
  // re-renders don't re-run the cleanup and steal focus mid-search.
  useEffect(() => {
    const panel = containerRef.current;
    const anchor = anchorElRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (panel?.contains(document.activeElement)) {
        anchor.focus();
      }
    };
  }, []);

  // Follow the anchor on scroll/resize instead of detaching: reposition while
  // the anchor is on screen, close once it scrolls out of view (F-UX-009).
  useEffect(() => {
    const reposition = (e: Event) => {
      // Scrolling inside the dropdown itself must not move or close it.
      if (
        containerRef.current &&
        e.target instanceof Node &&
        containerRef.current.contains(e.target)
      ) {
        return;
      }
      const rect = anchorEl.getBoundingClientRect();
      if (
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth
      ) {
        onClose();
        return;
      }
      setAnchorRect(rect);
    };
    window.addEventListener('scroll', reposition, { capture: true, passive: true });
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', reposition);
    };
  }, [anchorEl, onClose]);

  // Calculate position
  const positionStyle = useMemo(() => {
    const padding = 8;
    const width = 300;
    const maxDropdownHeight = 400;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let top: number | undefined = anchorRect.bottom + padding;
    let bottom: number | undefined = undefined;
    let left = anchorRect.left;

    const spaceBelow = viewportHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;

    if (spaceBelow < maxDropdownHeight && spaceAbove > spaceBelow) {
      top = undefined;
      bottom = viewportHeight - anchorRect.top + padding;
    }

    if (left + width > viewportWidth) {
      left = viewportWidth - width - padding;
    }

    left = Math.max(padding, left);

    return { top, bottom, left, width };
  }, [anchorRect]);

  const filteredHierarchy = useMemo<Record<string, string[]>>(() => {
    const term = searchTerm.toLowerCase();
    const result: Record<string, string[]> = {};

    Object.entries(CATEGORY_HIERARCHY).forEach(([cat, subs]) => {
      if (cat.toLowerCase().includes(term)) {
        result[cat] = subs;
      } else {
        const matchingSubs = subs.filter((s) => s.toLowerCase().includes(term));
        if (matchingSubs.length > 0) {
          result[cat] = matchingSubs;
        }
      }
    });
    return result;
  }, [searchTerm]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-start"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="absolute inset-0 bg-transparent"
        style={{ pointerEvents: 'auto' }}
        onClick={onClose}
      />
      <div
        ref={containerRef}
        className={cn(
          'absolute bg-surface rounded-lg shadow-xl border border-line flex flex-col overflow-hidden animate-rise',
          positionStyle.bottom !== undefined ? 'origin-bottom-left' : 'origin-top-left'
        )}
        style={{
          top: positionStyle.top,
          bottom: positionStyle.bottom,
          left: positionStyle.left,
          width: positionStyle.width,
          maxHeight: '400px',
          pointerEvents: 'auto',
        }}
      >
        <div className="p-2 border-b border-line bg-surface-muted/60 sticky top-0 z-10">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted" />
            <input
              ref={inputRef}
              aria-label="Search categories"
              className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-line rounded-md focus:outline-hidden focus:ring-2 focus:ring-accent/50 focus:border-accent"
              placeholder="Search category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 py-1" role="listbox" aria-label="Categories">
          {Object.entries(filteredHierarchy).length > 0 ? (
            Object.entries(filteredHierarchy).map(([cat, subs]) => {
              const catStyle =
                CATEGORY_COLORS[cat as TransactionCategory] ||
                CATEGORY_COLORS[TransactionCategory.Uncategorized];
              return (
                <div key={cat} className="mb-1" role="group" aria-label={cat}>
                  <div
                    className={cn(
                      'px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-surface-muted/80 sticky top-0 backdrop-blur-xs',
                      catStyle.text
                    )}
                  >
                    {cat}
                  </div>
                  {(searchTerm === '' || cat.toLowerCase().includes(searchTerm.toLowerCase())) && (
                    <button
                      role="option"
                      aria-selected={currentCategory === cat && !currentSubCategory}
                      onClick={() => onSelect(cat as TransactionCategory, undefined)}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-surface-muted transition-colors',
                        currentCategory === cat && !currentSubCategory
                          ? 'bg-accent/5 text-accent font-medium'
                          : 'text-ink'
                      )}
                    >
                      <span>{cat} (General)</span>
                      {currentCategory === cat && !currentSubCategory && (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  {Array.isArray(subs) &&
                    subs.map((sub: string) => (
                      <button
                        key={sub}
                        role="option"
                        aria-selected={currentCategory === cat && currentSubCategory === sub}
                        onClick={() => onSelect(cat as TransactionCategory, sub)}
                        className={cn(
                          'w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-surface-muted transition-colors pl-6',
                          currentCategory === cat && currentSubCategory === sub
                            ? 'bg-accent/5 text-accent font-medium'
                            : 'text-ink-soft'
                        )}
                      >
                        <span>{sub}</span>
                        {currentCategory === cat && currentSubCategory === sub && (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    ))}
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-muted text-sm">No matching categories found</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- Sortable Header Helper ---

const SortHeader = ({
  label,
  sKey,
  currentSort,
  onSort,
  className,
}: {
  label: string;
  sKey: string;
  currentSort: { key: string; direction: 'asc' | 'desc' };
  onSort: (k: string) => void;
  className?: string;
}) => {
  const isActive = currentSort.key === sKey;
  return (
    <th
      className={cn('px-3 py-3 sm:px-6 font-medium select-none', className)}
      aria-sort={
        isActive ? (currentSort.direction === 'asc' ? 'ascending' : 'descending') : undefined
      }
    >
      <button
        type="button"
        onClick={() => onSort(sKey)}
        className={cn(
          'group flex w-full items-center gap-1.5 rounded-sm font-medium transition-colors hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent',
          className?.includes('text-center') && 'justify-center'
        )}
      >
        {label}
        <span className="text-muted group-hover:text-ink-soft flex flex-col" aria-hidden="true">
          {isActive ? (
            currentSort.direction === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
          )}
        </span>
      </button>
    </th>
  );
};

// --- Main Table Component ---

export type QuickFilter = 'all' | 'needsReview' | 'uncategorized';

interface TransactionTableProps {
  transactions: Transaction[];
  /** Controlled quick filter (e.g. set by the page's summary chips). */
  quickFilter?: QuickFilter;
  onQuickFilterChange?: (filter: QuickFilter) => void;
}

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'needsReview', label: 'Needs review' },
  { value: 'uncategorized', label: 'Uncategorized' },
];

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  quickFilter: controlledQuickFilter,
  onQuickFilterChange,
}) => {
  const { updateCategory, approveTransaction, deleteTransaction } = useTransactionStore();

  // State
  const [internalQuickFilter, setInternalQuickFilter] = useState<QuickFilter>('all');
  const quickFilter = controlledQuickFilter ?? internalQuickFilter;
  const setQuickFilter = (filter: QuickFilter) => {
    setInternalQuickFilter(filter);
    onQuickFilterChange?.(filter);
  };
  const [categoryFilter, setCategoryFilter] = useState<TransactionCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced at ~150 ms so filtering/sorting runs once typing pauses, not per
  // keystroke (F-PERF-008).
  const debouncedSearchQuery = useDebouncedValue(searchQuery);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [activeDropdown, setActiveDropdown] = useState<{ id: string; anchor: HTMLElement } | null>(
    null
  );

  // Confirmation Modal State
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  // Handlers
  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      // Default to descending for amounts and dates, ascending for text
      const defaultDesc = ['date', 'amount', 'confidence'].includes(key);
      return { key, direction: defaultDesc ? 'desc' : 'asc' };
    });
  };

  const handleCategorySelect = (
    id: string,
    category: TransactionCategory,
    subCategory?: string
  ) => {
    updateCategory(id, category, subCategory);
    setActiveDropdown(null);
  };

  // Process Data
  const processedData = useMemo<Transaction[]>(() => {
    let data = [...transactions];

    // 0. Quick filter
    if (quickFilter === 'uncategorized') {
      data = data.filter((t) => t.category === TransactionCategory.Uncategorized);
    } else if (quickFilter === 'needsReview') {
      data = data.filter(
        (t) =>
          t.category !== TransactionCategory.Uncategorized && !t.isApproved && t.confidence < 0.5
      );
    }

    // 1. Filter by Category
    if (categoryFilter !== 'All') {
      data = data.filter((t) => t.category === categoryFilter);
    }

    // 2. Filter by Search (debounced — see state above)
    if (debouncedSearchQuery.trim()) {
      const lowerQuery = debouncedSearchQuery.toLowerCase().trim();
      data = data.filter(
        (t) =>
          t.description.toLowerCase().includes(lowerQuery) ||
          t.amount.toString().includes(lowerQuery) ||
          t.subCategory?.toLowerCase().includes(lowerQuery) ||
          (t.originalCategory && t.originalCategory.toLowerCase().includes(lowerQuery))
      );
    }

    // 3. Sort
    data.sort((a, b) => {
      const key = sortConfig.key;
      const direction = sortConfig.direction === 'asc' ? 1 : -1;

      if (key === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        const valA = isNaN(dateA) ? 0 : dateA;
        const valB = isNaN(dateB) ? 0 : dateB;
        return (valA - valB) * direction;
      }
      if (key === 'amount') {
        return (a.amount - b.amount) * direction;
      }
      if (key === 'description') {
        return a.description.localeCompare(b.description) * direction;
      }
      if (key === 'category') {
        return a.category.localeCompare(b.category) * direction;
      }
      if (key === 'confidence') {
        return (a.confidence - b.confidence) * direction;
      }
      if (key === 'status') {
        const aVal = a.isApproved ? 1 : 0;
        const bVal = b.isApproved ? 1 : 0;
        return (aVal - bVal) * direction;
      }
      return 0;
    });

    return data;
  }, [transactions, quickFilter, categoryFilter, debouncedSearchQuery, sortConfig]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [quickFilter, categoryFilter, debouncedSearchQuery, transactions.length]);

  // Pagination Logic
  const totalPages = Math.ceil(processedData.length / ITEMS_PER_PAGE);
  const paginatedData = processedData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Auto-correct page if out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handleExport = () => {
    const csv = Papa.unparse(
      processedData.map(({ id: _id, isLearned: _isLearned, ...rest }) => rest)
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `moneymind_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const confirmDelete = () => {
    if (transactionToDelete) {
      deleteTransaction(transactionToDelete);
      setTransactionToDelete(null);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="w-full bg-surface rounded-xl shadow-card border border-line p-8 text-center text-muted">
        No transactions found for this time period.
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <ConfirmDialog
        isOpen={!!transactionToDelete}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setTransactionToDelete(null)}
      />

      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <Input
              placeholder="Search transactions..."
              aria-label="Search transactions"
              className="pl-9 bg-surface"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink-soft"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="shrink-0 w-full sm:w-auto"
          >
            <Download className="w-3 h-3 mr-2" /> Export Processed CSV
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto w-full scrollbar-hide">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setQuickFilter(f.value)}
              aria-pressed={quickFilter === f.value}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap border',
                quickFilter === f.value
                  ? 'bg-accent text-paper border-accent'
                  : 'bg-surface text-ink-soft border-line hover:bg-surface-muted'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full scrollbar-hide">
          {['All', ...Object.values(TransactionCategory)].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat as TransactionCategory | 'All')}
              aria-pressed={categoryFilter === cat}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border',
                categoryFilter === cat
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-surface text-ink-soft border-line hover:bg-surface-muted'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-xl shadow-card border border-line overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted border-b border-line text-xs uppercase tracking-wider text-muted sticky top-0 z-10 shadow-xs">
              <tr>
                <SortHeader
                  label="Date"
                  sKey="date"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  className="hidden sm:table-cell"
                />
                <SortHeader
                  label="Description"
                  sKey="description"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Amount"
                  sKey="amount"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Category"
                  sKey="category"
                  currentSort={sortConfig}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Confidence"
                  sKey="confidence"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  className="hidden sm:table-cell"
                />
                <SortHeader
                  label="Actions"
                  sKey="status"
                  currentSort={sortConfig}
                  onSort={handleSort}
                  className="text-center"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paginatedData.map((t) => {
                const categoryColors =
                  CATEGORY_COLORS[t.category] || CATEGORY_COLORS[TransactionCategory.Uncategorized];

                return (
                  <tr key={t.id} className="group/row hover:bg-surface-muted/70 transition-colors">
                    <td className="hidden sm:table-cell px-3 py-3 sm:px-6 h-11 num text-ink-soft whitespace-nowrap text-xs">
                      {formatDate(t.date)}
                    </td>
                    <td
                      className="px-3 py-3 sm:px-6 h-11 text-ink font-medium max-w-[8.5rem] sm:max-w-xs truncate"
                      title={t.description}
                    >
                      {t.description}
                      {t.isLearned && (
                        <span className="ml-2 text-[10px] text-accent font-bold uppercase tracking-wide">
                          Learned
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSort('date')}
                        aria-label="Sort by date"
                        className="mt-0.5 flex items-center gap-1 whitespace-normal text-xs font-normal text-muted sm:hidden"
                      >
                        {formatDate(t.date)}
                        {sortConfig.key === 'date' &&
                          (sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          ))}
                      </button>
                    </td>
                    <td
                      className={cn(
                        'px-3 py-3 sm:px-6 h-11 num text-sm font-semibold whitespace-nowrap',
                        t.amount > 0 ? 'text-positive' : t.amount < 0 ? 'text-ink' : 'text-muted'
                      )}
                    >
                      {t.amount > 0 ? '+' : ''}
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-3 py-3 sm:px-6 h-11">
                      <button
                        onClick={(e) => {
                          setActiveDropdown({ id: t.id, anchor: e.currentTarget });
                        }}
                        aria-label={`Change category for ${t.description}`}
                        aria-haspopup="listbox"
                        aria-expanded={activeDropdown?.id === t.id}
                        className={cn(
                          'flex flex-col items-start px-3 py-1.5 min-h-11 justify-center rounded-md border cursor-pointer hover:shadow-xs transition-all w-full max-w-[7rem] sm:max-w-[180px] group',
                          categoryColors.bg,
                          categoryColors.border,
                          activeDropdown?.id === t.id ? 'ring-2 ring-accent/50' : ''
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={cn(
                              'text-[10px] font-bold uppercase tracking-wide',
                              categoryColors.text
                            )}
                          >
                            {t.category}
                          </span>
                          <Edit2
                            className={cn(
                              'w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity',
                              categoryColors.text
                            )}
                          />
                        </div>
                        {t.subCategory && (
                          <span
                            className={cn(
                              'text-xs font-medium truncate w-full text-left mt-0.5',
                              categoryColors.text
                            )}
                          >
                            {t.subCategory}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="hidden sm:table-cell px-3 py-3 sm:px-6 h-11">
                      <div
                        className="flex items-center gap-2"
                        title="How confident the AI (or a learned rule) is about this category"
                      >
                        <div
                          className="w-12 h-1 bg-line rounded-full overflow-hidden"
                          aria-hidden="true"
                        >
                          <div
                            className={cn(
                              'h-full rounded-full',
                              t.confidence > 0.8
                                ? 'bg-positive'
                                : t.confidence > 0.5
                                  ? 'bg-warning'
                                  : 'bg-negative'
                            )}
                            style={{ width: `${t.confidence * 100}%` }}
                          />
                        </div>
                        <span className="num text-[10px] text-muted">
                          {Math.round(t.confidence * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 h-11 text-center">
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        {t.isApproved ? (
                          <div
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-positive/10 text-positive border border-positive/30"
                            title="You approved this categorization"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">
                              Approved
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => approveTransaction(t.id)}
                            className="inline-flex items-center gap-1 px-3 min-h-11 rounded-full bg-surface border border-line-strong text-muted hover:text-positive hover:border-positive hover:bg-positive/10 transition-all shadow-xs"
                            title="Confirm the suggested category is correct — this saves it as a learned rule"
                            aria-label={`Verify: confirm the suggested category for ${t.description}`}
                          >
                            <span className="hidden sm:inline text-[10px] font-medium">Verify</span>
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTransactionToDelete(t.id);
                          }}
                          className="p-1.5 min-h-11 min-w-11 inline-flex items-center justify-center text-muted hover:text-negative hover:bg-negative/10 rounded-md transition-all opacity-100 sm:opacity-0 [@media(hover:none)]:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100"
                          title="Delete Transaction"
                          aria-label={`Delete transaction ${t.description}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted italic text-sm">
                    No transactions found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {processedData.length > 0 && (
          <div className="px-6 py-3 border-t border-line bg-surface-muted/50 flex items-center justify-between">
            <div className="num text-xs text-muted">
              Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(currentPage * ITEMS_PER_PAGE, processedData.length)}
              </span>{' '}
              of <span className="font-medium">{processedData.length}</span> results
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                aria-label="Previous page"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="num flex items-center justify-center min-w-[3rem] text-xs font-medium text-ink-soft">
                {currentPage} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                aria-label="Next page"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {activeDropdown && (
        <CategoryDropdown
          anchorEl={activeDropdown.anchor}
          currentCategory={
            transactions.find((t) => t.id === activeDropdown.id)?.category ||
            TransactionCategory.Uncategorized
          }
          currentSubCategory={transactions.find((t) => t.id === activeDropdown.id)?.subCategory}
          onClose={() => setActiveDropdown(null)}
          onSelect={(cat, sub) => handleCategorySelect(activeDropdown.id, cat, sub)}
        />
      )}
    </div>
  );
};
