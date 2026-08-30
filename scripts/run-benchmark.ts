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

async function runBenchmark() {
  const bankPath = path.join(benchmarkDir, 'benchmark_bank_statement.csv');
  const processorPath = path.join(benchmarkDir, 'benchmark_processor_export.csv');
  const groundTruthPath = path.join(benchmarkDir, 'ground_truth.json');

  if (!fs.existsSync(bankPath) || !fs.existsSync(processorPath) || !fs.existsSync(groundTruthPath)) {
    console.error('Benchmark files are missing!');
    process.exit(1);
  }

  // Load ground truth
  const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf8'));

  // Parse and normalize
  const bankContent = fs.readFileSync(bankPath, 'utf8');
  const processorContent = fs.readFileSync(processorPath, 'utf8');

  const bankFile = new File([bankContent], 'benchmark_bank_statement.csv', { type: 'text/csv' });
  const processorFile = new File([processorContent], 'benchmark_processor_export.csv', { type: 'text/csv' });

  const bankParsed = await parseFinancialFile(bankFile);
  const processorParsed = await parseFinancialFile(processorFile);

  const bankNorm = normalizeIngestedRows(
    bankParsed.allRows,
    bankParsed.suggestedMapping,
    { provider: bankParsed.provider, currency: 'INR' }
  );

  const processorNorm = normalizeIngestedRows(
    processorParsed.allRows,
    processorParsed.suggestedMapping,
    { provider: processorParsed.provider, currency: 'INR' }
  );

  // Run reconciliation
  const runResult = await reconcileTransactionsPipeline(bankNorm.transactions, processorNorm.transactions);
  const summary = runResult.summary;

  // Extract counts
  const matched = summary.matchedSettlementCount;
  const matchRate = parseFloat(summary.matchRate.toFixed(1));
  const duplicates = summary.duplicateCount;
  const outOfScope = summary.outOfScopeCount;

  // Classify exceptions
  let feeAdjustedCount = 0;
  let missingBankCount = 0;
  let failedCount = 0;

  // Identify unresolved processor records
  const unresolvedResults = runResult.results.filter(r => 
    r.decision.status === 'UNRESOLVED' &&
    !r.processorRecord.transaction.id.startsWith('virtual-')
  );

  for (const r of unresolvedResults) {
    const desc = (r.processorRecord.transaction.description || '').toLowerCase();
    const matchesFailed = desc.includes('failed');
    
    // Extract suffix from description (e.g., "Settlement - Customer orders Feb 30005" -> 30005)
    const suffixMatch = r.processorRecord.transaction.description.match(/\d+$/);
    const suffix = suffixMatch ? suffixMatch[0] : '';

    if (matchesFailed) {
      failedCount++;
      // A failed settlement is also missing in bank
      missingBankCount++;
    } else if (suffix) {
      // Check if there is any bank transaction with this suffix in its description or reference
      const inBank = bankNorm.transactions.some(b => {
        const bDesc = (b.description || '').toLowerCase();
        const bRawStr = b.raw_row_json ? JSON.stringify(b.raw_row_json).toLowerCase() : '';
        return bDesc.includes(suffix) || bRawStr.includes(suffix);
      });

      if (inBank) {
        feeAdjustedCount++;
      } else {
        missingBankCount++;
      }
    } else {
      missingBankCount++;
    }
  }

  const exceptionsFound = feeAdjustedCount + missingBankCount + failedCount;
  const expectedExceptionsTotal = groundTruth.expectedExceptions.feeAdjusted + 
                                  groundTruth.expectedExceptions.missingBank + 
                                  groundTruth.expectedExceptions.failedSettlements;

  // Accuracy calculations
  // False positive: matched processor record that belongs to exception category (suffix >= 30000)
  let falsePositives = 0;
  // False negative: unmatched processor record that belongs to match category (suffix < 30000)
  let falseNegatives = 0;

  // Check matched
  runResult.results.filter(r => r.decision.status === 'MATCHED').forEach(r => {
    const desc = r.processorRecord.transaction.description || '';
    const suffixMatch = desc.match(/\d+$/);
    if (suffixMatch) {
      const val = parseInt(suffixMatch[0], 10);
      if (val >= 30000) {
        falsePositives++;
      }
    }
  });

  // Check unmatched/exceptions for false negatives
  runResult.results.filter(r => r.decision.status === 'UNRESOLVED').forEach(r => {
    const desc = r.processorRecord.transaction.description || '';
    const suffixMatch = desc.match(/\d+$/);
    if (suffixMatch) {
      const val = parseInt(suffixMatch[0], 10);
      if (val < 30000) {
        falseNegatives++;
      }
    }
  });

  const matchAccuracy = (matched / groundTruth.expectedMatches) * 100;
  const exceptionAccuracy = (exceptionsFound / expectedExceptionsTotal) * 100;

  // Overall Score formula
  const baseScore = (matchAccuracy + exceptionAccuracy) / 2;
  const penalty = (falsePositives + falseNegatives) * 5;
  const overallScore = Math.max(0, Math.min(100, Math.round(baseScore - penalty)));

  // Output Report
  const runDateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  console.log(`
KAEO RECONCILIATION BENCHMARK
==============================
Dataset: 200 bank rows, 150 processor rows
Run date: ${runDateStr}

RESULTS
-------
Matched:              ${matched} (expected ${groundTruth.expectedMatches})
Match rate:           ${matchRate}% (expected ${groundTruth.expectedMatchRate})
Exceptions found:     ${exceptionsFound} (expected ${expectedExceptionsTotal})
  - Fee Adjusted:     ${feeAdjustedCount} (expected ${groundTruth.expectedExceptions.feeAdjusted})
  - Missing Bank:     ${missingBankCount} (expected ${groundTruth.expectedExceptions.missingBank})
  - Failed Payments:  ${failedCount} (expected ${groundTruth.expectedExceptions.failedSettlements})
Duplicates caught:    ${duplicates} (expected ${groundTruth.expectedDuplicates})
Out of scope:         ${outOfScope} (expected ${groundTruth.expectedOutOfScope})

ACCURACY
--------
Match accuracy:       ${matchAccuracy.toFixed(1)}% (matched / expected matches)
Exception accuracy:   ${exceptionAccuracy.toFixed(1)}% (exceptions found / expected exceptions)
False positives:      ${falsePositives} (matches that shouldn't have matched)
False negatives:      ${falseNegatives} (misses that should have matched)

OVERALL SCORE:        ${overallScore}%
`);

  if (overallScore > 85) {
    console.log('🎉 BENCHMARK PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ BENCHMARK FAILED: Score is below 85% threshold.');
    
    // Identify failed categories
    if (matched !== groundTruth.expectedMatches) {
      console.error(`- Matches mismatched: got ${matched}, expected ${groundTruth.expectedMatches}`);
    }
    if (feeAdjustedCount !== groundTruth.expectedExceptions.feeAdjusted) {
      console.error(`- Fee adjusted exceptions mismatched: got ${feeAdjustedCount}, expected ${groundTruth.expectedExceptions.feeAdjusted}`);
    }
    if (missingBankCount !== groundTruth.expectedExceptions.missingBank) {
      console.error(`- Missing bank exceptions mismatched: got ${missingBankCount}, expected ${groundTruth.expectedExceptions.missingBank}`);
    }
    if (failedCount !== groundTruth.expectedExceptions.failedSettlements) {
      console.error(`- Failed payments exceptions mismatched: got ${failedCount}, expected ${groundTruth.expectedExceptions.failedSettlements}`);
    }
    if (duplicates !== groundTruth.expectedDuplicates) {
      console.error(`- Duplicates mismatched: got ${duplicates}, expected ${groundTruth.expectedDuplicates}`);
    }
    if (outOfScope !== groundTruth.expectedOutOfScope) {
      console.error(`- Out of scope mismatched: got ${outOfScope}, expected ${groundTruth.expectedOutOfScope}`);
    }
    
    process.exit(1);
  }
}

runBenchmark().catch(err => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
