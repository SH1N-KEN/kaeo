import * as XLSX from 'xlsx';
import { detectHeaderRow, filterMessyRows } from './headerDetector';
import type { ParsedFinancialFile, ParsedSheet } from './ingestionTypes';
import { suggestMappingFromColumns } from '../mappingEngine';
import { calculateParserConfidence } from './ingestionConfidence';
import { mergeContinuationRows } from './continuationMerger';
import { cleanAmount } from './amountNormalizer';

const isNonFinancialName = (name: string): boolean => {
  const lower = name.toLowerCase().trim();
  const keywords = ['readme', 'expected results', 'expected_results', 'summary', 'pivot', 'notes', 'instructions', 'metadata', 'help'];
  return keywords.some(k => lower.includes(k));
};

const isNonFinancialContent = (displayGrid: any[][]): boolean => {
  const keywords = ['readme', 'expected results', 'expected_results', 'summary', 'pivot', 'notes', 'instructions', 'metadata', 'help'];
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

const isHDFCSheet = (headers: string[]): boolean => {
  const normalized = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  
  const hasDate = normalized.some(h => h === 'date' || h === 'txndate' || h === 'transactiondate' || h === 'valuedt' || h === 'valuedate');
  const hasNarration = normalized.some(h => h === 'narration' || h === 'description' || h === 'particulars' || h === 'remarks');
  const hasWithdrawal = normalized.some(h => h.includes('withdrawal') || h === 'debit' || h === 'dr' || h === 'payment');
  const hasDeposit = normalized.some(h => h.includes('deposit') || h === 'credit' || h === 'cr' || h === 'receipt');
  const hasBalance = normalized.some(h => h.includes('balance'));

  return hasDate && hasNarration && hasWithdrawal && hasDeposit && hasBalance;
};

const isExpenseLedgerSheet = (headers: string[]): boolean => {
  const normalized = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  const keywords = ['invoiceno', 'invoicenumber', 'supplierdetails', 'supplier', 'item', 'qty', 'quantity', 'amountinrs', 'amountrs', 'paymentdate', 'orderdate'];
  return keywords.some(k => normalized.includes(k));
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

        workbook.SheetNames.forEach((sheetName: string) => {
          const sheet = workbook.Sheets[sheetName];
          const displayGrid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: null });
          const rawGrid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null });

          if (!displayGrid || displayGrid.length === 0) {
            return;
          }

          // A. Header Row Detection
          const { headerRowIndex, headers, skippedRowCount, warnings: headerWarnings, headerRowsCount = 1 } = detectHeaderRow(displayGrid);

          if (headers.length === 0) {
            return;
          }

          const isHdfc = isHDFCSheet(headers);
          const isExpenseLedger = isExpenseLedgerSheet(headers);
          
          let cleanRows: Record<string, any>[] = [];
          let allWarnings = [...headerWarnings];
          let totalSkipped = skippedRowCount;

          // B. Map Rows
          const dataGrid = rawGrid.slice(headerRowIndex + headerRowsCount);
          const mappedRows: Record<string, any>[] = dataGrid.map((row) => {
            const obj: Record<string, any> = {};
            headers.forEach((header, idx) => {
              let cellVal = row[idx];
              if (cellVal instanceof Date) {
                // Strict UTC shifted string serialization
                const adjusted = new Date(cellVal.getTime() - cellVal.getTimezoneOffset() * 60000);
                cellVal = adjusted.toISOString().split('T')[0];
              }
              obj[header] = cellVal !== undefined ? cellVal : null;
            });
            return obj;
          });

          // C. Filter Messy Rows
          const { cleanRows: filteredRows, skippedCount: filterSkipped, warnings: filterWarnings } = filterMessyRows(mappedRows, headers);
          allWarnings = [...allWarnings, ...filterWarnings];
          totalSkipped += filterSkipped;

          // D. Suggest Mapping
          const mappingResult = suggestMappingFromColumns(headers);

          // E. Merge Continuation Rows Generally
          const { cleanRows: mergedRows, mergedCount } = mergeContinuationRows(filteredRows, mappingResult.mapping, headers);
          cleanRows = mergedRows;
          
          if (mergedCount > 0) {
            allWarnings.push(`Merged ${mergedCount} wrapped/continuation narration lines.`);
          }

          // F. Calculate general reconciliation statistics for the sheet preview
          let balanceWarnings = 0;
          let prevBalance: number | null = null;
          let totalDeposits = 0;
          let totalWithdrawals = 0;

          const debitCol = mappingResult.mapping['debit'];
          const creditCol = mappingResult.mapping['credit'];
          const amountCol = mappingResult.mapping['amount'];
          const balanceCol = headers.find(h => ['balance', 'closingbalance', 'runningbalance'].includes(h.toLowerCase().trim().replace(/[^a-z0-9]/g, '')));

          cleanRows.forEach((row) => {
            let depositVal = 0;
            let withdrawalVal = 0;

            if (debitCol || creditCol) {
              if (debitCol && row[debitCol] !== undefined && row[debitCol] !== null) {
                const cleaned = cleanAmount(row[debitCol]);
                withdrawalVal = Math.abs(cleaned.amount);
              }
              if (creditCol && row[creditCol] !== undefined && row[creditCol] !== null) {
                const cleaned = cleanAmount(row[creditCol]);
                depositVal = Math.abs(cleaned.amount);
              }
            } else if (amountCol && row[amountCol] !== undefined && row[amountCol] !== null) {
              const cleaned = cleanAmount(row[amountCol]);
              if (cleaned.amount < 0) {
                withdrawalVal = Math.abs(cleaned.amount);
              } else {
                depositVal = cleaned.amount;
              }
            }

            totalDeposits += depositVal;
            totalWithdrawals += withdrawalVal;

            if (balanceCol && row[balanceCol] !== undefined && row[balanceCol] !== null && row[balanceCol] !== '') {
              const cleanBal = typeof row[balanceCol] === 'number' ? row[balanceCol] : parseFloat(String(row[balanceCol]).replace(/,/g, '').trim());
              if (!isNaN(cleanBal)) {
                if (prevBalance !== null) {
                  const expectedDelta = depositVal - withdrawalVal;
                  const actualDelta = cleanBal - prevBalance;
                  const diff = Math.abs(expectedDelta - actualDelta);
                  if (diff > 0.02) {
                    balanceWarnings++;
                  }
                }
                prevBalance = cleanBal;
              }
            }
          });

          const netCashMovement = totalDeposits - totalWithdrawals;

          if (balanceWarnings > 0) {
            allWarnings.push(`${balanceWarnings} rows have balance movement mismatches and should be reviewed.`);
          }

          const hdfcStats = {
            transactionsCount: cleanRows.length,
            continuationRowsMerged: mergedCount,
            orphanRowsSkipped: 0,
            blankRowsSkipped: totalSkipped,
            balanceWarnings,
            totalDeposits,
            totalWithdrawals,
            netCashMovement
          };

          const suggestsNonFinancial = isNonFinancialName(sheetName) || isNonFinancialContent(displayGrid);
          const isValidTransactionSheet = isHdfc || isExpenseLedger || (headers.length >= 3 && cleanRows.length >= 3);
          const isNonFinancial = suggestsNonFinancial && !isValidTransactionSheet;

          let confidence = isHdfc ? 1.0 : calculateParserConfidence({
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
            isNonFinancial,
            isHDFC: isHdfc,
            hdfcStats
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
            skippedRows: bestSheet.skippedRows,
            isHDFC: bestSheet.isHDFC,
            hdfcStats: bestSheet.hdfcStats
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
