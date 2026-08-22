import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getPreviewTransactions } from '../../lib/csvParser';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { CsvMapping, Transaction } from '../../types';
import { DuplicateTransaction } from './dedupe';
import { PreviewTab } from './PreviewView';
import {
  resetWith,
  processFileWith,
  selectFileWith,
  removeStagedWith,
  restoreDuplicateWith,
  confirmImportWith,
} from './uploaderActions';

export type UploaderState = 'idle' | 'mapping' | 'preview' | 'processing';

const EMPTY_MAPPING: CsvMapping = {
  dateCol: '',
  descCol: '',
  amountCol: '',
  categoryCol: '',
  hasHeader: true,
  delimiter: ',',
};

/** Flow-state + store wiring for the CSV upload flow. */
const useUploadFlowState = () => {
  const [state, setState] = useState<UploaderState>('idle');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
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

  return {
    state,
    setState,
    dragActive,
    setDragActive,
    file,
    setFile,
    headers,
    setHeaders,
    rejectedCount,
    setRejectedCount,
    inputRef,
    stateRef,
    addTransactions,
    existingTransactions,
    setError,
    error,
    clearAll,
    shouldApplyPatterns,
    isDemoMode,
    setDemoMode,
  };
};

/** Mapping + preview/staging state for the CSV upload flow. */
const useStagingState = () => {
  const [mapping, setMapping] = useState<CsvMapping>(EMPTY_MAPPING);
  const [mappingAutoDetected, setMappingAutoDetected] = useState(false);
  const [mappingPreview, setMappingPreview] = useState<Transaction[]>([]);
  const [stagedTransactions, setStagedTransactions] = useState<Transaction[]>([]);
  const [duplicateTransactions, setDuplicateTransactions] = useState<DuplicateTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<PreviewTab>('new');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDuplicate, setSelectedDuplicate] = useState<DuplicateTransaction | null>(null);

  return {
    mapping,
    setMapping,
    mappingAutoDetected,
    setMappingAutoDetected,
    mappingPreview,
    setMappingPreview,
    stagedTransactions,
    setStagedTransactions,
    duplicateTransactions,
    setDuplicateTransactions,
    activeTab,
    setActiveTab,
    currentPage,
    setCurrentPage,
    selectedDuplicate,
    setSelectedDuplicate,
  };
};

/** All state + store wiring for the CSV upload flow. */
const useUploaderState = () => ({
  ...useUploadFlowState(),
  ...useStagingState(),
});

export type UploaderStateBundle = ReturnType<typeof useUploaderState>;

/** Unmount cleanup + mapping-preview side effect. */
const useUploaderEffects = (s: UploaderStateBundle, reset: () => void) => {
  // Reset when component unmounts
  useEffect(() => {
    return () => {
      if (s.stateRef.current !== 'idle') reset();
    };
  }, [reset, s.stateRef]);

  // Update preview when mapping changes
  useEffect(() => {
    if (s.state === 'mapping' && s.file) {
      getPreviewTransactions(s.file, s.mapping).then(s.setMappingPreview);
    }
  }, [s.mapping, s.state, s.file, s.setMappingPreview]);
};

/** Drag-and-drop + tab-switch interactions for the uploader views. */
const useUploaderInteractions = (
  s: UploaderStateBundle,
  handleFileSelection: (f: File) => void
) => {
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') s.setDragActive(true);
    else if (e.type === 'dragleave') s.setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    s.setDragActive(false);
    if (e.dataTransfer.files?.[0]) void handleFileSelection(e.dataTransfer.files[0]);
  };

  const selectTab = (tab: PreviewTab) => {
    s.setActiveTab(tab);
    s.setCurrentPage(1);
  };

  return { handleDrag, handleDrop, selectTab };
};

/** File/parse/staging actions shared across the uploader views. */
const useUploaderActions = (s: UploaderStateBundle, onUploadComplete?: () => void) => {
  const processFile = useCallback(
    (f: File, m: CsvMapping) => {
      void processFileWith(s, f, m)();
    },
    [s]
  );

  const handleFileSelection = useCallback(
    (f: File) => selectFileWith(s, processFile)(f),
    [s, processFile]
  );
  const removeStagedTransaction = useCallback((id: string) => removeStagedWith(s)(id), [s]);
  const restoreDuplicate = useCallback(
    (tx: DuplicateTransaction) => restoreDuplicateWith(s)(tx),
    [s]
  );
  const confirmImport = useCallback(
    () => confirmImportWith(s, onUploadComplete)(),
    [s, onUploadComplete]
  );

  return {
    processFile,
    handleFileSelection,
    removeStagedTransaction,
    restoreDuplicate,
    confirmImport,
  };
};

/** Full upload flow: state, effects, and every handler the views need. */
export const useCSVUploader = (onUploadComplete?: () => void) => {
  const s = useUploaderState();
  // Deps: only the (stable) setError setter is captured; the other setters are stable too.
  const reset = useCallback(() => resetWith(s)(), [s.setError]); // eslint-disable-line react-hooks/exhaustive-deps
  useUploaderEffects(s, reset);

  const actions = useUploaderActions(s, onUploadComplete);
  const interactions = useUploaderInteractions(s, actions.handleFileSelection);

  return { s, reset, ...actions, ...interactions };
};
