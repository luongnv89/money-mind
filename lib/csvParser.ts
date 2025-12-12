
import Papa from 'papaparse';
import { BankFormat, Transaction, TransactionCategory, CsvMapping } from '../types';
import { SUPPORTED_BANKS } from '../constants';
import { v4 as uuidv4 } from 'uuid';

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
      
      delimiters.forEach(d => {
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
const parseAmount = (val: any): number => {
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
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());
    
    const findCol = (keywords: string[], excludeCols: string[] = []) => {
        // 1. Try exact match
        for (const k of keywords) {
            const idx = lowerHeaders.indexOf(k);
            if (idx !== -1 && !excludeCols.includes(headers[idx])) return headers[idx];
        }
        // 2. Try partial match
        for (const k of keywords) {
            const idx = lowerHeaders.findIndex(h => h.includes(k));
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
        'description', 'desc', 'memo', 'narrative', 
        'payee', 'merchant', 'label', 'motif', 
        'libelle', 'details', 'activity', 'transaction'
    ];
    
    // Ensure we don't pick the Date or Amount column as Description
    const descCol = findCol(descKeywords, [dateCol, amountCol]) || headers[1] || '';

    // Category Keywords
    const categoryCol = findCol(['category', 'type', 'class', 'classification'], [dateCol, amountCol, descCol]);

    return {
        dateCol: dateCol || headers[0] || '',
        descCol: descCol,
        amountCol: amountCol || headers[2] || '',
        categoryCol: categoryCol,
        hasHeader: true,
        delimiter
    };
};

// 1. Get headers with robust delimiter detection
export const getCSVHeaders = (file: File): Promise<{ headers: string[], delimiter: string }> => {
  return new Promise(async (resolve, reject) => {
    try {
      const delimiter = await detectBestDelimiter(file);
      
      Papa.parse(file, {
        header: true,
        preview: 1, // Read only first few lines
        delimiter: delimiter, // Enforce detected delimiter
        step: (row) => {
          // We just need the keys from the first row
          if (row.meta.fields) {
              resolve({ headers: row.meta.fields, delimiter });
          } else if (row.data && typeof row.data === 'object') {
              resolve({ headers: Object.keys(row.data as object), delimiter });
          }
        },
        complete: (results) => {
          if (results.meta.fields) {
              resolve({ headers: results.meta.fields, delimiter });
          } else if (results.data.length > 0) {
              resolve({ headers: Object.keys(results.data[0] as object), delimiter });
          } else {
             if (results.errors.length > 0) {
                 reject(new Error("CSV Parse Error: " + results.errors[0].message));
             }
          }
        },
        error: (err) => reject(err)
      });
    } catch (e) {
      reject(e);
    }
  });
};

export const getPreviewTransactions = (file: File, mapping: CsvMapping, limit: number = 10): Promise<Transaction[]> => {
    return new Promise((resolve) => {
        Papa.parse(file, {
            header: true,
            preview: limit,
            skipEmptyLines: true,
            dynamicTyping: false, // Turn off dynamic typing to handle amounts manually
            delimiter: mapping.delimiter,
            complete: (results) => {
                const data = results.data as Record<string, any>[];
                if (!data || data.length === 0) {
                    resolve([]);
                    return;
                }
                
                try {
                    const transactions = data.map((row, idx) => {
                         const rawAmt = row[mapping.amountCol];
                         const amount = parseAmount(rawAmt);
                         
                         const date = row[mapping.dateCol];
                         const desc = row[mapping.descCol];
                         const originalCat = mapping.categoryCol ? row[mapping.categoryCol] : undefined;

                         return {
                             id: `preview-${idx}`,
                             date: date ? String(date) : '',
                             description: desc ? String(desc) : '',
                             amount: isNaN(amount) ? 0 : amount,
                             originalCategory: originalCat ? String(originalCat) : undefined,
                             category: TransactionCategory.Uncategorized,
                             confidence: 0,
                             raw: row,
                             index: idx + 2 // 1-based index, accounting for header
                         } as Transaction;
                    });
                    resolve(transactions);
                } catch(e) {
                    resolve([]);
                }
            },
            error: () => resolve([])
        });
    });
};

// 2. Parse with specific mapping
export const parseCSVWithMapping = (file: File, mapping: CsvMapping): Promise<Transaction[]> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false, // Turn off dynamic typing to handle amounts manually
            delimiter: mapping.delimiter, // Use the delimiter found during header detection
            complete: (results) => {
                const data = results.data as Record<string, any>[];
                if (!data || data.length === 0) {
                    reject(new Error("No data found in CSV"));
                    return;
                }
                
                try {
                    const transactions = data.map((row, idx) => {
                         const amount = parseAmount(row[mapping.amountCol]);
                         let date = row[mapping.dateCol];
                         if (!date) date = new Date().toISOString(); // Fallback
                         
                         const originalCat = mapping.categoryCol ? row[mapping.categoryCol] : undefined;

                         return {
                             id: uuidv4(),
                             date: String(date),
                             description: row[mapping.descCol] || 'Unknown',
                             amount: isNaN(amount) ? 0 : amount,
                             originalCategory: originalCat ? String(originalCat) : undefined,
                             category: TransactionCategory.Uncategorized,
                             confidence: 0,
                             raw: row, // Store original row
                             index: idx + 2 // 1-based index
                         }
                    }).filter(t => t.description !== 'Unknown' && t.amount !== 0);

                    resolve(transactions);
                } catch(e) {
                    reject(e);
                }
            },
            error: (err) => reject(err)
        });
    });
};

export const detectBankFormat = (headers: string[]): Partial<CsvMapping> | null => {
    for (const bank of SUPPORTED_BANKS) {
        const required = [bank.dateCol, bank.descCol];
        if (!bank.debitCreditCols) required.push(bank.amountCol);
        
        if (required.every(col => headers.includes(col))) {
            return {
                dateCol: bank.dateCol,
                descCol: bank.descCol,
                amountCol: bank.amountCol,
                categoryCol: bank.categoryCol, // Included if present in bank definition
                hasHeader: true
            };
        }
    }
    return null;
};
