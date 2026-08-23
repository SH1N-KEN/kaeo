import * as XLSX from 'xlsx';
import { detectHeaderRow, filterMessyRows } from '../src/lib/ingestion/headerDetector';
import { suggestMappingFromColumns } from '../src/lib/mappingEngine';
import { mergeContinuationRows } from '../src/lib/ingestion/continuationMerger';
import { normalizeIngestedRows } from '../src/lib/ingestion/transactionNormalizer';

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

  // Mapped rows with raw indexes (0-indexed relative to row 1 on Excel sheet, i.e., Excel row number = rawIndex + 2)
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
    // Store Excel Row number (1-indexed)
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

  // Let's print the details of the target rows.
  // The rows dropped were: Excel row numbers 59, 86, 123, 133, 165
  // Note: the logs reported "Dropped row 59...". Let's print their normalized transaction details.
  const targetExcelRows = [59, 86, 123, 133, 165];

  console.log('Normalized transactions count:', norm.transactions.length);
  
  norm.transactions.forEach((tx) => {
    // Look at mapped row representation of this transaction
    const excelRow = tx._excelRowNumber; 
    // Wait, let's see if the normalizer stored the source row information
    // If not, we can find the matching raw row using description/amount/date
  });

  // Since we want to examine how checkDuplicateTransactions processed them:
  // Let's inspect the actual raw cells in Excel for those exact Excel row numbers:
  // Note: Excel row 59 is rawGrid[58] (0-indexed).
  console.log('\n--- Raw Excel Cell Values for target rows ---');
  targetExcelRows.forEach((rowNum) => {
    const rawIdx = rowNum - 1;
    console.log(`\n[Excel Row ${rowNum}]`);
    console.log(`Raw Grid Row:`, JSON.stringify(rawGrid[rawIdx]));
  });

  // Let's print the normalized transactions matching these rows
  console.log('\n--- Normalized Transactions for target rows ---');
  norm.transactions.forEach((tx, idx) => {
    const rawRowStr = JSON.stringify(tx);
    const hasTargetDesc = targetExcelRows.some(rowNum => {
      const rawIdx = rowNum - 1;
      const desc = String(rawGrid[rawIdx]?.[1] || '');
      return tx.description === desc;
    });
    // Let's just print transactions that match description/amount/date
    targetExcelRows.forEach(rowNum => {
      const rawIdx = rowNum - 1;
      const rawRow = rawGrid[rawIdx];
      if (!rawRow) return;
      const rawDesc = String(rawRow[1] || '');
      // Match by description prefix or content
      if (tx.description.includes(rawDesc.slice(0, 30))) {
        console.log(`[Matched Normalizer Index ${idx}] (Target Row ${rowNum}):`);
        console.log(`- Date: ${tx.transaction_date}`);
        console.log(`- Narration: "${tx.description}"`);
        console.log(`- Amount: ${tx.amount}`);
        console.log(`- Extracted Reference: "${tx.reference}"`);
        console.log(`- Metadata:`, JSON.stringify(tx.metadata));
      }
    });
  });
}

run().catch(console.error);
