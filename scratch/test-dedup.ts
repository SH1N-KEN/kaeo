import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { normalizeIngestedRows } from '../src/lib/ingestion/transactionNormalizer';
import { checkDuplicateTransactions } from '../src/lib/ingestion/duplicateEngine';
import { suggestMappingFromColumns } from '../src/lib/mappingEngine';
import { detectHeaderRow } from '../src/lib/ingestion/headerDetector';

// Mock Supabase
import { supabase } from '../src/lib/supabase';
supabase.from = () => ({
  select: () => ({
    eq: () => Promise.resolve({ data: [], error: null })
  })
}) as any;

const projectDir = 'c:/Users/sreev/kaeo';
const files = ['statement_hdfc.xlsx', 'statement_messy.xlsx', 'kaeo_stress_test_v2.xlsx'];

async function testDedup() {
  for (const filename of files) {
    const filePath = path.join(projectDir, 'test-data/regression', filename);
    if (!fs.existsSync(filePath)) continue;

    const xlsxObj = ((XLSX as any).default || XLSX) as typeof XLSX;
    const workbook = xlsxObj.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const displayGrid = xlsxObj.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: null });
    const rawGrid = xlsxObj.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null });

    const headerDetect = detectHeaderRow(displayGrid);
    const headers = headerDetect.headers;
    const dataGrid = rawGrid.slice(headerDetect.headerRowIndex + 1);
    
    const mappedRows = dataGrid.map((row: any) => {
      const obj: any = {};
      headers.forEach((h, cIdx) => {
        obj[h] = row[cIdx] !== undefined ? row[cIdx] : null;
      });
      return obj;
    });

    const mappingResult = suggestMappingFromColumns(headers);
    const normResult = normalizeIngestedRows(mappedRows, mappingResult.mapping, {
      provider: 'Bank Statement',
      currency: 'INR'
    });

    console.log(`\n=========================================`);
    console.log(`Analyzing duplicates in ${filename}:`);
    console.log(`-----------------------------------------`);
    
    const dupReport = await checkDuplicateTransactions('test-client-123', normResult.transactions);
    console.log(`Total: ${dupReport.totalIncoming} | Clean: ${dupReport.importableCount} | Duplicates: ${dupReport.intraFileDuplicates}`);
  }
}

testDedup().catch(console.error);
