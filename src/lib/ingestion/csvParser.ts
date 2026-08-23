import Papa from 'papaparse';
import { detectHeaderRow, filterMessyRows } from './headerDetector';
import type { ParsedFinancialFile } from './ingestionTypes';
import { suggestMappingFromColumns } from '../mappingEngine';
import { calculateParserConfidence } from './ingestionConfidence';
import { mergeContinuationRows } from './continuationMerger';

export const parseCSVFile = (file: File): Promise<ParsedFinancialFile> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      skipEmptyLines: 'greedy',
      complete: (results: Papa.ParseResult<any>) => {
        const rawGrid = results.data as any[][];
        
        if (!rawGrid || rawGrid.length === 0) {
          resolve(createEmptyErrorResult(file.name, 'The CSV file is empty.'));
          return;
        }

        // 1. Header row detection
        const { headerRowIndex, headers, skippedRowCount, warnings: headerWarnings } = detectHeaderRow(rawGrid);
        
        if (headers.length === 0) {
          resolve(createEmptyErrorResult(file.name, 'No columns could be detected in this CSV.'));
          return;
        }

        // 2. Map rows based on detected headers
        const dataGrid = rawGrid.slice(headerRowIndex + 1);
        const mappedRows: Record<string, any>[] = dataGrid.map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((header, idx) => {
            obj[header] = row[idx] !== undefined ? row[idx] : null;
          });
          return obj;
        });

        // 3. Filter messy rows (repeated headers, summaries, empty rows)
        const { cleanRows: filteredRows, skippedCount: filterSkipped, warnings: filterWarnings } = filterMessyRows(mappedRows, headers);

        let allWarnings = [...headerWarnings, ...filterWarnings];
        let totalSkipped = skippedRowCount + filterSkipped;

        // 4. Suggest mapping
        const mappingResult = suggestMappingFromColumns(headers);

        // 5. Merge continuation rows generally
        const { cleanRows: mergedRows, mergedCount } = mergeContinuationRows(filteredRows, mappingResult.mapping, headers);
        
        if (mergedCount > 0) {
          allWarnings.push(`Merged ${mergedCount} wrapped/continuation narration lines.`);
        }

        // 6. Calculate confidence
        const confidence = calculateParserConfidence({
          fileType: 'csv',
          headers,
          cleanRowsCount: mergedRows.length,
          mapping: mappingResult.mapping,
          warningsCount: allWarnings.length
        });

        resolve({
          fileName: file.name,
          fileType: 'csv',
          rawRows: mergedRows,
          previewRows: mergedRows.slice(0, 10),
          detectedColumns: headers,
          suggestedMapping: mappingResult.mapping,
          confidence,
          warnings: allWarnings,
          errors: [],
          metadata: {
            totalRows: mergedRows.length,
            previewRowCount: Math.min(10, mergedRows.length),
            detectedHeaderRow: headerRowIndex,
            skippedRows: totalSkipped
          }
        });
      },
      error: (err: any) => {
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
