import Papa from 'papaparse';
import { detectHeaderRow, filterMessyRows } from './headerDetector';
import type { ParsedFinancialFile } from './ingestionTypes';
import { suggestMappingFromColumns } from '../mappingEngine';
import { calculateParserConfidence } from './ingestionConfidence';

export const parseCSVFile = (file: File): Promise<ParsedFinancialFile> => {
  return new Promise((resolve) => {
    // Parse raw rows first without headers to find the best header row index
    Papa.parse(file, {
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const rawGrid = results.data as any[][];
        
        if (!rawGrid || rawGrid.length === 0) {
          resolve(createEmptyErrorResult(file.name, 'The CSV file is empty.'));
          return;
        }

        // Run smart header detection
        const { headerRowIndex, headers, skippedRowCount, warnings: headerWarnings } = detectHeaderRow(rawGrid);
        
        if (headers.length === 0) {
          resolve(createEmptyErrorResult(file.name, 'No columns could be detected in this CSV.'));
          return;
        }

        // Map arrays to key-value objects using the detected headers
        const dataGrid = rawGrid.slice(headerRowIndex + 1);
        const mappedRows: Record<string, any>[] = dataGrid.map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((header, idx) => {
            obj[header] = row[idx] !== undefined ? row[idx] : null;
          });
          return obj;
        });

        // Run clean/messy rows filtering
        const { cleanRows, skippedCount: filterSkipped, warnings: filterWarnings } = filterMessyRows(mappedRows, headers);

        const allWarnings = [...headerWarnings, ...filterWarnings];
        const totalSkipped = skippedRowCount + filterSkipped;

        // Generate best mapping suggestion based on headers
        const mappingResult = suggestMappingFromColumns(headers);

        // Calculate parser + mapping confidence
        const confidence = calculateParserConfidence({
          fileType: 'csv',
          headers,
          cleanRowsCount: cleanRows.length,
          mapping: mappingResult.mapping,
          warningsCount: allWarnings.length
        });

        resolve({
          fileName: file.name,
          fileType: 'csv',
          rawRows: cleanRows,
          previewRows: cleanRows.slice(0, 10), // Preview first 10 rows
          detectedColumns: headers,
          suggestedMapping: mappingResult.mapping,
          confidence,
          warnings: allWarnings,
          errors: [],
          metadata: {
            totalRows: cleanRows.length,
            previewRowCount: Math.min(10, cleanRows.length),
            detectedHeaderRow: headerRowIndex,
            skippedRows: totalSkipped
          }
        });
      },
      error: (err) => {
        resolve(createEmptyErrorResult(file.name, `Parsing error: ${err.message}`));
      }
    });
  });
};

const createEmptyErrorResult = (fileName: string, errorMessage: string): ParsedFinancialFile => {
  return {
    fileName,
    fileType: 'csv',
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
