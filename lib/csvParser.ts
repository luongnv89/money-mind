import Papa from 'papaparse';
import { Transaction, TransactionCategory, CsvMapping } from '../types';
import { SUPPORTED_BANKS } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { normalizeDate } from './utils';

// Helper to manually detect delimiter by reading first chunk of file
const detectBestDelimiter = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        resolve(',');
        return;
      }

      const firstLine = text.split('\n')[0] || '';
      // Check common delimiters
      const delimiters = [',', ';', '|', '\t'];
      let best = ',';
      let max = 0;

      delimiters.forEach((d) => {
        // Simple count. Note: this doesn't handle delimiters inside quotes,
        // but for a header line heuristic it's usually sufficient.
        const count = firstLine.split(d).length - 1;
        if (count > max) {
          max = count;
          best = d;
        }
      });
      resolve(best);
    };
    reader.onerror = () => resolve(','); // Fallback
    reader.readAsText(file.slice(0, 5000)); // Read first 5KB
  });
};

// Robust number parser for handling various currency formats (US vs EU)
export const parseAmount = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;

  const str = String(val).trim();
  // Remove spaces (often used as thousand separators in EU formats like "1 131,98")
  // \u00A0 is non-breaking space
  const cleanStr = str.replace(/\s/g, '').replace(/\u00A0/g, '');

  // Heuristic:
  // 1. If contains ',' and NO '.', it's likely European decimal (e.g. -61,75)
  if (cleanStr.includes(',') && !cleanStr.includes('.')) {
    return parseFloat(cleanStr.replace(',', '.'));
  }

  // 2. If contains both '.' and ',', check positions
  if (cleanStr.includes(',') && cleanStr.includes('.')) {
    const lastComma = cleanStr.lastIndexOf(',');
    const lastDot = cleanStr.lastIndexOf('.');

    // If comma is after dot (1.234,56), it's European
    if (lastComma > lastDot) {
      return parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
    }
    // If dot is after comma (1,234.56), it's US
    // handled by default parseFloat after removing commas
    return parseFloat(cleanStr.replace(/,/g, ''));
  }

  // 3. Standard parsing (handles simple "123" or "123.45")
  return parseFloat(cleanStr);
};

// Auto-detect columns based on heuristics
export const autoDetectMapping = (headers: string[], delimiter: string): CsvMapping => {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  const findCol = (keywords: string[], excludeCols: string[] = []) => {
    // 1. Try exact match
    for (const k of keywords) {
      const idx = lowerHeaders.indexOf(k);
      if (idx !== -1 && !excludeCols.includes(headers[idx])) return headers[idx];
    }
    // 2. Try partial match
    for (const k of keywords) {
      const idx = lowerHeaders.findIndex((h) => h.includes(k));
      if (idx !== -1 && !excludeCols.includes(headers[idx])) return headers[idx];
    }
    return '';
  };

  // Date Keywords
  const dateCol = findCol(['date', 'time', 'posted', 'processed', 'booking']);

  // Amount Keywords
  const amountCol = findCol(['amount', 'amt', 'value', 'debit', 'cost', 'sum', 'total']);

  // Description Keywords (Prioritized List)
  // "label" and "motif" added as requested
  const descKeywords = [
    'description',
    'desc',
    'memo',
    'narrative',
    'payee',
    'merchant',
    'label',
    'motif',
    'libelle',
    'details',
    'activity',
    'transaction',
  ];

  // Ensure we don't pick the Date or Amount column as Description
  const descCol = findCol(descKeywords, [dateCol, amountCol]) || headers[1] || '';

  // Category Keywords
  const categoryCol = findCol(
    ['category', 'type', 'class', 'classification'],
    [dateCol, amountCol, descCol]
  );

  return {
    dateCol: dateCol || headers[0] || '',
    descCol: descCol,
    amountCol: amountCol || headers[2] || '',
    categoryCol: categoryCol,
    hasHeader: true,
    delimiter,
  };
};

// Row rejected during parsing
export interface RejectedRow {
  row: Record<string, unknown>;
  reason: string;
  index: number;
}

// 1. Get headers with robust delimiter detection
export const getCSVHeaders = (file: File): Promise<{ headers: string[]; delimiter: string }> => {
  return new Promise((resolve, reject) => {
    detectBestDelimiter(file)
      .then((delimiter) => {
        Papa.parse(file, {
          header: true,
          preview: 1,
          delimiter: delimiter,
          complete: (results) => {
            // Try meta.fields first
            if (results.meta.fields && results.meta.fields.length > 0) {
              resolve({ headers: results.meta.fields, delimiter });
              return;
            }
            // Try data keys
            if (results.data && results.data.length > 0) {
              const keys = Object.keys(results.data[0] as object);
              if (keys.length > 0) {
                resolve({ headers: keys, delimiter });
                return;
              }
            }
            // Nothing found — reject with descriptive error
            if (results.errors.length > 0) {
              reject(new Error('CSV Parse Error: ' + results.errors[0].message));
              return;
            }
            reject(new Error('CSV file is empty or unreadable'));
          },
          error: (err) => reject(err),
        });
      })
      .catch((e) => {
        reject(e);
      });
  });
};

export const getPreviewTransactions = (
  file: File,
  mapping: CsvMapping,
  limit: number = 10
): Promise<Transaction[]> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      preview: limit,
      skipEmptyLines: true,
      dynamicTyping: false, // Turn off dynamic typing to handle amounts manually
      delimiter: mapping.delimiter,
      complete: (results) => {
        const data = results.data as Record<string, unknown>[];
        if (!data || data.length === 0) {
          resolve([]);
          return;
        }

        try {
          const transactions = data.map((row, idx) => {
            const rawAmt = row[mapping.amountCol];
            const amount = parseAmount(rawAmt);

            const rawDate = row[mapping.dateCol];
            const desc = row[mapping.descCol];
            const originalCat = mapping.categoryCol ? row[mapping.categoryCol] : undefined;

            return {
              id: `preview-${idx}`,
              date: normalizeDate(rawDate ? String(rawDate) : ''),
              description: desc ? String(desc) : '',
              amount: isNaN(amount) ? 0 : amount,
              originalCategory: originalCat ? String(originalCat) : undefined,
              category: TransactionCategory.Uncategorized,
              confidence: 0,
              raw: row,
              index: idx + 2, // 1-based index, accounting for header
            } as Transaction;
          });
          resolve(transactions);
        } catch (_e) {
          resolve([]);
        }
      },
      error: () => resolve([]),
    });
  });
};

// 2. Parse with specific mapping — returns accepted + rejected rows
export const parseCSVWithMapping = (
  file: File,
  mapping: CsvMapping
): Promise<{ accepted: Transaction[]; rejected: RejectedRow[] }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimiter: mapping.delimiter,
      complete: (results) => {
        const data = results.data as Record<string, unknown>[];
        if (!data || data.length === 0) {
          reject(new Error('No data found in CSV'));
          return;
        }

        try {
          const accepted: Transaction[] = [];
          const rejected: RejectedRow[] = [];

          data.forEach((row, idx) => {
            const rawDesc = row[mapping.descCol];
            const description = rawDesc ? String(rawDesc).trim() : '';
            const amount = parseAmount(row[mapping.amountCol]);
            const rawDate = row[mapping.dateCol];
            const fallbackDate = new Date().toISOString().split('T')[0];
            const date = rawDate ? String(rawDate) : fallbackDate;
            const normalizedDate = normalizeDate(date);
            const originalCat = mapping.categoryCol ? row[mapping.categoryCol] : undefined;

            // Build the transaction object
            const tx: Transaction = {
              id: uuidv4(),
              date: normalizedDate,
              description: description || 'Unknown',
              amount: isNaN(amount) ? 0 : amount,
              originalCategory: originalCat ? String(originalCat) : undefined,
              category: TransactionCategory.Uncategorized,
              confidence: 0,
              raw: row,
              index: idx + 2,
            };

            // Reject rows that cannot produce a usable transaction; keep the rest,
            // including genuine zero-amount rows that used to be silently dropped.
            if (isNaN(amount)) {
              rejected.push({
                row,
                reason: `Unparseable amount: "${row[mapping.amountCol]}"`,
                index: idx + 2,
              });
            } else if (description === '') {
              rejected.push({ row, reason: 'Empty description', index: idx + 2 });
            } else {
              accepted.push(tx);
            }
          });

          resolve({ accepted, rejected });
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(err),
    });
  });
};

export const detectBankFormat = (headers: string[]): Partial<CsvMapping> | null => {
  for (const bank of SUPPORTED_BANKS) {
    const required = [bank.dateCol, bank.descCol];
    if (!bank.debitCreditCols) required.push(bank.amountCol);

    if (required.every((col) => headers.includes(col))) {
      return {
        dateCol: bank.dateCol,
        descCol: bank.descCol,
        amountCol: bank.amountCol,
        categoryCol: bank.categoryCol,
        hasHeader: true,
      };
    }
  }
  return null;
};
