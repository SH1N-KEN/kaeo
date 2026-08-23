import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

// 1. Mock Supabase before importing any ingestion module
import { supabase } from '../src/lib/supabase';
const mockSelect = () => ({
  eq: () => Promise.resolve({ data: [], error: null })
});
supabase.from = (() => ({
  select: mockSelect
})) as any;

// 2. Now import the ingestion/parsing modules
import { detectHeaderRow, filterMessyRows } from '../src/lib/ingestion/headerDetector';
import { suggestMappingFromColumns } from '../src/lib/mappingEngine';
import { normalizeIngestedRows } from '../src/lib/ingestion/transactionNormalizer';
import { checkDuplicateTransactions } from '../src/lib/ingestion/duplicateEngine';
import { mergeContinuationRows } from '../src/lib/ingestion/continuationMerger';

const projectDir = 'c:/Users/sreev/kaeo';
const expectedJsonPath = path.join(projectDir, 'test-data/regression/expected.json');
const expected = JSON.parse(fs.readFileSync(expectedJsonPath, 'utf8'));

let overallPassed = true;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
  } else {
    console.log(`❌ FAIL: ${message}`);
    failCount++;
    overallPassed = false;
  }
}

async function runRegressionTests() {
  console.log('🧪 Starting Rebuilt Ingestion System Regression Tests...');
  console.log('=====================================================');

  for (const filename of Object.keys(expected)) {
    const fileExpectations = expected[filename];
    const filePath = path.join(projectDir, 'test-data/regression', filename);

    if (!fs.existsSync(filePath)) {
      console.error(`Fixture file not found: ${filePath}`);
      process.exit(1);
    }

    const xlsxObj = (XLSX as any).default || XLSX;
    const workbook = xlsxObj.readFile(filePath, { cellDates: true });
    const sheetName = fileExpectations.sheetName;
    const sheet = workbook.Sheets[sheetName];
    
    assert(!!sheet, `Sheet "${sheetName}" exists in ${filename}`);
    if (!sheet) continue;

    // Convert twice: once for headers, once for raw numbers
    const displayGrid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: null });
    const rawGrid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null });

    // Step A: Header row detection
    const headerDetect = detectHeaderRow(displayGrid);
    console.log(`\nAnalyzing ${filename} - Sheet: "${sheetName}"`);
    console.log(`- Header row index detected: ${headerDetect.headerRowIndex}`);
    console.log(`- Skipped metadata rows count: ${headerDetect.skippedRowCount}`);

    // Map rows based on detected headers
    const headers = headerDetect.headers;
    const dataGrid = rawGrid.slice(headerDetect.headerRowIndex + 1);
    const mappedRows = dataGrid.map((row) => {
      const obj: any = {};
      headers.forEach((h, cIdx) => {
        obj[h] = row[cIdx] !== undefined ? row[cIdx] : null;
      });
      return obj;
    });

    // Step B: Filter messy rows
    const { cleanRows: filteredRows, skippedCount: filterSkipped } = filterMessyRows(mappedRows, headers);
    console.log(`- Filtered rows: ${filteredRows.length} remaining, ${filterSkipped} skipped`);

    // Step C: Suggest mapping
    const mappingResult = suggestMappingFromColumns(headers);

    // Step D: Merge continuation rows (general rule)
    const { cleanRows: mergedRows, mergedCount } = mergeContinuationRows(filteredRows, mappingResult.mapping, headers);
    console.log(`- Continuation merger: merged ${mergedCount} rows, ${mergedRows.length} transactions remaining`);

    // Step E: Normalization
    const provider = filename.includes('hdfc') ? 'Bank Statement' : 'Generic Finance File';
    const context = {
      provider,
      currency: 'INR'
    };
    const normResult = normalizeIngestedRows(mergedRows, mappingResult.mapping, context);
    console.log(`- Normalizer: ${normResult.transactions.length} transactions normalized`);

    // Step F: Deduplication
    const clientId = 'client-regression-123';
    const dedupResult = await checkDuplicateTransactions(clientId, normResult.transactions);
    console.log(`- Deduplication: ${dedupResult.cleanTransactions.length} clean, ${dedupResult.intraFileDuplicates} intra-file duplicates, ${dedupResult.dbDuplicates} db duplicates`);

    // --- Ground Truth Assertions ---
    const cleanTxs = dedupResult.cleanTransactions;
    const totalTransactions = cleanTxs.length;

    let totalInflow = 0;
    let totalOutflow = 0;
    cleanTxs.forEach((tx: any) => {
      if (tx.amount > 0) totalInflow += tx.amount;
      else totalOutflow += Math.abs(tx.amount);
    });

    totalInflow = Math.round(totalInflow * 100) / 100;
    totalOutflow = Math.round(totalOutflow * 100) / 100;
    const netMovement = Math.round((totalInflow - totalOutflow) * 100) / 100;

    assert(
      totalTransactions === fileExpectations.totalTransactions,
      `${filename} totalTransactions count is ${totalTransactions} (expected ${fileExpectations.totalTransactions})`
    );
    assert(
      totalInflow === fileExpectations.totalInflow,
      `${filename} totalInflow is ${totalInflow} (expected ${fileExpectations.totalInflow})`
    );
    assert(
      totalOutflow === fileExpectations.totalOutflow,
      `${filename} totalOutflow is ${totalOutflow} (expected ${fileExpectations.totalOutflow})`
    );
    assert(
      netMovement === fileExpectations.netMovement,
      `${filename} netMovement is ${netMovement} (expected ${fileExpectations.netMovement})`
    );

    if (fileExpectations.intraFileDuplicates !== undefined) {
      assert(
        dedupResult.intraFileDuplicates === fileExpectations.intraFileDuplicates,
        `${filename} intraFileDuplicates is ${dedupResult.intraFileDuplicates} (expected ${fileExpectations.intraFileDuplicates})`
      );
    }

    // Verify skipped summary rows
    if (fileExpectations.skippedSummaryRows) {
      fileExpectations.skippedSummaryRows.forEach((rowName: string) => {
        const found = cleanTxs.some((tx: any) => tx.description.toLowerCase().includes(rowName.toLowerCase()));
        assert(!found, `${filename} does not contain summary row "${rowName}"`);
      });
    }
  }

  console.log('=====================================================');
  if (overallPassed) {
    console.log('🎉 REGRESSION RUNNER PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.log(`❌ REGRESSION RUNNER FAILED WITH ${failCount} FAILURES.`);
    process.exit(1);
  }
}

runRegressionTests().catch((err) => {
  console.error('Fatal error in regression runner:', err);
  process.exit(1);
});
