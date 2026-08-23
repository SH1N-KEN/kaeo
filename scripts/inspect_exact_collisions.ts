import * as XLSX from 'xlsx';
import { detectHeaderRow, filterMessyRows } from '../src/lib/ingestion/headerDetector';
import { suggestMappingFromColumns } from '../src/lib/mappingEngine';
import { mergeContinuationRows } from '../src/lib/ingestion/continuationMerger';
import { normalizeIngestedRows } from '../src/lib/ingestion/transactionNormalizer';
import { checkDuplicateTransactions } from '../src/lib/ingestion/duplicateEngine';

async function run() {
  const filePath = 'c:/Users/sreev/kaeo/test-data/regression/statement_messy.xlsx';
  const xlsxObj = (XLSX as any).default || XLSX;
  const workbook = xlsxObj.readFile(filePath, { cellDates: true });
  const sheetName = 'Account Statement';
  const sheet = workbook.Sheets[sheetName];

  const displayGrid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: null });
  const rawGrid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null });

  const headerDetect = detectHeaderRow(displayGrid);
  const dataGrid = rawGrid.slice(headerDetect.headerRowIndex + 1);

  // Mapped rows with Excel Row numbers (1-indexed)
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
    obj._excelRowNumber = idx + 2; // Row 0 is header, so row index 0 is Excel row 2
    return obj;
  });

  const { cleanRows: filteredRows } = filterMessyRows(mappedRows, headerDetect.headers);
  const mappingResult = suggestMappingFromColumns(headerDetect.headers);
  const { cleanRows: mergedRows } = mergeContinuationRows(filteredRows, mappingResult.mapping, headerDetect.headers);
  
  const norm = normalizeIngestedRows(mergedRows, mappingResult.mapping, {
    provider: 'Generic Finance File',
    currency: 'INR'
  });

  // Let's run a modified version of checkDuplicateTransactions to trace the matching pairs
  const seenTransactions: Record<string, any> = {}; // reference -> transaction object
  const targetIndices = [59, 86, 123, 133, 165]; // 1-based indices in normalized list

  console.log('Tracing deduplication collisions:');

  norm.transactions.forEach((tx, idx) => {
    const txIndex1Based = idx + 1;
    const ref = tx.reference;

    // Find the raw row in mappedRows that matches this transaction
    const matchedMappedRow = mappedRows.find(r => r._excelRowNumber === tx._excelRowNumber);
    const rawRef = matchedMappedRow ? matchedMappedRow['Ref'] : null;

    if (ref && ref !== 'null' && ref !== '') {
      if (seenTransactions[ref]) {
        // Duplicate collision!
        const originalTx = seenTransactions[ref];
        const originalMappedRow = mappedRows.find(r => r._excelRowNumber === originalTx._excelRowNumber);
        const originalRawRef = originalMappedRow ? originalMappedRow['Ref'] : null;

        if (targetIndices.includes(txIndex1Based)) {
          console.log(`\n=====================================================`);
          console.log(`💥 COLLISION AT INDEX ${txIndex1Based} (Excel Row ${tx._excelRowNumber})`);
          console.log(`- Extracted Reference: "${ref}"`);
          console.log(`\n[DROPPED TRANSACTION (Index ${txIndex1Based})]`);
          console.log(`  - Excel Row: ${tx._excelRowNumber}`);
          console.log(`  - Date: ${tx.transaction_date}`);
          console.log(`  - Narration: "${tx.description}"`);
          console.log(`  - Amount: ${tx.amount}`);
          console.log(`  - Literal "Ref" cell value in Excel: "${rawRef}"`);

          console.log(`\n[KEPT TRANSACTION (Index ${originalTx._index1Based})]`);
          console.log(`  - Excel Row: ${originalTx._excelRowNumber}`);
          console.log(`  - Date: ${originalTx.transaction_date}`);
          console.log(`  - Narration: "${originalTx.description}"`);
          console.log(`  - Amount: ${originalTx.amount}`);
          console.log(`  - Literal "Ref" cell value in Excel: "${originalRawRef}"`);
        }
      } else {
        tx._index1Based = txIndex1Based;
        seenTransactions[ref] = tx;
      }
    }
  });
}

run().catch(console.error);
