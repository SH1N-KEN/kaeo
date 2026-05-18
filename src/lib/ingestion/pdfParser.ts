import type { ParsedFinancialFile } from './ingestionTypes';

export const parsePDFFile = (file: File): Promise<ParsedFinancialFile> => {
  return new Promise((resolve) => {
    resolve({
      fileName: file.name,
      fileType: 'pdf',
      rawRows: [],
      previewRows: [],
      detectedColumns: [],
      suggestedMapping: {},
      confidence: 0.1,
      warnings: ['Kaeo PDF parsing comes in Phase 12B. Upload CSV/XLSX for best accuracy.'],
      errors: ['PDF parsing is currently disabled. Please use CSV or Excel statements.'],
      metadata: {
        totalRows: 0,
        previewRowCount: 0,
        skippedRows: 0
      }
    });
  });
};
