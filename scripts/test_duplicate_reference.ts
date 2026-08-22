import { supabase } from '../src/lib/supabase';
import { checkDuplicateTransactions, generateFingerprint } from '../src/lib/ingestion/duplicateEngine';
import { parseIngestedDate } from '../src/lib/ingestion/transactionNormalizer';

// 1. Mock database records
const mockDbTransactions: any[] = [];

// Intercept supabase.from calls to return mock records
supabase.from = (table: string) => {
  return {
    select: (columns: string) => {
      return {
        eq: (colName: string, val: any) => {
          return Promise.resolve({
            data: mockDbTransactions,
            error: null
          });
        }
      } as any;
    }
  } as any;
};

async function runTests() {
  console.log('🧪 Starting Bank Ingestion & Deduplication Tests...');
  console.log('==================================================');

  let failCount = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.log(`❌ FAIL: ${message}`);
      failCount++;
    }
  }

  // --- TEST CASE 1: Date Parsing Timezone Offset Shifts ---
  console.log('\n--- Test Case 1: Date parsing (UTC Midnight consistency) ---');
  
  // ISO-like YYYY-MM-DD
  const dateISO = parseIngestedDate('2026-02-07');
  assert(
    dateISO.date.toISOString() === '2026-02-07T00:00:00.000Z',
    `parseIngestedDate("2026-02-07") returns UTC midnight: ${dateISO.date.toISOString()}`
  );

  // Indian DD/MM/YYYY
  const dateIndian = parseIngestedDate('07/02/2026');
  assert(
    dateIndian.date.toISOString() === '2026-02-07T00:00:00.000Z',
    `parseIngestedDate("07/02/2026") returns UTC midnight: ${dateIndian.date.toISOString()}`
  );

  // Word Month
  const dateWord = parseIngestedDate('07 Feb 2026');
  assert(
    dateWord.date.toISOString() === '2026-02-07T00:00:00.000Z',
    `parseIngestedDate("07 Feb 2026") returns UTC midnight: ${dateWord.date.toISOString()}`
  );

  // --- TEST CASE 2: Legitimate duplicates with same details but different reference numbers ---
  console.log('\n--- Test Case 2: Same date/amount/narration, different reference numbers ---');
  
  const clientId = 'client_123';
  const incomingTxs = [
    {
      transaction_date: '2026-02-07T00:00:00.000Z',
      amount: -150.00,
      description: 'Google Ads',
      reference: 'REF_A'
    },
    {
      transaction_date: '2026-02-07T00:00:00.000Z',
      amount: -150.00,
      description: 'Google Ads',
      reference: 'REF_B' // Different reference
    }
  ];

  mockDbTransactions.length = 0; // Empty DB

  const report1 = await checkDuplicateTransactions(clientId, incomingTxs);
  assert(report1.totalIncoming === 2, '2 incoming transactions');
  assert(report1.intraFileDuplicates === 0, 'No intra-file duplicates (different reference numbers)');
  assert(report1.dbDuplicates === 0, 'No DB duplicates');
  assert(report1.importableCount === 2, 'Both transactions show up!');

  // --- TEST CASE 3: Actual intra-file duplicates ---
  console.log('\n--- Test Case 3: Actual duplicate in upload (same reference number) ---');
  
  const incomingWithDuplicate = [
    ...incomingTxs,
    {
      transaction_date: '2026-02-07T00:00:00.000Z',
      amount: -150.00,
      description: 'Google Ads',
      reference: 'REF_A' // Duplicate reference
    }
  ];

  const report2 = await checkDuplicateTransactions(clientId, incomingWithDuplicate);
  assert(report2.totalIncoming === 3, '3 incoming transactions');
  assert(report2.intraFileDuplicates === 1, '1 intra-file duplicate detected');
  assert(report2.importableCount === 2, 'Only 2 clean transactions importable');

  // --- TEST CASE 4: DB duplicate detection ---
  console.log('\n--- Test Case 4: Match against existing DB transactions ---');
  
  // Seed the DB mock with REF_A
  mockDbTransactions.push({
    reference: 'REF_A',
    source_row_hash: `${clientId}_ref_ref_a`,
    transaction_date: '2026-02-07T00:00:00.000Z',
    amount: -150.00,
    description: 'Google Ads'
  });

  const report3 = await checkDuplicateTransactions(clientId, incomingTxs);
  assert(report3.totalIncoming === 2, '2 incoming transactions');
  assert(report3.dbDuplicates === 1, '1 DB duplicate detected (REF_A already in DB)');
  assert(report3.importableCount === 1, 'Only 1 clean transaction importable (REF_B)');
  assert(report3.cleanTransactions[0].reference === 'REF_B', 'Importable transaction is REF_B');

  // --- TEST CASE 5: Missing reference numbers ---
  console.log('\n--- Test Case 5: Missing reference numbers (flagged for review, no auto-dedupe) ---');

  const incomingNoRef = [
    {
      transaction_date: '2026-02-07T00:00:00.000Z',
      amount: -150.00,
      description: 'Google Ads',
      reference: null // Missing reference
    },
    {
      transaction_date: '2026-02-07T00:00:00.000Z',
      amount: -150.00,
      description: 'Google Ads',
      reference: undefined // Missing reference
    }
  ];

  mockDbTransactions.length = 0; // Empty DB

  const report4 = await checkDuplicateTransactions(clientId, incomingNoRef);
  assert(report4.totalIncoming === 2, '2 incoming transactions');
  assert(report4.intraFileDuplicates === 0, 'No intra-file duplicates checked');
  assert(report4.importableCount === 2, 'Both transactions are preserved');
  assert(
    report4.cleanTransactions.every(tx => tx.review_status === 'needs_review'),
    'Both transactions are flagged for manual review (review_status = "needs_review")'
  );

  // --- TEST CASE 6: Reference numbers with value 0 ---
  console.log('\n--- Test Case 6: Reference = 0 (numeric) placeholder check ---');

  const incomingZeroRef = [
    {
      transaction_date: '2026-02-07T00:00:00.000Z',
      amount: -150.00,
      description: 'Google Ads',
      reference: 0 // Numeric 0
    },
    {
      transaction_date: '2026-02-07T00:00:00.000Z',
      amount: -150.00,
      description: 'Google Ads',
      reference: 0 // Same numeric 0, should not deduplicate against first one
    }
  ];

  mockDbTransactions.length = 0; // Empty DB

  const report5 = await checkDuplicateTransactions(clientId, incomingZeroRef);
  assert(report5.totalIncoming === 2, '2 incoming transactions with reference=0');
  assert(report5.intraFileDuplicates === 0, 'No intra-file duplicates checked for 0 reference');
  assert(report5.importableCount === 2, 'Both reference=0 transactions are preserved');
  assert(
    report5.cleanTransactions.every(tx => tx.review_status === 'needs_review'),
    'Both reference=0 transactions are flagged for manual review (review_status = "needs_review")'
  );

  console.log('\n==================================================');
  if (failCount === 0) {
    console.log('🟢 All tests passed successfully!');
    process.exit(0);
  } else {
    console.log(`🔴 Tests failed: ${failCount} assertions failed.`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('💥 Test run crashed:', err);
  process.exit(1);
});
