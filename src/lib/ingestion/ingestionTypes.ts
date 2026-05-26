export interface ParsedSheet {
  id: string;
  name: string;
  rowCount: number;
  confidence: number;
  warnings: string[];
  rawRows: Record<string, unknown>[];
  detectedColumns: string[];
  detectedHeaderRow?: number;
  skippedRows?: number;
  isNonFinancial?: boolean;
  isHDFC?: boolean;
  hdfcStats?: any;
}

export interface ParsedFinancialFile {
  fileName: string;
  fileType: 'csv' | 'xlsx' | 'pdf';
  sheets?: ParsedSheet[];
  selectedSheetId?: string;
  rawRows: Record<string, unknown>[];
  previewRows: Record<string, unknown>[];
  detectedColumns: string[];
  suggestedMapping: Record<string, string>;
  confidence: number; // 0 to 1
  warnings: string[];
  errors: string[];
  isNonFinancial?: boolean;
  metadata: {
    totalRows: number;
    previewRowCount: number;
    detectedHeaderRow?: number;
    skippedRows?: number;
    dateRange?: { start?: string; end?: string };
    currency?: string;
    isHDFC?: boolean;
    hdfcStats?: any;
  };
  
  // Backward compatibility fields (Optional in base type)
  headers?: string[];
  rows?: any[];
  allRows?: any[];
  rowCount?: number;
  provider?: string;
  sourceType?: string;
}

/**
 * Fully enriched and processed financial file structure, ready for UI consumption.
 */
export interface IngestedParsedFile extends ParsedFinancialFile {
  headers: string[];
  rows: any[];
  allRows: any[];
  rowCount: number;
  provider: string;
  sourceType: string;
}

export interface IngestionMappingSuggestion {
  mapping: Record<string, string>;
  confidence: number;
  status: 'ready_to_import' | 'review_mapping' | 'mapping_required';
  warnings: string[];
  source: 'rules' | 'ai' | 'manual';
}
