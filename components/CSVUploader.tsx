import React, { useRef, useState, useEffect } from 'react';
import {
  Upload,
  ArrowRight,
  AlertTriangle,
  X,
  ArrowLeft,
  Trash2,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Info,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from './UI';
import {
  getCSVHeaders,
  detectBankFormat,
  parseCSVWithMapping,
  getPreviewTransactions,
  autoDetectMapping,
} from '../lib/csvParser';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { applyPatterns } from '../lib/localStorage';
import { cn, formatCurrency } from '../lib/utils';
import { MAX_FILE_SIZE_MB, SUPPORTED_BANKS } from '../constants';
import { CsvMapping, Transaction } from '../types';
import { v4 as uuidv4 } from 'uuid';

type UploaderState = 'idle' | 'mapping' | 'preview' | 'processing';
type PreviewTab = 'new' | 'duplicates';

// Extended type for internal use in this component
type DuplicateTransaction = Transaction & {
  duplicateReason: 'Already Imported' | 'Duplicate in File';
};

interface DuplicateResolutionModalProps {
  transaction: DuplicateTransaction;
  allTransactions: Transaction[];
  onClose: () => void;
  onImport: () => void;
}

const DuplicateResolutionModal: React.FC<DuplicateResolutionModalProps> = ({
  transaction,
  allTransactions,
  onClose,
  onImport,
}) => {
  // Find potential matches in existing data to show why it's a duplicate
  const exactMatches = allTransactions.filter(
    (t) =>
      t.date === transaction.date &&
      t.amount === transaction.amount &&
      t.description === transaction.description &&
      t.id !== transaction.id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg bg-white shadow-xl animate-in zoom-in-95 duration-200">
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              Duplicate Detected
            </CardTitle>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              This transaction appears to be a duplicate of an existing record or another entry in
              this file.
            </p>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-orange-900">New Transaction</span>
                <Badge variant="outline" className="bg-white text-orange-600 border-orange-200">
                  {transaction.duplicateReason}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                <div>
                  <span className="text-xs text-orange-700/70 block uppercase">Date</span>
                  <span className="font-medium text-orange-900">{transaction.date}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-orange-700/70 block uppercase">Amount</span>
                  <span className="font-medium text-orange-900 font-mono">
                    {formatCurrency(transaction.amount)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-orange-700/70 block uppercase">Description</span>
                  <span className="font-medium text-orange-900 truncate block">
                    {transaction.description}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {exactMatches.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Existing Match ({exactMatches.length})
              </p>
              {exactMatches.slice(0, 1).map((match) => (
                <div
                  key={match.id}
                  className="p-3 bg-gray-50 rounded border border-gray-200 opacity-75"
                >
                  <div className="flex justify-between text-sm text-gray-700">
                    <span>{match.date}</span>
                    <span className="font-mono">{formatCurrency(match.amount)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{match.description}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>
              Discard
            </Button>
            <Button onClick={onImport} className="bg-orange-600 hover:bg-orange-700 text-white">
              Import Anyway
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ITEMS_PER_PAGE = 10;

// Helper to get transaction signature
const getTxSignature = (t: Transaction) => `${t.date}|${t.description}|${t.amount}`;

interface CSVUploaderProps {
  onUploadComplete?: () => void;
}

export const CSVUploader: React.FC<CSVUploaderProps> = ({ onUploadComplete }) => {
  const [state, setState] = useState<UploaderState>('idle');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);

  // Mapping State
  const [mapping, setMapping] = useState<CsvMapping>({
    dateCol: '',
    descCol: '',
    amountCol: '',
    categoryCol: '',
    hasHeader: true,
    delimiter: ',',
  });
  const [mappingPreview, setMappingPreview] = useState<Transaction[]>([]);

  // Preview State
  const [stagedTransactions, setStagedTransactions] = useState<Transaction[]>([]);
  const [duplicateTransactions, setDuplicateTransactions] = useState<DuplicateTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<PreviewTab>('new');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDuplicate, setSelectedDuplicate] = useState<DuplicateTransaction | null>(null);
  const [rejectedCount, setRejectedCount] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<UploaderState>(state);
  stateRef.current = state;
  const {
    addTransactions,
    transactions: existingTransactions,
    setError,
    error,
    clearAll,
  } = useTransactionStore();
  const { applyPatterns: shouldApplyPatterns, isDemoMode, setDemoMode } = useSettingsStore();

  const reset = React.useCallback(() => {
    setState('idle');
    setFile(null);
    setHeaders([]);
    setStagedTransactions([]);
    setDuplicateTransactions([]);
    setCurrentPage(1);
    setActiveTab('new');
    setSelectedDuplicate(null);
    setError(null);
    setMappingPreview([]);
  }, [setError]);

  // Reset when component unmounts
  useEffect(() => {
    return () => {
      if (stateRef.current !== 'idle') reset();
    };
  }, [reset]);

  // Update preview when mapping changes
  useEffect(() => {
    if (state === 'mapping' && file) {
      getPreviewTransactions(file, mapping).then(setMappingPreview);
    }
  }, [mapping, state, file]);

  const handleFileSelection = async (selectedFile: File) => {
    if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File size exceeds ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    setFile(selectedFile);
    setError(null);

    try {
      const { headers: extractedHeaders, delimiter } = await getCSVHeaders(selectedFile);
      setHeaders(extractedHeaders);

      // 1. Try Strict Bank Format
      const detected = detectBankFormat(extractedHeaders);
      if (detected) {
        const completeMapping: CsvMapping = {
          ...detected,
          hasHeader: true,
          delimiter: delimiter,
          dateCol: detected.dateCol || '',
          descCol: detected.descCol || '',
          amountCol: detected.amountCol || '',
          categoryCol: detected.categoryCol || '',
        };
        setMapping(completeMapping);
        await processFile(selectedFile, completeMapping);
        return;
      }

      // 2. Try Smart Auto-Detection
      const autoMapping = autoDetectMapping(extractedHeaders, delimiter);

      // If we found at least a Date and Amount, we can try to proceed or just pre-fill the mapping screen
      if (autoMapping.dateCol && autoMapping.amountCol) {
        setMapping(autoMapping);
      } else {
        // Fallback default
        setMapping({
          dateCol: extractedHeaders[0] || '',
          descCol: extractedHeaders[1] || '',
          amountCol: extractedHeaders[2] || '',
          categoryCol: '',
          hasHeader: true,
          delimiter: delimiter,
        });
      }

      // Go to mapping screen for user verification
      setState('mapping');
    } catch (e: unknown) {
      setError('Failed to read CSV. Check file format.');
      console.error(e);
      reset();
    }
  };

  const processFile = async (f: File, m: CsvMapping) => {
    setState('processing');
    try {
      const { accepted, rejected } = await parseCSVWithMapping(f, m);

      let parsed = accepted;
      if (shouldApplyPatterns) {
        parsed = applyPatterns(parsed).transactions;
      }

      // Deduplication Logic
      const existingSignatures = new Set(existingTransactions.map(getTxSignature));
      const newItems: Transaction[] = [];
      const duplicates: DuplicateTransaction[] = [];
      const currentBatchSignatures = new Set<string>();

      parsed.forEach((t) => {
        const sig = getTxSignature(t);

        if (existingSignatures.has(sig)) {
          duplicates.push({ ...t, duplicateReason: 'Already Imported' });
        } else if (currentBatchSignatures.has(sig)) {
          duplicates.push({ ...t, duplicateReason: 'Duplicate in File' });
        } else {
          newItems.push(t);
          currentBatchSignatures.add(sig);
        }
      });

      setStagedTransactions(newItems);
      setDuplicateTransactions(duplicates);
      setRejectedCount(rejected.length);
      setCurrentPage(1);
      // If no new items but duplicates exist, switch to duplicate tab automatically
      if (newItems.length === 0 && duplicates.length > 0) {
        setActiveTab('duplicates');
      } else {
        setActiveTab('new');
      }
      setState('preview');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred');
      setState('idle');
    }
  };

  const removeStagedTransaction = (id: string) => {
    setStagedTransactions((prev) => prev.filter((t) => t.id !== id));
    // Adjust page if current page becomes empty
    const totalPages = Math.ceil((stagedTransactions.length - 1) / ITEMS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  };

  const restoreDuplicate = (tx: DuplicateTransaction) => {
    // Create a new transaction based on the duplicate, but with a new ID and modified description
    // We explicitly exclude duplicateReason from the new object
    const { duplicateReason: _, ...rawTx } = tx;

    const restoredTx: Transaction = {
      ...rawTx,
      id: uuidv4(),
      description: `${rawTx.description} (Copy)`,
    };

    setStagedTransactions((prev) => [...prev, restoredTx]);
    setDuplicateTransactions((prev) => prev.filter((t) => t.id !== tx.id));

    // If duplicates empty, switch view
    if (duplicateTransactions.length === 1) {
      setActiveTab('new');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelection(e.dataTransfer.files[0]);
  };

  const confirmImport = () => {
    // If user is importing data while in Demo Mode, assume they want to start fresh with real data.
    if (isDemoMode) {
      clearAll();
      setDemoMode(false);
    }

    addTransactions(stagedTransactions);
    reset();
    if (onUploadComplete) onUploadComplete();
  };

  // --- PAGINATION HELPERS ---
  const getCurrentPageData = (data: (Transaction | DuplicateTransaction)[]) => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return data.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  const totalPages = Math.ceil(
    (activeTab === 'new' ? stagedTransactions.length : duplicateTransactions.length) /
      ITEMS_PER_PAGE
  );

  // --- RENDERERS ---

  if (state === 'mapping') {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-10">
        <CardHeader>
          <CardTitle>Map Columns</CardTitle>
          <p className="text-sm text-gray-500">
            We couldn't auto-detect your bank format. Please map the columns below.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Column</label>
              <select
                className="w-full p-2 border rounded-md"
                value={mapping.dateCol}
                onChange={(e) => setMapping({ ...mapping, dateCol: e.target.value })}
              >
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <select
                className="w-full p-2 border rounded-md"
                value={mapping.descCol}
                onChange={(e) => setMapping({ ...mapping, descCol: e.target.value })}
              >
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <select
                className="w-full p-2 border rounded-md"
                value={mapping.amountCol}
                onChange={(e) => setMapping({ ...mapping, amountCol: e.target.value })}
              >
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                Category <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <select
                className="w-full p-2 border rounded-md bg-gray-50"
                value={mapping.categoryCol || ''}
                onChange={(e) => setMapping({ ...mapping, categoryCol: e.target.value })}
              >
                <option value="">-- None --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mapping Preview Table */}
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Preview
              </span>
              <span className="text-xs text-gray-400">
                Showing first 10 rows based on current mapping
              </span>
            </div>
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-gray-500 border-b border-gray-100 sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="px-4 py-2 font-medium bg-gray-50/50">Date</th>
                    <th className="px-4 py-2 font-medium bg-gray-50/50">Description</th>
                    <th className="px-4 py-2 font-medium bg-gray-50/50">Category (Raw)</th>
                    <th className="px-4 py-2 font-medium text-right bg-gray-50/50">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {mappingPreview.length > 0 ? (
                    mappingPreview.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2 text-gray-600 whitespace-nowrap text-xs">
                          {row.date ? row.date : <span className="text-red-300 italic">Empty</span>}
                        </td>
                        <td className="px-4 py-2 text-gray-900 truncate max-w-[200px] text-xs">
                          {row.description ? (
                            row.description
                          ) : (
                            <span className="text-red-300 italic">Empty</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-500 truncate max-w-[120px] text-xs">
                          {row.originalCategory || (
                            <span className="text-gray-300 italic">N/A</span>
                          )}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2 text-right font-mono text-xs',
                            isNaN(row.amount) ? 'text-red-400' : 'text-gray-700'
                          )}
                        >
                          {isNaN(row.amount) ? 'NaN' : formatCurrency(row.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">
                        No preview available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={() => file && processFile(file, mapping)}>
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === 'preview') {
    const displayData = activeTab === 'new' ? stagedTransactions : duplicateTransactions;
    const paginatedData = getCurrentPageData(displayData);

    return (
      <>
        {/* Modal Overlay for Duplicate Details */}
        {selectedDuplicate && (
          <DuplicateResolutionModal
            transaction={selectedDuplicate}
            allTransactions={[
              ...existingTransactions,
              ...stagedTransactions,
              ...duplicateTransactions,
            ]}
            onClose={() => setSelectedDuplicate(null)}
            onImport={() => {
              restoreDuplicate(selectedDuplicate);
              setSelectedDuplicate(null);
            }}
          />
        )}

        <Card className="w-full max-w-2xl mx-auto mt-10 border-accent/20 bg-accent/5 relative">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-center mb-4">
              <CardTitle className="flex items-center gap-2">
                <Check className="w-5 h-5 text-accent" />
                Validate Data
              </CardTitle>
              {rejectedCount > 0 && (
                <Badge
                  variant="accent"
                  className="flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100"
                >
                  <AlertTriangle className="w-4 h-4" />
                  {rejectedCount} rejected row{rejectedCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 bg-white/50 p-1 rounded-lg border border-gray-200 w-fit">
              <button
                onClick={() => {
                  setActiveTab('new');
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2',
                  activeTab === 'new'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-900'
                )}
              >
                New Transactions
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                  {stagedTransactions.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('duplicates');
                  setCurrentPage(1);
                }}
                disabled={duplicateTransactions.length === 0}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2',
                  activeTab === 'duplicates' ? 'bg-white shadow text-gray-900' : 'text-gray-500',
                  duplicateTransactions.length === 0 && 'opacity-50 cursor-not-allowed'
                )}
              >
                Duplicates
                {duplicateTransactions.length > 0 && (
                  <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs">
                    {duplicateTransactions.length}
                  </span>
                )}
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Table Area */}
            <div className="bg-white rounded-lg border border-gray-200 min-h-[300px] flex flex-col">
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="p-3 font-medium text-gray-500">Date</th>
                      <th className="p-3 font-medium text-gray-500">Description</th>
                      {activeTab === 'duplicates' && (
                        <th className="p-3 font-medium text-gray-500">Reason</th>
                      )}
                      <th className="p-3 font-medium text-gray-500 text-right">Amount</th>
                      <th className="p-3 font-medium text-gray-500 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedData.length > 0 ? (
                      paginatedData.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() =>
                            activeTab === 'duplicates' &&
                            setSelectedDuplicate(t as DuplicateTransaction)
                          }
                          className={cn(
                            'hover:bg-gray-50/80 group transition-colors',
                            activeTab === 'duplicates' ? 'cursor-pointer' : ''
                          )}
                        >
                          <td className="p-3 text-gray-500 whitespace-nowrap">{t.date}</td>
                          <td className="p-3 truncate max-w-[200px]" title={t.description}>
                            {t.description}
                            {t.originalCategory && (
                              <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                <Info className="w-3 h-3" />
                                Cat: {t.originalCategory}
                              </div>
                            )}
                          </td>

                          {/* Duplicate Reason Column */}
                          {activeTab === 'duplicates' && (
                            <td className="p-3">
                              {(t as DuplicateTransaction).duplicateReason ===
                              'Already Imported' ? (
                                <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded-md w-fit">
                                  <Database className="w-3 h-3" />
                                  <span className="font-medium">In Database</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-1 rounded-md w-fit">
                                  <Copy className="w-3 h-3" />
                                  <span className="font-medium">File Duplicate</span>
                                </div>
                              )}
                            </td>
                          )}

                          <td className="p-3 text-right font-mono">{formatCurrency(t.amount)}</td>
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {activeTab === 'new' ? (
                              <button
                                onClick={() => removeStagedTransaction(t.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                title="Remove transaction"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => restoreDuplicate(t as DuplicateTransaction)}
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                                title="Add anyway (as duplicate)"
                              >
                                <PlusCircle className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={activeTab === 'duplicates' ? 5 : 4}
                          className="p-8 text-center text-gray-400 italic"
                        >
                          {activeTab === 'new'
                            ? 'No transactions ready to import.'
                            : 'No duplicates found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {displayData.length > 0 && (
                <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, displayData.length)} of{' '}
                    {displayData.length}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center px-2 text-xs font-medium text-gray-600">
                      {currentPage} / {totalPages || 1}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages || totalPages === 0}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="ghost"
                onClick={reset}
                className="text-red-500 hover:bg-red-50 hover:text-red-600"
              >
                Cancel
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setState('mapping')}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Mapping
                </Button>
                <Button onClick={confirmImport} disabled={stagedTransactions.length === 0}>
                  Import {stagedTransactions.length} Transactions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  // Idle State (Default Dropzone)
  return (
    <div className="w-full max-w-2xl mx-auto mt-10">
      <div
        className={cn(
          'relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer bg-white',
          dragActive
            ? 'border-accent bg-accent-light/10'
            : 'border-gray-300 hover:border-accent hover:bg-gray-50',
          state === 'processing' ? 'opacity-50 pointer-events-none' : ''
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
        />

        <div className="flex flex-col items-center space-y-3 text-center p-6">
          <div className="p-4 rounded-full bg-gray-100">
            {state === 'processing' ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            ) : (
              <Upload className="w-8 h-8 text-gray-500" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-lg font-medium text-gray-700">
              {state === 'processing' ? 'Analyzing file...' : 'Drop your bank statement here'}
            </p>
            <p className="text-sm text-gray-500">Supports .csv (max {MAX_FILE_SIZE_MB}MB)</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full text-sm mt-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2 mt-4 opacity-50">
            {SUPPORTED_BANKS.map((b) => (
              <span
                key={b.name}
                className="text-[10px] px-2 py-1 bg-gray-200 rounded text-gray-600"
              >
                {b.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 mt-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <p>Your data is processed locally. We perform duplicate detection before importing.</p>
      </div>
    </div>
  );
};
