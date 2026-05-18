import * as XLSX from 'xlsx';
import { detectHeaderRow, filterMessyRows } from './headerDetector';
import type { ParsedFinancialFile, ParsedSheet } from './ingestionTypes';
import { suggestMappingFromColumns } from '../mappingEngine';
import { calculateParserConfidence } from './ingestionConfidence';

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
          // Convert sheet to raw 2D grid containing all cell contents (including empty cells as null)
          const rawGrid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });

          if (!rawGrid || rawGrid.length === 0) {
            return; // Skip empty sheets
          }

          // Run smart header detection per sheet
          const { headerRowIndex, headers, skippedRowCount, warnings: headerWarnings } = detectHeaderRow(rawGrid);

          if (headers.length === 0) {
            return; // Skip if no columns found
          }

          // Map rows to key-value objects
          const dataGrid = rawGrid.slice(headerRowIndex + 1);
          const mappedRows: Record<string, any>[] = dataGrid.map((row) => {
            const obj: Record<string, any> = {};
            headers.forEach((header, idx) => {
              // Format dates parsed by SheetJS to local string formats
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

          // Generate mapping suggestion to verify suitability
          const mappingResult = suggestMappingFromColumns(headers);

          // Calculate confidence score for this sheet
          const confidence = calculateParserConfidence({
            fileType: 'xlsx',
            headers,
            cleanRowsCount: cleanRows.length,
            mapping: mappingResult.mapping,
            warningsCount: allWarnings.length
          });

          parsedSheets.push({
            id: sheetName,
            name: sheetName,
            rowCount: cleanRows.length,
            confidence,
            warnings: allWarnings,
            rawRows: cleanRows,
            detectedColumns: headers,
            detectedHeaderRow: headerRowIndex,
            skippedRows: totalSkipped
          });
        });

        if (parsedSheets.length === 0) {
          resolve(createEmptyErrorResult(file.name, 'No sheets containing valid finance data were found.'));
          return;
        }

        // Auto-select the best sheet using sheet score (confidence * rowCount)
        let bestSheet = parsedSheets[0];
        let maxScore = -1;

        parsedSheets.forEach((s) => {
          const score = s.confidence * s.rowCount;
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
