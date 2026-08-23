import * as XLSX from 'xlsx';
import { detectHeaderRow, filterMessyRows } from '../src/lib/ingestion/headerDetector';
import { suggestMappingFromColumns } from '../src/lib/mappingEngine';
import { mergeContinuationRows } from '../src/lib/ingestion/continuationMerger';
import { normalizeIngestedRows } from '../src/lib/ingestion/transactionNormalizer';
import { checkDuplicateTransactions } from '../src/lib/ingestion/duplicateEngine';
import { isValidReference } from '../src/lib/ingestion/referenceValidator';

async function run() {
  const filePath = 'c:/Users/sreev/kaeo/test-data/regression/statement_messy.xlsx';
  const xlsxObj = (XLSX as any).default || XLSX;
  const workbook = xlsxObj.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets['Account Statement'];

  const displayGrid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: null });
  const rawGrid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null });

  const headerDetect = detectHeaderRow(displayGrid);
  const dataGrid = rawGrid.slice(headerDetect.headerRowIndex + 1);
  const mappedRows = dataGrid.map((row, idx) => {
    const obj: any = {};
    headerDetect.headers.forEach((h, cIdx) => {
      let cellVal = row[cIdx];
      if (cellVal instanceof Date) {
        const adjusted = new Date(cellVal.getTime() - cellVal.getTimezoneOffset() * 60000);
        cellVal = adjusted.toISOString().split('T')[0];
      }
      obj[h] = cellVal !== undefined ? cellVal : null;
    });
    obj._excelRowNumber = idx + 2;
    return obj;
  });

  const { cleanRows: filteredRows } = filterMessyRows(mappedRows, headerDetect.headers);
  const mappingResult = suggestMappingFromColumns(headerDetect.headers);
  const { cleanRows: mergedRows } = mergeContinuationRows(filteredRows, mappingResult.mapping, headerDetect.headers);
  
  const norm = normalizeIngestedRows(mergedRows, mappingResult.mapping, {
    provider: 'Generic Finance File',
    currency: 'INR'
  });

  console.log('Searching for Zoho transactions...');
  norm.transactions.forEach((tx, idx) => {
    if (tx.description.toUpperCase().includes('ZOHO PRIVATE LIMITED-HDFCBANK-78139') || tx.description.toUpperCase().includes('ZOHO')) {
      const matchedRow = mappedRows.find(r => r._excelRowNumber === tx._excelRowNumber);
      const rawRef = matchedRow ? matchedRow['Ref'] : null;

      console.log(`\n[Tx ${idx + 1}] (Excel Row ${tx._excelRowNumber}):`);
      console.log(`- Date: ${tx.transaction_date}`);
      console.log(`- Narration: "${tx.description}"`);
      console.log(`- Amount: ${tx.amount}`);
      console.log(`- Extracted Reference: "${tx.reference}"`);
      console.log(`- Is Valid Ref: ${isValidReference(tx.reference)}`);
      console.log(`- Literal "Ref" cell value: "${rawRef}"`);
      
      const dateStr = tx.transaction_date ? new Date(tx.transaction_date).toISOString() : '';
      const signature = `${dateStr}|${tx.amount}|${String(tx.description || '').trim().toLowerCase()}|${tx.type || ''}`;
      console.log(`- Deduplication Signature: "${signature}"`);
    }
  });
}

run().catch(console.error);
