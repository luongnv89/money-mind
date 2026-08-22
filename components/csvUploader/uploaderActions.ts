import {
  getCSVHeaders,
  detectBankFormat,
  parseCSVWithMapping,
  autoDetectMapping,
} from '../../lib/csvParser';
import { applyPatterns } from '../../lib/localStorage';
import { MAX_FILE_SIZE_MB } from '../../constants';
import { CsvMapping, Transaction } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { partitionDuplicates, DuplicateTransaction } from './dedupe';
import { ITEMS_PER_PAGE } from './PreviewView';
import type { UploaderStateBundle } from './useCSVUploader';
import { logger } from '../../lib/logger';

/** Reset every uploader field back to the idle state. */
export const resetWith = (s: UploaderStateBundle) => () => {
  s.setState('idle');
  s.setFile(null);
  s.setHeaders([]);
  s.setStagedTransactions([]);
  s.setDuplicateTransactions([]);
  s.setCurrentPage(1);
  s.setActiveTab('new');
  s.setSelectedDuplicate(null);
  s.setError(null);
  s.setMappingPreview([]);
  s.setMappingAutoDetected(false);
};

/** Result of mapping resolution: the mapping plus whether detection (bank
 * format or smart header detection) filled it in, so the mapping screen can
 * word its heading correctly (F-UX-005). */
export interface ResolvedMapping {
  mapping: CsvMapping;
  autoDetected: boolean;
}

/** Resolve the CSV column mapping: strict bank format first, then smart detection, then defaults. */
export const resolveMapping = (
  detected: Partial<CsvMapping> | null,
  extractedHeaders: string[],
  delimiter: string
): ResolvedMapping => {
  if (detected) {
    return {
      autoDetected: true,
      mapping: {
        ...detected,
        hasHeader: true,
        delimiter,
        dateCol: detected.dateCol || '',
        descCol: detected.descCol || '',
        amountCol: detected.amountCol || '',
        categoryCol: detected.categoryCol || '',
      },
    };
  }

  const autoMapping = autoDetectMapping(extractedHeaders, delimiter);
  if (autoMapping.dateCol && autoMapping.amountCol) {
    return { autoDetected: true, mapping: autoMapping };
  }

  // Fallback default
  return {
    autoDetected: false,
    mapping: {
      dateCol: extractedHeaders[0] || '',
      descCol: extractedHeaders[1] || '',
      amountCol: extractedHeaders[2] || '',
      categoryCol: '',
      hasHeader: true,
      delimiter,
    },
  };
};

/** Parse the file, deduplicate, and stage results for the preview screen. */
export const processFileWith = (s: UploaderStateBundle, f: File, m: CsvMapping) => async () => {
  s.setState('processing');
  try {
    const { accepted, rejected } = await parseCSVWithMapping(f, m);

    let parsed = accepted;
    if (s.shouldApplyPatterns) {
      parsed = applyPatterns(parsed).transactions;
    }

    const { newItems, duplicates } = partitionDuplicates(parsed, s.existingTransactions);

    s.setStagedTransactions(newItems);
    s.setDuplicateTransactions(duplicates);
    s.setRejectedCount(rejected.length);
    s.setCurrentPage(1);
    // If no new items but duplicates exist, switch to duplicate tab automatically
    s.setActiveTab(newItems.length === 0 && duplicates.length > 0 ? 'duplicates' : 'new');
    s.setState('preview');
  } catch (e: unknown) {
    s.setError(e instanceof Error ? e.message : 'An unknown error occurred');
    s.setState('idle');
  }
};

/** Size-check, header extraction, and mapping resolution for a newly selected file. */
export const selectFileWith =
  (s: UploaderStateBundle, processFile: (f: File, m: CsvMapping) => void) =>
  async (selectedFile: File) => {
    // The parser only reads CSV text; XLSX workbooks would fail opaquely downstream.
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      s.setError('Only .csv files are supported. Please export your statement as CSV.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      s.setError(`File size exceeds ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    s.setFile(selectedFile);
    s.setError(null);

    try {
      const { headers: extractedHeaders, delimiter } = await getCSVHeaders(selectedFile);
      s.setHeaders(extractedHeaders);
      const detected = detectBankFormat(extractedHeaders);
      const { mapping: nextMapping, autoDetected } = resolveMapping(
        detected,
        extractedHeaders,
        delimiter
      );
      s.setMapping(nextMapping);
      s.setMappingAutoDetected(autoDetected);

      if (detected) {
        await processFile(selectedFile, nextMapping);
        return;
      }

      // Go to mapping screen for user verification
      s.setState('mapping');
    } catch (e: unknown) {
      s.setError('Failed to read CSV. Check file format.');
      logger.error(e);
      resetWith(s)();
    }
  };

/** Remove a staged transaction, adjusting pagination if the page emptied. */
export const removeStagedWith = (s: UploaderStateBundle) => (id: string) => {
  s.setStagedTransactions((prev) => prev.filter((t) => t.id !== id));
  const totalPages = Math.ceil((s.stagedTransactions.length - 1) / ITEMS_PER_PAGE);
  if (s.currentPage > totalPages && totalPages > 0) {
    s.setCurrentPage(totalPages);
  }
};

/** Re-stage a duplicate as a new copy with a fresh id and "(Copy)" description. */
export const restoreDuplicateWith = (s: UploaderStateBundle) => (tx: DuplicateTransaction) => {
  const { duplicateReason: _, ...rawTx } = tx;
  const restoredTx: Transaction = {
    ...rawTx,
    id: uuidv4(),
    description: `${rawTx.description} (Copy)`,
  };

  s.setStagedTransactions((prev) => [...prev, restoredTx]);
  s.setDuplicateTransactions((prev) => prev.filter((t) => t.id !== tx.id));

  if (s.duplicateTransactions.length === 1) {
    s.setActiveTab('new');
  }
};

/** Commit staged transactions, exiting demo mode when active. */
export const confirmImportWith = (s: UploaderStateBundle, onUploadComplete?: () => void) => () => {
  if (s.isDemoMode) {
    s.clearAll();
    s.setDemoMode(false);
  }

  s.addTransactions(s.stagedTransactions);
  resetWith(s)();
  if (onUploadComplete) onUploadComplete();
};
