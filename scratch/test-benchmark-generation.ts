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
const benchmarkDir = path.join(projectDir, 'test-data/benchmark');

function generateAndTest() {
  const bankRows: string[] = ['Date,Description,Withdrawal Amt.,Deposit Amt.,Closing Balance,Ref No'];
  const processorRows: string[] = ['Settlement Date,Settlement ID,Description,Amount,Status'];

  const formatDate = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const startDate = new Date('2026-02-01');
  let currentBalance = 500000;

  // 1. Clean matches (100 rows)
  for (let i = 0; i < 100; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = formatDate(date);
    const amount = 10000 + i * 100;
    const ref = `RZPY202602${10000 + i}`;
    const desc = `Settlement - Customer orders Feb ${10000 + i}`;
    
    processorRows.push(`${dateStr},${ref},${desc},${amount},settled`);
    bankRows.push(`${dateStr},NEFT CR-RAZORPAY PAYMENTS-SETTLEMENT-PERROTECH,,${amount},${currentBalance + amount},${ref}`);
    currentBalance += amount;
  }

  // 2. Date shifted (15 rows)
  // Spaced out to avoid collision
  for (let i = 0; i < 15; i++) {
    const pDate = new Date(startDate.getTime() + (200 + i * 5) * 24 * 60 * 60 * 1000);
    const bDate = new Date(pDate.getTime() + 1 * 24 * 60 * 60 * 1000); // exactly 1 day shifted
    const amount = 20000 + i * 100;
    const ref = `RZPY202602${20000 + i}`;
    const desc = `Settlement - Customer orders Feb ${20000 + i}`;
    
    processorRows.push(`${formatDate(pDate)},${ref},${desc},${amount},settled`);
    bankRows.push(`${formatDate(bDate)},NEFT CR-RAZORPAY PAYMENTS-SETTLEMENT-PERROTECH,,${amount},${currentBalance + amount},${ref}`);
    currentBalance += amount;
  }

  // 3. Fee adjusted (25 rows)
  // Spaced out by 10 days to prevent date overlap matches
  for (let i = 0; i < 25; i++) {
    const date = new Date(startDate.getTime() + (400 + i * 10) * 24 * 60 * 60 * 1000);
    const dateStr = formatDate(date);
    const pAmount = 30000 + i * 100;
    const fee = 100 + i * 10;
    const bAmount = pAmount - fee;
    const ref = `RZPY202602${30000 + i}`;
    const desc = `Settlement - Customer orders Feb ${30000 + i}`;
    
    processorRows.push(`${dateStr},${ref},${desc},${pAmount},settled`);
    bankRows.push(`${dateStr},NEFT CR-RAZORPAY PAYMENTS-SETTLEMENT-PERROTECH,,${bAmount},${currentBalance + bAmount},${ref}`);
    currentBalance += bAmount;
  }

  // 4. Missing bank / Failed settlements (10 rows)
  // These 10 rows in processor have no matching bank records
  for (let i = 0; i < 10; i++) {
    const date = new Date(startDate.getTime() + (700 + i * 5) * 24 * 60 * 60 * 1000);
    const dateStr = formatDate(date);
    const amount = 40000 + i * 100;
    const ref = `RZPY202602${40000 + i}`;
    // Contain "failed" so they represent both Category 4 and 8
    const desc = `Settlement - Failed payment Feb ${40000 + i}`;
    
    processorRows.push(`${dateStr},${ref},${desc},${amount},failed`);
  }

  // Total processor rows should be exactly 100 + 15 + 25 + 10 = 150 rows.
  // Add remaining bank rows to hit exactly 200 rows!
  const currentBankCount = bankRows.length - 1;
  const neededBankCount = 200 - currentBankCount;
  console.log(`Current Bank Count: ${currentBankCount}. Adding ${neededBankCount} bank rows...`);

  // Let's add out-of-scope bank deposits (10 rows)
  for (let i = 0; i < 10; i++) {
    const date = new Date(startDate.getTime() + (800 + i * 5) * 24 * 60 * 60 * 1000);
    const dateStr = formatDate(date);
    const amount = 15000 + i * 100;
    bankRows.push(`${dateStr},DIRECT DEPOSIT FROM CLIENT ${100 + i},,${amount},${currentBalance + amount},MANUAL_${100 + i}`);
    currentBalance += amount;
  }

  // Let's add out-of-scope bank expenses (10 rows)
  const expenses = [
    'SALARY PAYOUT - ENGINEERING TEAM',
    'OFFICE RENT - FEBRUARY',
    'AMAZON WEB SERVICES CLOUD BILLING',
    'VENDOR PAYMENT - OFFICE SUPPLIES',
    'INSURANCE PREMIUM AUTO-DEBIT',
    'TRANSFER TO SAVINGS ACCOUNT',
    'VENDOR PAYMENT - PRINTING SERVICES',
    'BANK CHARGES & FEES',
    'UPI-SWIGGY-PAYMENT',
    'UPI-BLINKIT-PAYMENT'
  ];
  for (let i = 0; i < 10; i++) {
    const date = new Date(startDate.getTime() + (900 + i * 5) * 24 * 60 * 60 * 1000);
    const dateStr = formatDate(date);
    const amount = -1000 - i * 500;
    bankRows.push(`${dateStr},${expenses[i]},${Math.abs(amount)},,${currentBalance + amount},EXP_${100 + i}`);
    currentBalance += amount;
  }

  // Let's add 5 duplicate bank rows (copies of clean matches) to satisfy Category 6 bank duplicates
  for (let i = 0; i < 5; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = formatDate(date);
    const amount = 10000 + i * 100;
    const ref = `RZPY202602${10000 + i}`;
    bankRows.push(`${dateStr},NEFT CR-RAZORPAY PAYMENTS-SETTLEMENT-PERROTECH,,${amount},${currentBalance + amount},${ref}`);
    currentBalance += amount;
  }

  // Fill up the rest with unresolved bank transactions (processor related) to not affect out-of-scope count
  const currentBankCount2 = bankRows.length - 1;
  const neededBankCount2 = 200 - currentBankCount2;
  for (let i = 0; i < neededBankCount2; i++) {
    const date = new Date(startDate.getTime() + (1000 + i * 5) * 24 * 60 * 60 * 1000);
    const dateStr = formatDate(date);
    const amount = 80000 + i * 100;
    bankRows.push(`${dateStr},NEFT CR-RAZORPAY PAYMENTS-SETTLEMENT-PERROTECH,,${amount},${currentBalance + amount},RZPY_UNMATCHED_${i}`);
    currentBalance += amount;
  }

  console.log(`Final Generated Counts: Bank = ${bankRows.length - 1}, Processor = ${processorRows.length - 1}`);

  fs.writeFileSync(path.join(benchmarkDir, 'benchmark_bank_statement.csv'), bankRows.join('\n'));
  fs.writeFileSync(path.join(benchmarkDir, 'benchmark_processor_export.csv'), processorRows.join('\n'));
}

async function testReconciliation() {
  const bankPath = path.join(benchmarkDir, 'benchmark_bank_statement.csv');
  const stripePath = path.join(benchmarkDir, 'benchmark_processor_export.csv');

  const bankContent = fs.readFileSync(bankPath, 'utf8');
  const stripeContent = fs.readFileSync(stripePath, 'utf8');

  const bankFile = new File([bankContent], 'benchmark_bank_statement.csv', { type: 'text/csv' });
  const stripeFile = new File([stripeContent], 'benchmark_processor_export.csv', { type: 'text/csv' });

  const bankParsed = await parseFinancialFile(bankFile);
  const stripeParsed = await parseFinancialFile(stripeFile);

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

  const runResult = await reconcileTransactionsPipeline(bankNorm.transactions, stripeNorm.transactions);
  console.log('RECONCILIATION SUMMARY:', JSON.stringify(runResult.summary, null, 2));
}

async function main() {
  generateAndTest();
  await testReconciliation();
}

main().catch(err => console.error(err));
