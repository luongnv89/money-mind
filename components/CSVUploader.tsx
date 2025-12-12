import React, { useRef, useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, ArrowRight, Check, AlertTriangle, X, ArrowLeft, Trash2, PlusCircle, ChevronLeft, ChevronRight, RefreshCw, Copy, Database, Info, ExternalLink, Hash } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge } from './UI';
import { getCSVHeaders, detectBankFormat, parseCSVWithMapping, getPreviewTransactions } from '../lib/csvParser';
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
type DuplicateTransaction = Transaction & { duplicateReason: 'Already Imported' | 'Duplicate in File' };

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
  const [mapping, setMapping] = useState<CsvMapping>({ dateCol: '', descCol: '', amountCol: '', hasHeader: true, delimiter: ',' });
  const [mappingPreview, setMappingPreview] = useState<Transaction[]>([]);
  
  // Preview State
  const [stagedTransactions, setStagedTransactions] = useState<Transaction[]>([]);
  const [duplicateTransactions, setDuplicateTransactions] = useState<DuplicateTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<PreviewTab>('new');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDuplicate, setSelectedDuplicate] = useState<DuplicateTransaction | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const { addTransactions, transactions: existingTransactions, setError, error } = useTransactionStore();
  const { applyPatterns: shouldApplyPatterns } = useSettingsStore();

  // Reset when component mounts or unmounts
  useEffect(() => {
    return () => {
        if (state !== 'idle') reset();
    };
  }, []);

  // Update preview when mapping changes
  useEffect(() => {
    if (state === 'mapping' && file) {
        getPreviewTransactions(file, mapping).then(setMappingPreview);
    }
  }, [mapping, state, file]);

  const reset = () => {
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
  };

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

        const detected = detectBankFormat(extractedHeaders);
        
        if (detected) {
            const completeMapping: CsvMapping = {
                ...detected,
                hasHeader: true,
                delimiter: delimiter,
                dateCol: detected.dateCol || '',
                descCol: detected.descCol || '',
                amountCol: detected.amountCol || '',
            };
            setMapping(completeMapping);
            await processFile(selectedFile, completeMapping);
        } else {
            const looseMatch = (term: string) => extractedHeaders.find(h => h.toLowerCase().includes(term));
            setMapping({
                dateCol: looseMatch('date') || extractedHeaders[0] || '',
                descCol: looseMatch('desc') || looseMatch('memo') || extractedHeaders[1] || '',
                amountCol: looseMatch('amount') || looseMatch('amt') || extractedHeaders[2] || '',
                hasHeader: true,
                delimiter: delimiter
            });
            setState('mapping');
        }
    } catch (e: any) {
        setError("Failed to read CSV. Check file format.");
        console.error(e);
        reset();
    }
  };

  const processFile = async (f: File, m: CsvMapping) => {
      setState('processing');
      try {
          let parsed = await parseCSVWithMapping(f, m);
          
          if (shouldApplyPatterns) {
              parsed = applyPatterns(parsed);
          }

          // Deduplication Logic
          const existingSignatures = new Set(existingTransactions.map(getTxSignature));
          const newItems: Transaction[] = [];
          const duplicates: DuplicateTransaction[] = [];
          const currentBatchSignatures = new Set<string>();

          parsed.forEach(t => {
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
          setCurrentPage(1);
          // If no new items but duplicates exist, switch to duplicate tab automatically
          if (newItems.length === 0 && duplicates.length > 0) {
              setActiveTab('duplicates');
          } else {
              setActiveTab('new');
          }
          setState('preview');

      } catch (e: any) {
          setError(e.message);
          setState('idle');
      }
  };

  const removeStagedTransaction = (id: string) => {
      setStagedTransactions(prev => prev.filter(t => t.id !== id));
      // Adjust page if current page becomes empty
      const totalPages = Math.ceil((stagedTransactions.length - 1) / ITEMS_PER_PAGE);
      if (currentPage > totalPages && totalPages > 0) {
          setCurrentPage(totalPages);
      }
  };

  const restoreDuplicate = (tx: DuplicateTransaction) => {
      // Create a new transaction based on the duplicate, but with a new ID and modified description
      // We explicitly exclude duplicateReason from the new object
      const { duplicateReason, ...rawTx } = tx;
      
      const restoredTx: Transaction = {
          ...rawTx,
          id: uuidv4(),
          description: `${rawTx.description} (Copy)`
      };
      
      setStagedTransactions(prev => [...prev, restoredTx]);
      setDuplicateTransactions(prev => prev.filter(t => t.id !== tx.id));
      
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
      (activeTab === 'new' ? stagedTransactions.length : duplicateTransactions.length) / ITEMS_PER_PAGE
  );

  // --- RENDERERS ---

  if (state === 'mapping') {
      return (
          <Card className="w-full max-w-2xl mx-auto mt-10">
              <CardHeader>
                  <CardTitle>Map Columns</CardTitle>
                  <p className="text-sm text-gray-500">We couldn't auto-detect your bank format. Please map the columns below.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                          <label className="text-sm font-medium">Date Column</label>
                          <select 
                            className="w-full p-2 border rounded-md"
                            value={mapping.dateCol}
                            onChange={(e) => setMapping({...mapping, dateCol: e.target.value})}
                          >
                              {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                      </div>
                      <div className="space-y-2">
                          <label className="text-sm font-medium">Description</label>
                          <select 
                            className="w-full p-2 border rounded-md"
                            value={mapping.descCol}
                            onChange={(e) => setMapping({...mapping, descCol: e.target.value})}
                          >
                              {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                      </div>
                      <div className="space-y-2">
                          <label className="text-sm font-medium">Amount</label>
                          <select 
                            className="w-full p-2 border rounded-md"
                            value={mapping.amountCol}
                            onChange={(e) => setMapping({...mapping, amountCol: e.target.value})}
                          >
                              {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                      </div>
                  </div>

                  {/* Mapping Preview Table */}
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Preview</span>
                          <span className="text-xs text-gray-400">Showing first 10 rows based on current mapping</span>
                      </div>
                      <div className="overflow-x-auto max-h-60">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-white text-gray-500 border-b border-gray-100 sticky top-0 shadow-sm z-10">
                                  <tr>
                                      <th className="px-4 py-2 font-medium bg-gray-50/50">Date</th>
                                      <th className="px-4 py-2 font-medium bg-gray-50/50">Description</th>
                                      <th className="px-4 py-2 font-medium text-right bg-gray-50/50">Amount</th>
                                  </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-50">
                                  {mappingPreview.length > 0 ? mappingPreview.map((row) => (
                                      <tr key={row.id} className="hover:bg-gray-50/50">
                                          <td className="px-4 py-2 text-gray-600 whitespace-nowrap text-xs">
                                            {row.date ? row.date : <span className="text-red-300 italic">Empty</span>}
                                          </td>
                                          <td className="px-4 py-2 text-gray-900 truncate max-w-[200px] text-xs">
                                            {row.description ? row.description : <span className="text-red-300 italic">Empty</span>}
                                          </td>
                                          <td className={cn("px-4 py-2 text-right font-mono text-xs", isNaN(row.amount) ? "text-red-400" : "text-gray-700")}>
                                              {isNaN(row.amount) ? 'NaN' : formatCurrency(row.amount)}
                                          </td>
                                      </tr>
                                  )) : (
                                       <tr>
                                          <td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic">
                                              No preview available
                                          </td>
                                      </tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                      <Button variant="ghost" onClick={reset}>Cancel</Button>
                      <Button onClick={() => file && processFile(file, mapping)}>Next <ArrowRight className="w-4 h-4 ml-2"/></Button>
                  </div>
              </CardContent>
          </Card>
      )
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
                  allTransactions={[...existingTransactions, ...stagedTransactions, ...duplicateTransactions]}
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
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex space-x-2 bg-white/50 p-1 rounded-lg border border-gray-200 w-fit">
                      <button 
                        onClick={() => { setActiveTab('new'); setCurrentPage(1); }}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                            activeTab === 'new' ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-900"
                        )}
                      >
                          New Transactions
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                              {stagedTransactions.length}
                          </span>
                      </button>
                      
                      <button 
                        onClick={() => { setActiveTab('duplicates'); setCurrentPage(1); }}
                        disabled={duplicateTransactions.length === 0}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                            activeTab === 'duplicates' ? "bg-white shadow text-gray-900" : "text-gray-500",
                            duplicateTransactions.length === 0 && "opacity-50 cursor-not-allowed"
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
                                      {activeTab === 'duplicates' && <th className="p-3 font-medium text-gray-500">Reason</th>}
                                      <th className="p-3 font-medium text-gray-500 text-right">Amount</th>
                                      <th className="p-3 font-medium text-gray-500 w-16 text-center">Action</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                  {paginatedData.length > 0 ? paginatedData.map(t => (
                                      <tr key={t.id} 
                                          onClick={() => activeTab === 'duplicates' && setSelectedDuplicate(t as DuplicateTransaction)}
                                          className={cn(
                                              "hover:bg-gray-50/80 group transition-colors",
                                              activeTab === 'duplicates' ? "cursor-pointer" : ""
                                          )}
                                      >
                                          <td className="p-3 text-gray-500 whitespace-nowrap">{t.date}</td>
                                          <td className="p-3 truncate max-w-[200px]" title={t.description}>{t.description}</td>
                                          
                                          {/* Duplicate Reason Column */}
                                          {activeTab === 'duplicates' && (
                                              <td className="p-3">
                                                  {(t as DuplicateTransaction).duplicateReason === 'Already Imported' ? (
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
                                  )) : (
                                      <tr>
                                          <td colSpan={activeTab === 'duplicates' ? 5 : 4} className="p-8 text-center text-gray-400 italic">
                                              {activeTab === 'new' ? "No transactions ready to import." : "No duplicates found."}
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
                                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, displayData.length)} of {displayData.length}
                              </span>
                              <div className="flex gap-1">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    className="h-7 w-7 p-0"
                                  >
                                      <ChevronRight className="w-4 h-4" />
                                  </Button>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                      <Button variant="ghost" onClick={reset} className="text-red-500 hover:bg-red-50 hover:text-red-600">Cancel</Button>
                      <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setState('mapping')}>
                              <ArrowLeft className="w-4 h-4 mr-2"/> Back to Mapping
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
          "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer bg-white",
          dragActive ? "border-accent bg-accent-light/10" : "border-gray-300 hover:border-accent hover:bg-gray-50",
          state === 'processing' ? "opacity-50 pointer-events-none" : ""
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
                    {state === 'processing' ? "Analyzing file..." : "Drop your bank statement here"}
                </p>
                <p className="text-sm text-gray-500">
                    Supports .csv (max {MAX_FILE_SIZE_MB}MB)
                </p>
            </div>
            
            {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full text-sm mt-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}
            
            <div className="flex flex-wrap justify-center gap-2 mt-4 opacity-50">
                {SUPPORTED_BANKS.map(b => (
                    <span key={b.name} className="text-[10px] px-2 py-1 bg-gray-200 rounded text-gray-600">{b.name}</span>
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

// --- MODAL COMPONENT ---

interface ModalProps {
    transaction: DuplicateTransaction;
    allTransactions: Transaction[];
    onClose: () => void;
    onImport: () => void;
}

const DuplicateResolutionModal: React.FC<ModalProps> = ({ transaction, allTransactions, onClose, onImport }) => {
    // Find collisions
    const sig = getTxSignature(transaction);
    const conflicts = allTransactions.filter(t => t.id !== transaction.id && getTxSignature(t) === sig);

    // Get raw keys from the duplicate transaction to display all available data
    const rawData = transaction.raw || { 
        Date: transaction.date, 
        Description: transaction.description, 
        Amount: transaction.amount 
    };
    const keys = Object.keys(rawData);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <AlertTriangle className="w-6 h-6 text-orange-500" />
                            Duplicate Detected
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            This record matches {conflicts.length} existing {conflicts.length === 1 ? 'transaction' : 'transactions'} by Date, Description, and Amount.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-0 overflow-y-auto flex-1 bg-gray-50/30">
                    <div className="flex flex-col md:flex-row h-full">
                        {/* LEFT: The Incoming Record */}
                        <div className="w-full md:w-1/2 border-r border-gray-200 bg-white p-6">
                            <div className="flex items-center justify-between mb-4">
                                <Badge className="bg-accent text-white border-none px-3 py-1">Incoming Record</Badge>
                                {transaction.index !== undefined && (
                                    <div className="flex items-center text-sm text-gray-400 font-mono">
                                        <Hash className="w-3 h-3 mr-1" />
                                        Row {transaction.index}
                                    </div>
                                )}
                            </div>
                            
                            <div className="rounded-lg border border-orange-100 overflow-hidden shadow-sm">
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-gray-50">
                                        {keys.map((key, i) => (
                                            <tr key={key} className={i % 2 === 0 ? "bg-orange-50/20" : "bg-white"}>
                                                <td className="px-4 py-3 text-gray-500 font-medium w-1/3 truncate text-xs uppercase tracking-wide" title={key}>{key}</td>
                                                <td className="px-4 py-3 text-gray-900 font-mono text-sm break-all">{String(rawData[key])}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* RIGHT: Conflicting Records */}
                        <div className="w-full md:w-1/2 bg-gray-50/50 p-6 overflow-y-auto">
                            <div className="flex items-center gap-2 mb-4">
                                <Badge variant="outline" className="bg-white px-3 py-1">Conflicting Records</Badge>
                                <span className="text-xs text-gray-400">Found in database or file</span>
                            </div>

                            <div className="space-y-6">
                                {conflicts.map((conflict, idx) => (
                                    <div key={conflict.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                Conflict #{idx + 1}
                                            </span>
                                            {conflict.index !== undefined ? (
                                                <span className="text-xs text-gray-400 font-mono flex items-center">
                                                    <Hash className="w-3 h-3 mr-1" />
                                                    Row {conflict.index}
                                                </span>
                                            ) : (
                                                 <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full flex items-center">
                                                    <Database className="w-3 h-3 mr-1" />
                                                    Database
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="p-4">
                                            {conflict.raw ? (
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-[1fr_2fr] gap-2 text-xs border-b border-gray-100 pb-2 mb-2">
                                                         {Object.entries(conflict.raw).slice(0, 5).map(([k, v]) => (
                                                            <React.Fragment key={k}>
                                                                <span className="font-medium text-gray-500 truncate text-right pr-2">{k}</span>
                                                                <span className="text-gray-800 font-mono truncate">{String(v)}</span>
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                    {Object.keys(conflict.raw).length > 5 && (
                                                        <div className="text-center">
                                                            <span className="text-[10px] text-gray-400 italic bg-gray-50 px-2 py-1 rounded-full">
                                                                + {Object.keys(conflict.raw).length - 5} more fields
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                                                    <span className="text-gray-400 text-xs uppercase tracking-wide">Date</span>
                                                    <span className="font-medium text-gray-700">{conflict.date}</span>
                                                    <span className="text-gray-400 text-xs uppercase tracking-wide">Desc</span>
                                                    <span className="font-medium text-gray-700 truncate">{conflict.description}</span>
                                                    <span className="text-gray-400 text-xs uppercase tracking-wide">Amt</span>
                                                    <span className="font-medium text-gray-700 font-mono">{formatCurrency(conflict.amount)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-white rounded-b-xl flex justify-between items-center">
                    <div className="text-xs text-gray-400">
                        Please verify if this is a true duplicate before importing.
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={onClose} className="hover:bg-red-50 hover:text-red-600">
                            Discard Incoming
                        </Button>
                        <Button onClick={onImport} className="bg-accent hover:bg-accent-hover text-white shadow-md shadow-accent/20">
                            <Copy className="w-4 h-4 mr-2" />
                            Import as Copy
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};