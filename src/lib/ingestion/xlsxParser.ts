import * as XLSX from 'xlsx';
import { detectHeaderRow, filterMessyRows } from './headerDetector';
import type { ParsedFinancialFile, ParsedSheet } from './ingestionTypes';
import { suggestMappingFromColumns } from '../mappingEngine';
import { calculateParserConfidence } from './ingestionConfidence';

const DATE_KEYWORDS = ['date', 'txn date', 'txn_date', 'transaction date', 'value date', 'posted', 'tran date', 'val date', 'time'];
const DESC_KEYWORDS = ['description', 'narration', 'particulars', 'remarks', 'payee', 'vendor', 'details', 'particular', 'payer'];
const AMT_KEYWORDS = ['amount', 'debit', 'credit', 'withdrawal', 'deposit', 'net amount', 'value', 'txn amount', 'balance', 'paid', 'received'];

const isDateLike = (val: any): boolean => {
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === 'number') {
    return val > 30000 && val < 60000;
  }
  if (typeof val !== 'string') return false;
  const cleaned = val.trim();
  if (!cleaned) return false;
  const dateRegex = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/;
  if (dateRegex.test(cleaned)) return true;
  const parsed = Date.parse(cleaned);
  return !isNaN(parsed);
};

const isDescriptionLike = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  const str = val.toString().trim();
  return str.length > 0;
};

const isAmountLike = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') return val !== 0;
  const str = val.toString().trim();
  if (str === '' || str === '-' || str === '0' || str === '0.00') return false;
  const cleaned = str.replace(/,/g, '').replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  return !isNaN(parsed) && parsed !== 0;
};

const findColumnIndex = (headers: string[], keywords: string[]): number => {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  return headers.findIndex((h, idx) => {
    const nh = normalizedHeaders[idx];
    const words = h.toLowerCase().split(/[^a-z0-9]+/);
    return keywords.some(k => {
      const nk = k.replace(/[^a-z0-9]/g, '');
      if (['in', 'out', 'dr', 'cr'].includes(k)) {
        return words.includes(k) || nh === nk;
      }
      return nh.includes(nk) || words.includes(nk);
    });
  });
};

const findAllAmountColumnIndexes = (headers: string[]): number[] => {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  const indexes: number[] = [];
  headers.forEach((h, idx) => {
    const nh = normalizedHeaders[idx];
    const words = h.toLowerCase().split(/[^a-z0-9]+/);
    const isAmt = AMT_KEYWORDS.some(k => {
      const nk = k.replace(/[^a-z0-9]/g, '');
      if (['in', 'out', 'dr', 'cr'].includes(k)) {
        return words.includes(k) || nh === nk;
      }
      return nh.includes(nk) || words.includes(nk);
    });
    if (isAmt) {
      indexes.push(idx);
    }
  });
  return indexes;
};

const isNonFinancialName = (name: string): boolean => {
  const lower = name.toLowerCase().trim();
  const keywords = [
    'readme',
    'expected results',
    'expected_results',
    'summary',
    'pivot',
    'notes',
    'instructions',
    'metadata',
    'help'
  ];
  return keywords.some(k => lower.includes(k));
};

const isNonFinancialContent = (displayGrid: any[][]): boolean => {
  const keywords = [
    'readme',
    'expected results',
    'expected_results',
    'summary',
    'pivot',
    'notes',
    'instructions',
    'metadata',
    'help'
  ];
  const rowsToScan = Math.min(10, displayGrid.length);
  for (let r = 0; r < rowsToScan; r++) {
    const row = displayGrid[r];
    if (!row || !Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val !== null && val !== undefined) {
        const valStr = val.toString().toLowerCase();
        if (keywords.some(k => valStr.includes(k))) {
          return true;
        }
      }
    }
  }
  return false;
};

export const parseXLSXFile = (file: File): Promise<ParsedFinancialFile> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        const parsedSheets: ParsedSheet[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          // Convert sheet twice: once for reliable header detection (strings), once for raw numbers
          const displayGrid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: null });
          const rawGrid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null });

          if (!displayGrid || displayGrid.length === 0) {
            return; // Skip empty sheets
          }

          // Run smart header detection per sheet using the display grid for string matching
          const { headerRowIndex, headers, skippedRowCount, warnings: headerWarnings } = detectHeaderRow(displayGrid);

          if (headers.length === 0) {
            return; // Skip if no columns found
          }

          // Map rows to key-value objects using the raw grid for precise numeric values
          const dataGrid = rawGrid.slice(headerRowIndex + 1);
          const mappedRows: Record<string, any>[] = dataGrid.map((row) => {
            const obj: Record<string, any> = {};
            headers.forEach((header, idx) => {
              // Strictly map by index to prevent column shifting
              let cellVal = row[idx];
              if (cellVal instanceof Date) {
                cellVal = cellVal.toISOString().split('T')[0];
              }
              obj[header] = cellVal !== undefined ? cellVal : null;
            });
            return obj;
          });

          // Filter messy rows
          const { cleanRows, skippedCount: filterSkipped, warnings: filterWarnings } = filterMessyRows(mappedRows, headers);
          const allWarnings = [...headerWarnings, ...filterWarnings];
          const totalSkipped = skippedRowCount + filterSkipped;

          // 1. Check if sheet name or content suggests README etc.
          const suggestsNonFinancial = isNonFinancialName(sheetName) || isNonFinancialContent(displayGrid);

          // 2. Determine if it is a valid transaction sheet
          const dateIdx = findColumnIndex(headers, DATE_KEYWORDS);
          const descIdx = findColumnIndex(headers, DESC_KEYWORDS);
          const amtIndexes = findAllAmountColumnIndexes(headers);

          const hasRequiredColumns = dateIdx !== -1 && descIdx !== -1 && amtIndexes.length > 0;
          
          let validTransactionRowsCount = 0;
          if (hasRequiredColumns) {
            dataGrid.forEach((row) => {
              if (!row || !Array.isArray(row)) return;
              const dateVal = row[dateIdx];
              const descVal = row[descIdx];
              if (!isDateLike(dateVal)) return;
              if (!isDescriptionLike(descVal)) return;
              
              let hasAmt = false;
              for (const idx of amtIndexes) {
                if (isAmountLike(row[idx])) {
                  hasAmt = true;
                  break;
                }
              }
              if (hasAmt) {
                validTransactionRowsCount++;
              }
            });
          }

          const isValidTransactionSheet = hasRequiredColumns && validTransactionRowsCount >= 3;
          const isNonFinancial = suggestsNonFinancial && !isValidTransactionSheet;

          // Generate mapping suggestion to verify suitability
          const mappingResult = suggestMappingFromColumns(headers);

          // Calculate confidence score for this sheet
          let confidence = calculateParserConfidence({
            fileType: 'xlsx',
            headers,
            cleanRowsCount: cleanRows.length,
            mapping: mappingResult.mapping,
            warningsCount: allWarnings.length
          });

          if (isNonFinancial) {
            confidence = 0;
          }

          parsedSheets.push({
            id: sheetName,
            name: sheetName,
            rowCount: cleanRows.length,
            confidence,
            warnings: allWarnings,
            rawRows: cleanRows,
            detectedColumns: headers,
            detectedHeaderRow: headerRowIndex,
            skippedRows: totalSkipped,
            isNonFinancial
          });
        });

        if (parsedSheets.length === 0) {
          resolve(createEmptyErrorResult(file.name, 'No sheets containing valid finance data were found.'));
          return;
        }

        // Auto-select the best sheet using sheet score (confidence * rowCount)
        let bestSheet = parsedSheets[0];
        let maxScore = -999999;

        parsedSheets.forEach((s) => {
          // If a sheet is non-financial, penalize its score so a financial sheet is preferred
          const score = s.isNonFinancial ? -1000 : s.confidence * s.rowCount;
          if (score > maxScore) {
            maxScore = score;
            bestSheet = s;
          }
        });

        const mappingResult = suggestMappingFromColumns(bestSheet.detectedColumns);

        resolve({
          fileName: file.name,
          fileType: 'xlsx',
          sheets: parsedSheets,
          selectedSheetId: bestSheet.id,
          isNonFinancial: bestSheet.isNonFinancial,
          rawRows: bestSheet.rawRows,
          previewRows: bestSheet.rawRows.slice(0, 10),
          detectedColumns: bestSheet.detectedColumns,
          suggestedMapping: mappingResult.mapping,
          confidence: bestSheet.confidence,
          warnings: bestSheet.warnings,
          errors: [],
          metadata: {
            totalRows: bestSheet.rowCount,
            previewRowCount: Math.min(10, bestSheet.rowCount),
            detectedHeaderRow: bestSheet.detectedHeaderRow,
            skippedRows: bestSheet.skippedRows
          }
        });

      } catch (err: any) {
        resolve(createEmptyErrorResult(file.name, `XLSX Parsing failed: ${err.message}`));
      }
    };

    reader.onerror = () => {
      resolve(createEmptyErrorResult(file.name, 'File reading error.'));
    };

    reader.readAsArrayBuffer(file);
  });
};

const createEmptyErrorResult = (fileName: string, errorMessage: string): ParsedFinancialFile => {
  return {
    fileName,
    fileType: 'xlsx',
    rawRows: [],
    previewRows: [],
    detectedColumns: [],
    suggestedMapping: {},
    confidence: 0,
    warnings: [],
    errors: [errorMessage],
    metadata: {
      totalRows: 0,
      previewRowCount: 0,
      skippedRows: 0
    }
  };
};
