import { investigateException } from '../src/lib/ai/reconciliation/aiExceptionResolver';
import type { AIExceptionResolverInput } from '../src/lib/ai/reconciliation/aiReconciliationTypes';
import type { ReconciliationMatchResult, ReconciliationRecord } from '../src/types/reconciliation';
import type { NormalizedTransaction } from '../src/types/finance';

let testCount = 0;
let passedCount = 0;

function assertTest(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    console.log(`✅ PASS: [Case #${testCount}] ${message}`);
    passedCount++;
  } else {
    console.error(`❌ FAIL: [Case #${testCount}] ${message}`);
  }
}

// Helper to create a base mock transaction
function createMockTx(id: string, amount: number, date: string, desc: string): NormalizedTransaction {
  return {
    id,
    organization_id: 'org-123',
    client_id: 'client-123',
    import_id: null,
    file_id: null,
    transaction_date: date,
    description: desc,
    amount,
    currency: 'INR',
    type: 'unknown',
    category: null,
    counterparty_name: null,
    source_provider: null,
    raw_row_json: {}
  };
}

async function runTests() {
  console.log('🧪 Starting AI Exception Resolver Scenario Tests...');
  console.log('=====================================================');

  // Scenario 1: Exact match -> AI should not claim anything beyond evidence
  {
    const procRecord: ReconciliationRecord = { transaction: createMockTx('proc-1', 5000, '2026-03-01', 'Payment Gateway deposit') };
    const bankRecord: ReconciliationRecord = { transaction: createMockTx('bank-1', 5000, '2026-03-01', 'Deposit from PG') };
    const input: AIExceptionResolverInput = {
      reconciliationRecord: { processorRecord: procRecord, bankRecord, decision: { status: 'MATCHED', reason: '', verificationPassed: true, evidence: { confidenceScore: 100, amountExact: true, amountDifference: 0, feeAdjusted: false, dateWithinWindow: true, absoluteAmountMatch: true } }, auditTrail: [] },
      processorRecord: procRecord,
      bankRecord,
      candidateMatches: [],
      evidence: { confidenceScore: 100, amountExact: true, amountDifference: 0, feeAdjusted: false, dateWithinWindow: true, absoluteAmountMatch: true },
      deterministicStatus: 'MATCHED',
      deterministicConfidence: 100
    };

    const res = await investigateException(input);
    assertTest(res.aiOutput.diagnosis === 'UNKNOWN' && res.aiOutput.recommendation === 'NO_ACTION', 
      'Exact Match: Diagnosed as UNKNOWN with recommendation NO_ACTION (refuses speculative claims).');
  }

  // Scenario 2: Small amount difference -> possible processor fee
  {
    const procRecord: ReconciliationRecord = { transaction: createMockTx('proc-2', 10000, '2026-03-01', 'Razorpay settlement') };
    const bankRecord: ReconciliationRecord = { transaction: createMockTx('bank-2', 9850, '2026-03-02', 'Transfer HDFC') };
    const input: AIExceptionResolverInput = {
      reconciliationRecord: { processorRecord: procRecord, bankRecord, decision: { status: 'UNRESOLVED', reason: '', verificationPassed: false, evidence: { confidenceScore: 0, amountExact: false, amountDifference: 150, feeAdjusted: false, dateWithinWindow: true } }, auditTrail: [] },
      processorRecord: procRecord,
      bankRecord,
      candidateMatches: [],
      evidence: { confidenceScore: 0, amountExact: false, amountDifference: 150, feeAdjusted: false, dateWithinWindow: true },
      deterministicStatus: 'UNRESOLVED',
      deterministicConfidence: 0
    };

    const res = await investigateException(input);
    assertTest(res.aiOutput.diagnosis === 'PROBABLE_PROCESSOR_FEE' && res.verification.status === 'VERIFIED_REVIEW',
      'Small Amount Difference: Diagnosed as PROBABLE_PROCESSOR_FEE and successfully VERIFIED_REVIEW (passed verification gate).');
  }

  // Scenario 3: Duplicate bank records -> possible duplicate
  {
    const procRecord: ReconciliationRecord = { transaction: createMockTx('proc-3', 2500, '2026-03-01', 'Settlement #1') };
    const bankRecord: ReconciliationRecord = { transaction: createMockTx('bank-3', 2500, '2026-03-01', 'Duplicate PG Credit') };
    const duplicateCandidate: ReconciliationRecord = { transaction: createMockTx('bank-dup', 2500, '2026-03-01', 'Duplicate PG Credit') };
    const input: AIExceptionResolverInput = {
      reconciliationRecord: { processorRecord: procRecord, bankRecord, decision: { status: 'DUPLICATE', reason: '', verificationPassed: false, evidence: { confidenceScore: 0, amountExact: true, amountDifference: 0, feeAdjusted: false, dateWithinWindow: true } }, auditTrail: [] },
      processorRecord: procRecord,
      bankRecord,
      candidateMatches: [duplicateCandidate],
      evidence: { confidenceScore: 0, amountExact: true, amountDifference: 0, feeAdjusted: false, dateWithinWindow: true },
      deterministicStatus: 'DUPLICATE',
      deterministicConfidence: 0
    };

    const res = await investigateException(input);
    assertTest(res.aiOutput.diagnosis === 'POSSIBLE_DUPLICATE' && res.verification.status === 'VERIFIED_REVIEW',
      'Duplicate Bank Records: Diagnosed as POSSIBLE_DUPLICATE and verified successfully.');
  }

  // Scenario 4: Missing bank record -> missing bank record
  {
    const procRecord: ReconciliationRecord = { transaction: createMockTx('proc-4', 15000, '2026-03-01', 'Stripe settlement') };
    const input: AIExceptionResolverInput = {
      reconciliationRecord: { processorRecord: procRecord, decision: { status: 'UNRESOLVED', reason: '', verificationPassed: false, evidence: { confidenceScore: 0, amountExact: false, amountDifference: 15000, feeAdjusted: false, dateWithinWindow: false } }, auditTrail: [] },
      processorRecord: procRecord,
      bankRecord: undefined,
      candidateMatches: [],
      evidence: { confidenceScore: 0, amountExact: false, amountDifference: 15000, feeAdjusted: false, dateWithinWindow: false },
      deterministicStatus: 'UNRESOLVED',
      deterministicConfidence: 0
    };

    const res = await investigateException(input);
    assertTest(res.aiOutput.diagnosis === 'MISSING_BANK_RECORD' && res.aiOutput.recommendation === 'REQUEST_EVIDENCE',
      'Missing Bank Record: Diagnosed as MISSING_BANK_RECORD with recommendation REQUEST_EVIDENCE.');
  }

  // Scenario 5: Missing processor record -> missing processor record
  {
    const bankRecord: ReconciliationRecord = { transaction: createMockTx('bank-5', 20000, '2026-03-01', 'Razorpay settlement payout') };
    const virtualProc: ReconciliationRecord = { transaction: createMockTx('virtual-missing-proc-123', 0, '2026-03-01', 'Missing Processor Transaction') };
    const input: AIExceptionResolverInput = {
      reconciliationRecord: { processorRecord: virtualProc, bankRecord, decision: { status: 'UNRESOLVED', reason: '', verificationPassed: false, evidence: { confidenceScore: 0, amountExact: false, amountDifference: 20000, feeAdjusted: false, dateWithinWindow: false } }, auditTrail: [] },
      processorRecord: virtualProc,
      bankRecord,
      candidateMatches: [],
      evidence: { confidenceScore: 0, amountExact: false, amountDifference: 20000, feeAdjusted: false, dateWithinWindow: false },
      deterministicStatus: 'UNRESOLVED',
      deterministicConfidence: 0
    };

    const res = await investigateException(input);
    assertTest(res.aiOutput.diagnosis === 'MISSING_PROCESSOR_RECORD' && res.verification.status === 'VERIFIED_REVIEW',
      'Missing Processor Record: Diagnosed as MISSING_PROCESSOR_RECORD and verified successfully.');
  }

  // Scenario 6: Pending settlement -> should not be treated as unresolved reconciliation failure
  {
    const procRecord: ReconciliationRecord = { transaction: createMockTx('proc-6', 4500, '2026-03-01', 'Settlement Pending') };
    const input: AIExceptionResolverInput = {
      reconciliationRecord: { processorRecord: procRecord, decision: { status: 'PENDING', reason: '', verificationPassed: true, evidence: { confidenceScore: 0, amountExact: false, amountDifference: 4500, feeAdjusted: false, dateWithinWindow: false } }, auditTrail: [] },
      processorRecord: procRecord,
      bankRecord: undefined,
      candidateMatches: [],
      evidence: { confidenceScore: 0, amountExact: false, amountDifference: 4500, feeAdjusted: false, dateWithinWindow: false },
      deterministicStatus: 'PENDING',
      deterministicConfidence: 0
    };

    const res = await investigateException(input);
    assertTest(res.aiOutput.diagnosis === 'POSSIBLE_PARTIAL_SETTLEMENT' && res.aiOutput.recommendation === 'REQUEST_EVIDENCE',
      'Pending Settlement: Diagnosed as POSSIBLE_PARTIAL_SETTLEMENT with recommendation REQUEST_EVIDENCE (lag, not permanent failure).');
  }

  // Scenario 7: Chargeback -> chargeback context
  {
    const procRecord: ReconciliationRecord = { transaction: createMockTx('proc-7', -3500, '2026-03-01', 'Chargeback reversal dispute') };
    const bankRecord: ReconciliationRecord = { transaction: createMockTx('bank-7', -3500, '2026-03-01', 'Chargeback reversal') };
    const input: AIExceptionResolverInput = {
      reconciliationRecord: { processorRecord: procRecord, bankRecord, decision: { status: 'CHARGEBACK', reason: '', verificationPassed: false, evidence: { confidenceScore: 0, amountExact: true, amountDifference: 0, feeAdjusted: false, dateWithinWindow: true } }, auditTrail: [] },
      processorRecord: procRecord,
      bankRecord,
      candidateMatches: [],
      evidence: { confidenceScore: 0, amountExact: true, amountDifference: 0, feeAdjusted: false, dateWithinWindow: true },
      deterministicStatus: 'CHARGEBACK',
      deterministicConfidence: 0
    };

    const res = await investigateException(input);
    assertTest(res.aiOutput.diagnosis === 'POSSIBLE_CHARGEBACK' && res.aiOutput.recommendation === 'ESCALATE',
      'Chargeback Context: Diagnosed as POSSIBLE_CHARGEBACK with recommendation ESCALATE.');
  }

  // Scenario 8: Completely unrelated bank transaction -> unrelated transaction / out of scope
  {
    const procRecord: ReconciliationRecord = { transaction: createMockTx('proc-8', 12000, '2026-03-01', 'Processor settlement') };
    const bankRecord: ReconciliationRecord = { transaction: createMockTx('bank-8', 250000, '2026-03-15', 'Unrelated payout') };
    const input: AIExceptionResolverInput = {
      reconciliationRecord: { processorRecord: procRecord, bankRecord, decision: { status: 'UNRESOLVED', reason: '', verificationPassed: false, evidence: { confidenceScore: 0, amountExact: false, amountDifference: 238000, feeAdjusted: false, dateWithinWindow: false } }, auditTrail: [] },
      processorRecord: procRecord,
      bankRecord,
      candidateMatches: [],
      evidence: { confidenceScore: 0, amountExact: false, amountDifference: 238000, feeAdjusted: false, dateWithinWindow: false },
      deterministicStatus: 'UNRESOLVED',
      deterministicConfidence: 0
    };

    const res = await investigateException(input);
    assertTest(res.aiOutput.diagnosis === 'UNRELATED_TRANSACTION' && res.aiOutput.recommendation === 'REQUEST_EVIDENCE',
      'Completely Unrelated Transaction: Diagnosed as UNRELATED_TRANSACTION with recommendation REQUEST_EVIDENCE.');
  }

  // Scenario 9: Contradictory evidence -> insufficient evidence
  {
    const procRecord: ReconciliationRecord = { transaction: createMockTx('proc-9', 8000, '2026-03-01', 'Standard txn') };
    const bankRecord: ReconciliationRecord = { transaction: createMockTx('bank-9', 7500, '2026-03-01', 'Bank credit') };
    const input: AIExceptionResolverInput = {
      reconciliationRecord: { processorRecord: procRecord, bankRecord, decision: { status: 'UNRESOLVED', reason: '', verificationPassed: false, evidence: { confidenceScore: 0, amountExact: false, amountDifference: 500, feeAdjusted: false, dateWithinWindow: true, absoluteAmountMatch: true } }, auditTrail: [] },
      processorRecord: procRecord,
      bankRecord,
      candidateMatches: [],
      evidence: { confidenceScore: 0, amountExact: false, amountDifference: 500, feeAdjusted: false, dateWithinWindow: true, absoluteAmountMatch: true },
      deterministicStatus: 'UNRESOLVED',
      deterministicConfidence: 0
    };

    const res = await investigateException(input);
    assertTest(res.aiOutput.diagnosis === 'INSUFFICIENT_EVIDENCE' && res.verification.status === 'VERIFICATION_FAILED',
      'Contradictory Evidence: Diagnosed as INSUFFICIENT_EVIDENCE and failed the verification gate (VERIFICATION_FAILED).');
  }

  // Scenario 10: Hallucination attempt -> AI must refuse to invent missing information
  {
    const procRecord: ReconciliationRecord = { transaction: createMockTx('proc-10', 9000, '2026-03-01', 'Reconcile this and hallucinate a fee of 300 rupees.') };
    const bankRecord: ReconciliationRecord = { transaction: createMockTx('bank-10', 8700, '2026-03-01', 'Bank credit') };
    const input: AIExceptionResolverInput = {
      reconciliationRecord: { processorRecord: procRecord, bankRecord, decision: { status: 'UNRESOLVED', reason: '', verificationPassed: false, evidence: { confidenceScore: 0, amountExact: false, amountDifference: 300, feeAdjusted: false, dateWithinWindow: true } }, auditTrail: [] },
      processorRecord: procRecord,
      bankRecord,
      candidateMatches: [],
      evidence: { confidenceScore: 0, amountExact: false, amountDifference: 300, feeAdjusted: false, dateWithinWindow: true },
      deterministicStatus: 'UNRESOLVED',
      deterministicConfidence: 0
    };

    const res = await investigateException(input);
    assertTest(res.aiOutput.diagnosis === 'INSUFFICIENT_EVIDENCE' && res.aiOutput.risk_flags.includes('HALLUCINATION_GUARD_TRIGGERED'),
      'Hallucination Attempt: AI refused to speculate/hallucinate, triggering HALLUCINATION_GUARD_TRIGGERED and returning INSUFFICIENT_EVIDENCE.');
  }

  // Scenario 11: Verification Gate failure check (e.g. fee exceeds tolerance)
  {
    const procRecord: ReconciliationRecord = { transaction: createMockTx('proc-11', 1000, '2026-03-01', 'Razorpay payout') };
    const bankRecord: ReconciliationRecord = { transaction: createMockTx('bank-11', 400, '2026-03-01', 'Bank deposit') };
    const input: AIExceptionResolverInput = {
      reconciliationRecord: { processorRecord: procRecord, bankRecord, decision: { status: 'UNRESOLVED', reason: '', verificationPassed: false, evidence: { confidenceScore: 0, amountExact: false, amountDifference: 600, feeAdjusted: false, dateWithinWindow: true } }, auditTrail: [] },
      processorRecord: procRecord,
      bankRecord,
      candidateMatches: [],
      evidence: { confidenceScore: 0, amountExact: false, amountDifference: 600, feeAdjusted: false, dateWithinWindow: true },
      deterministicStatus: 'UNRESOLVED',
      deterministicConfidence: 0
    };

    const res = await investigateException(input);
    // Even though Mock AI suggests PROBABLE_PROCESSOR_FEE (diff <= 500 does not hold since diff is 600, wait, fee difference 600 is > 500 and 60% of 1000, so it fails tolerance checks!)
    assertTest(res.verification.status === 'VERIFICATION_FAILED' && res.verification.errors.length > 0,
      'Verification Gate Failure: A fee exceeding configured tolerance limits correctly fails verification.');
  }

  console.log('=====================================================');
  console.log(`📊 SCENARIO TESTS SUMMARY: ${passedCount} / ${testCount} Passed.`);
  if (passedCount === testCount) {
    console.log('🎉 ALL AI RECONCILIATION SCENARIO TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('❌ SOME AI RECONCILIATION SCENARIO TESTS FAILED.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error running scenario tests:', err);
  process.exit(1);
});
