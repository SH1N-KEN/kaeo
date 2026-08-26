import * as fs from 'fs';
import * as path from 'path';

// Polyfill FileReader for PapaParse in Node.js environment
class MockFileReader {
  onload: any;
  onerror: any;
  readAsText(file: any) {
    file.text().then((text: string) => {
      if (this.onload) {
        this.onload({
          target: {
            result: text
          }
        });
      }
    }).catch((err: any) => {
      if (this.onerror) {
        this.onerror(err);
      }
    });
  }
}
(globalThis as any).FileReader = MockFileReader;

// Ingest / parse imports
import { parseFinancialFile } from '../src/lib/fileParser';
import { normalizeIngestedRows } from '../src/lib/ingestion/transactionNormalizer';

// Reconciliation engine / report imports
import { reconcileTransactions } from '../src/lib/reconciliation/reconciliationEngine';
import { formatReconciliationReport } from '../src/lib/reconciliation/reconciliationReport';

const projectDir = 'c:/Users/sreev/kaeo';

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
  } else {
    console.log(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

async function runRealReconciliationTest() {
  console.log('🧪 Starting Real Reconciliation Test with CSV Data...');
  console.log('=====================================================');

  const bankPath = path.join(projectDir, 'test-data/reconciliation/bank_statement.csv');
  const stripePath = path.join(projectDir, 'test-data/reconciliation/stripe_export.csv');

  if (!fs.existsSync(bankPath) || !fs.existsSync(stripePath)) {
    console.error('CSV data files do not exist!');
    process.exit(1);
  }

  const bankContent = fs.readFileSync(bankPath, 'utf8');
  const stripeContent = fs.readFileSync(stripePath, 'utf8');

  // Create simulated browser File objects
  const bankFile = new File([bankContent], 'bank_statement.csv', { type: 'text/csv' });
  const stripeFile = new File([stripeContent], 'stripe_export.csv', { type: 'text/csv' });

  // 1. Parse both CSV files using Kaeo parsers
  console.log('Parsing files...');
  const bankParsed = await parseFinancialFile(bankFile);
  const stripeParsed = await parseFinancialFile(stripeFile);

  // Normalize rows to standard schema
  console.log('Normalizing parsed rows...');
  const bankNorm = normalizeIngestedRows(
    bankParsed.allRows,
    bankParsed.suggestedMapping,
    { provider: bankParsed.provider, currency: 'INR' }
  );

  const stripeNorm = normalizeIngestedRows(
    stripeParsed.allRows,
    stripeParsed.suggestedMapping,
    { provider: stripeParsed.provider, currency: 'INR' }
  );

  // Filter out bank interest (non-operating line item) to focus matching on operating items
  const operatingBankTxns = bankNorm.transactions.filter(t => 
    !t.description.toLowerCase().includes('interest')
  );

  // 2. Call reconcileTransactions
  console.log('Running reconciliation engine...');
  const report = reconcileTransactions(operatingBankTxns, stripeNorm.transactions);

  // 3. Call formatReconciliationReport
  const formattedReport = formatReconciliationReport(report);

  // 4. Log the output
  console.log('\nGenerated Report:');
  console.log('-----------------');
  console.log(formattedReport);
  console.log('-----------------\n');

  // 5. Assert expected results
  console.log('Verifying assertions...');
  
  // Total bank (raw CSV rows excluding headers)
  assert(bankParsed.rowCount === 7, `Total bank rows is 7 (actual: ${bankParsed.rowCount})`);
  
  // Total stripe (raw CSV rows excluding headers)
  assert(stripeParsed.rowCount === 4, `Total stripe rows is 4 (actual: ${stripeParsed.rowCount})`);
  
  // Matched matches
  assert(report.summary.matchedBankTxnsCount === 2, `Matched Pairs is 2 (actual: ${report.summary.matchedBankTxnsCount})`);
  
  // Unmatched stripe
  assert(report.summary.unmatchedStripeTxnsCount === 2, `Unmatched Stripe is 2 (actual: ${report.summary.unmatchedStripeTxnsCount})`);
  
  // Unmatched bank (operating bank txns: AWS, PayPal, Self Transfer)
  assert(report.summary.unmatchedBankTxnsCount === 3, `Unmatched Bank is 3 (actual: ${report.summary.unmatchedBankTxnsCount})`);
  
  // Match rate
  assert(report.summary.matchRate === 50, `Match rate is 50% (actual: ${report.summary.matchRate}%)`);

  // Verify match details (Acme and Razorpay)
  const acmeMatch = report.matches.find(m => m.stripeTxn.description.includes('Acme'));
  assert(!!acmeMatch, 'Acme matches successfully');
  assert(acmeMatch!.matchConfidence >= 95, `Acme match confidence is 95+ (actual: ${acmeMatch?.matchConfidence})`);

  const razorpayMatch = report.matches.find(m => m.bankTxn.description.includes('RAZORPAY'));
  assert(!!razorpayMatch, 'Razorpay matches successfully');
  assert(razorpayMatch!.matchConfidence >= 90, `Razorpay match confidence is 90+ (actual: ${razorpayMatch?.matchConfidence})`);

  console.log('\n🎉 All tests passed successfully!');
}

runRealReconciliationTest().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
