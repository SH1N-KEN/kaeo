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

import { parseFinancialFile } from '../src/lib/fileParser';
import { normalizeIngestedRows } from '../src/lib/ingestion/transactionNormalizer';
import { reconcileTransactionsPipeline } from '../src/lib/reconciliation/reconciliationEngine';

const projectDir = 'c:/Users/sreev/kaeo';

async function verifySemantics() {
  console.log('🧪 Starting Reconciliation Semantics Validation...');
  console.log('=====================================================');

  const bankPath = path.join(projectDir, 'test-data/reconciliation/bank_statement.csv');
  const stripePath = path.join(projectDir, 'test-data/reconciliation/stripe_export.csv');

  if (!fs.existsSync(bankPath) || !fs.existsSync(stripePath)) {
    console.error('CSV data files do not exist!');
    process.exit(1);
  }

  const bankContent = fs.readFileSync(bankPath, 'utf8');
  const stripeContent = fs.readFileSync(stripePath, 'utf8');

  const bankFile = new File([bankContent], 'bank_statement.csv', { type: 'text/csv' });
  const stripeFile = new File([stripeContent], 'stripe_export.csv', { type: 'text/csv' });

  console.log('Parsing files...');
  const bankParsed = await parseFinancialFile(bankFile);
  const stripeParsed = await parseFinancialFile(stripeFile);

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

  console.log('Running reconcileTransactionsPipeline...');
  const result = await reconcileTransactionsPipeline(bankNorm.transactions, stripeNorm.transactions);

  console.log('\n=====================================================');
  console.log('RECONCILIATION PIPELINE SUMMARY:');
  console.log('-----------------------------------------------------');
  console.log(`Reconciled Value:         ₹${result.summary.reconciledValue.toLocaleString()}`);
  console.log(`Eligible Settlements:     ${result.summary.eligibleProcessorRecords} / ${result.summary.totalProcessorRecords}`);
  console.log(`Unresolved Discrepancies:  ₹${result.summary.difference.toLocaleString()}`);
  console.log(`Reconciliation Rate:      ${result.summary.matchRate.toFixed(2)}%`);
  console.log(`Matched Count:            ${result.summary.matchedCount}`);
  console.log(`Review Count:             ${result.summary.reviewCount}`);
  console.log(`Unresolved Count:         ${result.summary.unresolvedCount}`);
  console.log(`Pending / Excluded Count: ${result.summary.pendingCount}`);
  console.log(`Duplicate Count:          ${result.summary.duplicateCount}`);
  console.log(`Out of Scope Bank Count:  ${result.summary.outOfScopeCount}`);

  console.log('\n=====================================================');
  console.log('DISPOSITION OF PROCESSOR RECORDS:');
  console.log('-----------------------------------------------------');
  result.results.forEach((res, i) => {
    const proc = res.processorRecord.transaction;
    const bank = res.bankRecord?.transaction;
    
    console.log(`[Record #${i + 1}] Status: ${res.decision.status} | Reason: ${res.decision.reason}`);
    console.log(`  Processor: ${proc.description} | ₹${proc.amount} | Date: ${proc.transaction_date}`);
    if (bank) {
      console.log(`  Bank:      ${bank.description} | ₹${bank.amount} | Date: ${bank.transaction_date}`);
      console.log(`  Evidence:  Confidence: ${res.decision.evidence.confidenceScore}% | Amount Exact: ${res.decision.evidence.amountExact}`);
    } else {
      console.log(`  Bank:      (No matched ledger item)`);
    }
    console.log('  Audit Log:');
    res.auditTrail.forEach(log => console.log(`    - ${log}`));
    console.log('-----------------------------------------------------');
  });

  console.log('\n=====================================================');
  console.log('DISPOSITION OF OUT-OF-SCOPE BANK RECORDS:');
  console.log('-----------------------------------------------------');
  result.outOfScopeBankTxns.forEach((txn, i) => {
    console.log(`[Bank Out-of-Scope #${i + 1}] ${txn.description} | ₹${txn.amount} | Date: ${txn.transaction_date}`);
  });
  
  console.log('=====================================================');
  console.log('Validation complete.');
}

verifySemantics().catch(err => {
  console.error('❌ Validation failed:', err);
  process.exit(1);
});
