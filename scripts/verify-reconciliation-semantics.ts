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
  console.log('DISPOSITION OF RECONCILIATION RECORDS:');
  console.log('-----------------------------------------------------');
  const reconRecords = result.results.filter(r => r.decision.status !== 'OUT_OF_SCOPE');
  reconRecords.forEach((res, i) => {
    const proc = res.processorRecord.transaction;
    const bank = res.bankRecord?.transaction;
    
    console.log(`[Record #${i + 1}] Status: ${res.decision.status} | Reason: ${res.decision.reason}`);
    console.log(`  Processor: ${proc.description} | ₹${proc.amount} | Date: ${proc.transaction_date.slice(0,10)}`);
    if (bank) {
      console.log(`  Bank:      ${bank.description} | ₹${bank.amount} | Date: ${bank.transaction_date.slice(0,10)}`);
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
  const outOfScopeRecords = result.results.filter(r => r.decision.status === 'OUT_OF_SCOPE');
  outOfScopeRecords.forEach((res, i) => {
    const bank = res.bankRecord!.transaction;
    console.log(`[Bank Out-of-Scope #${i + 1}] ${bank.description} | ₹${bank.amount} | Date: ${bank.transaction_date.slice(0,10)}`);
  });
  
  console.log('=====================================================');
  console.log('Validation complete.');

  // Load and run the second fixture (recon_bank_statement.csv + recon_razorpay_export.csv)
  console.log('\n=====================================================');
  console.log('RUNNING REGRESSION TEST FOR HDFC & RAZORPAY FIXTURES:');
  console.log('-----------------------------------------------------');
  const reconBankPath = path.join(projectDir, 'test-data/reconciliation/recon_bank_statement.csv');
  const reconRazorpayPath = path.join(projectDir, 'test-data/reconciliation/recon_razorpay_export.csv');

  if (!fs.existsSync(reconBankPath) || !fs.existsSync(reconRazorpayPath)) {
    console.error('Razorpay CSV fixtures do not exist!');
    process.exit(1);
  }

  const reconBankContent = fs.readFileSync(reconBankPath, 'utf8');
  const reconRazorpayContent = fs.readFileSync(reconRazorpayPath, 'utf8');

  const reconBankFile = new File([reconBankContent], 'recon_bank_statement.csv', { type: 'text/csv' });
  const reconRazorpayFile = new File([reconRazorpayContent], 'recon_razorpay_export.csv', { type: 'text/csv' });

  const reconBankParsed = await parseFinancialFile(reconBankFile);
  const reconRazorpayParsed = await parseFinancialFile(reconRazorpayFile);

  const reconBankNorm = normalizeIngestedRows(
    reconBankParsed.allRows,
    reconBankParsed.suggestedMapping,
    { provider: reconBankParsed.provider, currency: 'INR' }
  );

  const reconRazorpayNorm = normalizeIngestedRows(
    reconRazorpayParsed.allRows,
    reconRazorpayParsed.suggestedMapping,
    { provider: reconRazorpayParsed.provider, currency: 'INR' }
  );

  console.log('Running reconcileTransactionsPipeline on Razorpay export...');
  const razorpayResult = await reconcileTransactionsPipeline(reconBankNorm.transactions, reconRazorpayNorm.transactions);

  console.log('RECONCILIATION PIPELINE SUMMARY (RAZORPAY):');
  console.log(`Reconciled Value:         ₹${razorpayResult.summary.reconciledValue.toLocaleString()}`);
  console.log(`Eligible Settlements:     ${razorpayResult.summary.eligibleProcessorRecords} / ${razorpayResult.summary.totalProcessorRecords}`);
  console.log(`Unresolved Discrepancies:  ₹${razorpayResult.summary.difference.toLocaleString()}`);
  console.log(`Reconciliation Rate:      ${razorpayResult.summary.matchRate.toFixed(2)}%`);
  console.log(`Matched Count:            ${razorpayResult.summary.matchedCount}`);
  console.log(`Review Count:             ${razorpayResult.summary.reviewCount}`);
  console.log(`Unresolved Count:         ${razorpayResult.summary.unresolvedCount}`);
  console.log(`Pending / Excluded Count: ${razorpayResult.summary.pendingCount}`);
  console.log(`Duplicate Count:          ${razorpayResult.summary.duplicateCount}`);
  console.log(`Out of Scope Bank Count:  ${razorpayResult.summary.outOfScopeCount}`);

  // Invariant validation checks:
  const summary = razorpayResult.summary;
  console.log('Verifying Razorpay/HDFC assertions...');
  if (summary.eligibleSettlementCount !== 6) {
    throw new Error(`Assertion failed: expected eligibleSettlementCount === 6, got ${summary.eligibleSettlementCount}`);
  }
  if (summary.matchedSettlementCount !== 5) {
    throw new Error(`Assertion failed: expected matchedSettlementCount === 5, got ${summary.matchedSettlementCount}`);
  }
  if (summary.unresolvedSettlementCount !== 1) {
    throw new Error(`Assertion failed: expected unresolvedSettlementCount === 1, got ${summary.unresolvedSettlementCount}`);
  }
  const expectedRate = (5 / 6) * 100;
  if (Math.abs(summary.matchRate - expectedRate) > 0.01) {
    throw new Error(`Assertion failed: expected matchRate === ${expectedRate}%, got ${summary.matchRate}%`);
  }
  if (summary.reconciledValue !== 377500) {
    throw new Error(`Assertion failed: expected reconciledValue === 377500, got ${summary.reconciledValue}`);
  }
  if (summary.unresolvedExposure !== 23500) {
    throw new Error(`Assertion failed: expected unresolvedExposure === 23500, got ${summary.unresolvedExposure}`);
  }
  if (summary.duplicateCount !== 1) {
    throw new Error(`Assertion failed: expected duplicateCount === 1, got ${summary.duplicateCount}`);
  }
  if (summary.outOfScopeBankCount !== 22) {
    throw new Error(`Assertion failed: expected outOfScopeBankCount === 22, got ${summary.outOfScopeBankCount}`);
  }

  // Assert Stripe bank credits are classified as OUT_OF_SCOPE with reason OTHER_PROCESSOR
  const stripeCredits = razorpayResult.results.filter(r => 
    r.bankRecord && 
    r.bankRecord.transaction.description.toLowerCase().includes('stripe')
  );
  if (stripeCredits.length !== 3) {
    throw new Error(`Assertion failed: expected 3 Stripe bank credits, got ${stripeCredits.length}`);
  }
  stripeCredits.forEach(r => {
    if (r.decision.status !== 'OUT_OF_SCOPE' || r.decision.reason !== 'OTHER_PROCESSOR') {
      throw new Error(`Assertion failed: Stripe credit "${r.bankRecord?.transaction.description}" was not classified as OUT_OF_SCOPE/OTHER_PROCESSOR (got Status: ${r.decision.status}, Reason: ${r.decision.reason})`);
    }
  });
  console.log('-----------------------------------------------------');
  console.log('✅ HDFC & Razorpay Regression verification passed.');
  console.log('=====================================================');
}

verifySemantics().catch(err => {
  console.error('❌ Validation failed:', err);
  process.exit(1);
});
