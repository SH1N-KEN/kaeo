import { parseIngestedDate, cleanAmount } from '../src/lib/ingestion/transactionNormalizer';
import { detectHeaderRow, filterMessyRows } from '../src/lib/ingestion/headerDetector';
import { detectProvider } from '../src/lib/fileParser';

async function runTests() {
  console.log('🧪 Starting Bulletproof Parsing Stress Tests...');
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

  // --- Date Parsing Stress Tests ---
  console.log('\n--- 1. Date Parsing Stress Tests ---');

  // Delimiter tests
  assert(
    parseIngestedDate('07/02/2026').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'Standard slash delimiter: 07/02/2026'
  );
  assert(
    parseIngestedDate('07-02-2026').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'Standard dash delimiter: 07-02-2026'
  );
  assert(
    parseIngestedDate('07.02.2026').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'Indian dot delimiter: 07.02.2026'
  );
  assert(
    parseIngestedDate('07 02 2026').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'Space delimiter: 07 02 2026'
  );

  // Weekday prefixes
  assert(
    parseIngestedDate('Monday, 07.02.2026').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'Weekday prefix with comma: Monday, 07.02.2026'
  );
  assert(
    parseIngestedDate('Mon 07/02/26').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'Abbreviated weekday prefix, 2-digit year: Mon 07/02/26'
  );

  // ISO variants
  assert(
    parseIngestedDate('2026.02.07').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'ISO dot delimiter: 2026.02.07'
  );
  assert(
    parseIngestedDate('2026/02/07').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'ISO slash delimiter: 2026/02/07'
  );

  // Ambiguity resolution
  assert(
    parseIngestedDate('07/07/2026').ambiguous === false,
    'No ambiguity when day equals month: 07/07/2026'
  );
  assert(
    parseIngestedDate('05/06/2026').ambiguous === true,
    'Ambiguous flag set when day != month and both <= 12'
  );

  // Word month variations
  assert(
    parseIngestedDate('07-Feb-2026').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'Word month with dash: 07-Feb-2026'
  );
  assert(
    parseIngestedDate('07 Feb. 2026').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'Word month with dot abbreviation: 07 Feb. 2026'
  );
  
  // Word month first (US / narrative style)
  assert(
    parseIngestedDate('Feb 7, 2026').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'Word month first: Feb 7, 2026'
  );
  assert(
    parseIngestedDate('February 7th, 2026').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'Full word month first with ordinal suffix: February 7th, 2026'
  );
  assert(
    parseIngestedDate('Feb. 7, 26').date.toISOString() === '2026-02-07T00:00:00.000Z',
    'Abbrev word month first, 2-digit year: Feb. 7, 26'
  );


  // --- Amount Parsing Stress Tests ---
  console.log('\n--- 2. Amount Parsing Stress Tests ---');

  // Trailing minus
  assert(
    cleanAmount('120.00-').amount === -120.00,
    'Trailing minus amount: 120.00-'
  );
  assert(
    cleanAmount('₹1,200.50-').amount === -1200.50,
    'Trailing minus with currency and comma: ₹1,200.50-'
  );

  // Currency symbols and formatting
  assert(
    cleanAmount('₹ 1,200.50').amount === 1200.50,
    'Currency symbol with space and comma: ₹ 1,200.50'
  );
  assert(
    cleanAmount('$ -450.00').amount === -450.00,
    'Currency symbol with negative sign: $ -450.00'
  );
  assert(
    cleanAmount('(1,500.00)').amount === -1500.00,
    'Parentheses negative formatting: (1,500.00)'
  );

  // Suffixes
  assert(
    cleanAmount('150.00 dr').amount === -150.00,
    'Debit suffix: 150.00 dr'
  );
  assert(
    cleanAmount('250.00 credit').amount === 250.00,
    'Credit suffix: 250.00 credit'
  );


  // --- Header & Summary Detection Stress Tests ---
  console.log('\n--- 3. Header & Summary Detection Stress Tests ---');

  // Messy header names
  const messyHeaders = ['Tx Dt', 'Narration/Particulars', 'Dr.', 'Cr.', 'Closing Bal'];
  const detection = detectHeaderRow([messyHeaders]);
  assert(
    detection.headers.length === 5,
    'Messy headers detected successfully'
  );

  // Summary row skipping checks
  const validDescriptionRow = {
    'Date': '07.02.2026',
    'Narration': 'Total Gas Station payment',
    'Amount': '120.00',
    'Ref': 'UTR123'
  };
  const summaryRow = {
    'Date': '',
    'Narration': 'Total balance',
    'Amount': '5000.00',
    'Ref': ''
  };

  const filtered1 = filterMessyRows([validDescriptionRow], ['Date', 'Narration', 'Amount', 'Ref']);
  assert(
    filtered1.cleanRows.length === 1,
    'Do not skip normal transaction descriptions starting with Total'
  );

  const filtered2 = filterMessyRows([summaryRow], ['Date', 'Narration', 'Amount', 'Ref']);
  assert(
    filtered2.cleanRows.length === 0,
    'Correctly skip actual summary rows starting with Total'
  );


  // --- Provider Detection Stress Tests ---
  console.log('\n--- 4. Provider Detection Stress Tests ---');
  
  assert(
    detectProvider(['Date', 'Narration', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'], [], 'statement.xlsx').provider === 'Bank Statement',
    'Detect bank statement provider dynamically from headers'
  );

  console.log('\n==================================================');
  if (failCount === 0) {
    console.log('🎉 ALL STRESS TESTS PASSED SUCCESSFULLY! BULLETPROOF STATUS CONFIRMED!');
    process.exit(0);
  } else {
    console.log(`❌ ${failCount} TESTS FAILED. PLEASE REVIEW.`);
    process.exit(1);
  }
}

runTests();
