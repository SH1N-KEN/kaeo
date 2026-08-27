import { parseCSVFile } from './ingestion/csvParser';
import { parseXLSXFile } from './ingestion/xlsxParser';
import { parsePDFFile } from './ingestion/pdfParser';
import type { ParsedFinancialFile, IngestedParsedFile } from './ingestion/ingestionTypes';

export interface ParseResult {
  headers: string[];
  rows: any[]; // preview rows
  allRows: any[]; // full parsed rows
  rowCount: number;
  provider: string;
  sourceType: string;
  warnings: string[];
  errors: string[];
}

export const detectProvider = (headers: string[], _firstRows: any[], fileName: string): { provider: string; sourceType: string } => {
  const h = headers.map(s => s.toLowerCase());
  const name = fileName.toLowerCase();

  // Heuristics
  if (h.includes('razorpay_payment_id') || h.includes('payment id') || name.includes('razorpay') || h.includes('settlement id') || h.includes('settlement_id')) {
    return { provider: 'Razorpay', sourceType: 'gateway' };
  }
  
  if (h.includes('stripe id') || h.includes('balance transaction id') || name.includes('stripe')) {
    return { provider: 'Stripe', sourceType: 'gateway' };
  }

  if (h.includes('order number') && h.includes('lineitem quantity')) {
    return { provider: 'Shopify', sourceType: 'ecommerce' };
  }

  const normalized = headers.map(s => s.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  const hasDateCol = normalized.some(x => x === 'date' || x === 'txndate' || x === 'transactiondate' || x === 'valuedt' || x === 'valuedate');
  const hasAmtCol = normalized.some(x => x.includes('amount') || x.includes('withdrawal') || x.includes('deposit') || x === 'debit' || x === 'credit' || x === 'dr' || x === 'cr' || x === 'payment' || x === 'receipt' || x === 'outflow' || x === 'inflow');

  if (hasDateCol && hasAmtCol) {
    return { provider: 'Bank Statement', sourceType: 'bank' };
  }

  if (h.includes('voucher number') || h.includes('ledger name')) {
    return { provider: 'Tally', sourceType: 'erp' };
  }

  if (
    h.some(x => ['invoice no', 'invoice number', 'supplier details', 'supplier', 'item', 'qty', 'quantity', 'amount (in rs.)', 'amount in rs', 'payment date', 'order date'].some(kw => x.includes(kw))) ||
    name.includes('expense') || name.includes('ledger') || name.includes('purchase')
  ) {
    return { provider: 'Expense Ledger', sourceType: 'expense_ledger' };
  }

  return { provider: 'Generic Finance File', sourceType: 'other' };
};

/**
 * Legacy Papaparse direct parsing for backward compatibility.
 */
export { parseCSV } from './fileParserLegacy';

/**
 * Unified Hardcore Parser Ingestion Coordinator
 * Resolves CSV, XLSX, and PDF statement formats into a unified schema.
 */
export const parseFinancialFile = async (file: File): Promise<IngestedParsedFile> => {
  const ext = file.name.split('.').pop()?.toLowerCase();

  let parsed: ParsedFinancialFile;

  if (ext === 'csv') {
    parsed = await parseCSVFile(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    parsed = await parseXLSXFile(file);
  } else if (ext === 'pdf') {
    parsed = await parsePDFFile(file);
  } else {
    parsed = {
      fileName: file.name,
      fileType: 'csv',
      rawRows: [],
      previewRows: [],
      detectedColumns: [],
      suggestedMapping: {},
      confidence: 0,
      warnings: [],
      errors: ['Unsupported file format. Kaeo supports CSV, XLSX, and PDF financial files.'],
      metadata: {
        totalRows: 0,
        previewRowCount: 0,
        skippedRows: 0
      }
    };
  }

  // Set backward-compatible fields
  const { provider, sourceType } = detectProvider(parsed.detectedColumns, parsed.previewRows, parsed.fileName);
  
  const enriched: IngestedParsedFile = {
    ...parsed,
    headers: parsed.detectedColumns,
    rows: parsed.previewRows,
    allRows: parsed.rawRows,
    rowCount: parsed.metadata.totalRows,
    provider: provider,
    sourceType: sourceType
  };

  return enriched;
};
