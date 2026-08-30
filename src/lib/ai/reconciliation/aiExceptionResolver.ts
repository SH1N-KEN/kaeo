import { supabase } from '../../supabase';
import type { 
  AIExceptionResolverInput, 
  AIInvestigationOutput, 
  ReconciliationAIProvider 
} from './aiReconciliationTypes';
import { verifyAIInvestigation } from './aiVerificationGate';

/**
 * PRODUCTION PROVIDER: Invokes Supabase Edge Function to contact production LLM.
 */
export class SupabaseEdgeFunctionAIProvider implements ReconciliationAIProvider {
  name = 'Supabase Edge Function';

  async investigateException(input: AIExceptionResolverInput): Promise<AIInvestigationOutput> {
    const procTx = input.processorRecord?.transaction;
    const bankTx = input.bankRecord?.transaction || null;

    // Calculate date gap
    let dateGap = 0;
    if (procTx && bankTx) {
      const pDate = new Date(procTx.transaction_date);
      const bDate = new Date(bankTx.transaction_date);
      dateGap = Math.abs(bDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24);
    }

    // Map deterministic status to exception type
    let exceptionType: 'REVIEW' | 'UNRESOLVED' | 'AMBIGUOUS' | 'DISCREPANCY' | 'UNUSUAL_PATTERN' = 'DISCREPANCY';
    if (input.deterministicStatus === 'REVIEW') {
      exceptionType = 'REVIEW';
    } else if (input.deterministicStatus === 'UNRESOLVED') {
      exceptionType = 'UNRESOLVED';
    } else if (input.deterministicStatus === 'DUPLICATE') {
      exceptionType = 'UNUSUAL_PATTERN';
    } else if (input.deterministicStatus === 'CHARGEBACK') {
      exceptionType = 'DISCREPANCY';
    } else if (input.deterministicStatus === 'REFUND') {
      exceptionType = 'REVIEW';
    }

    const payload = {
      exceptionType,
      evidence: {
        processorTxn: procTx,
        bankTxn: bankTx,
        discrepancy: input.reconciliationRecord?.decision?.reason || procTx?.description || 'Amount variance',
        amount: input.evidence.amountDifference ?? 0,
        dateGap
      }
    };

    // Invoke reconciliation-ai Edge Function
    const { data, error } = await supabase.functions.invoke('reconciliation-ai', {
      body: payload
    });

    if (error) {
      throw new Error(`Edge Function error: ${error.message}`);
    }

    if (!data) {
      throw new Error('Edge Function returned empty response');
    }

    // Map response back to AIInvestigationOutput
    const lowerText = ((data.assessment || '') + ' ' + (data.reasoning || '')).toLowerCase();
    
    let diagnosis: AIInvestigationOutput['diagnosis'] = 'UNKNOWN';
    if (lowerText.includes('fee')) {
      diagnosis = 'PROBABLE_PROCESSOR_FEE';
    } else if (lowerText.includes('duplicate')) {
      diagnosis = 'POSSIBLE_DUPLICATE';
    } else if (lowerText.includes('date') || lowerText.includes('shift')) {
      diagnosis = 'POSSIBLE_DATE_SHIFT';
    } else if (lowerText.includes('refund')) {
      diagnosis = 'POSSIBLE_REFUND';
    } else if (lowerText.includes('chargeback') || lowerText.includes('dispute')) {
      diagnosis = 'POSSIBLE_CHARGEBACK';
    } else if (lowerText.includes('missing bank')) {
      diagnosis = 'MISSING_BANK_RECORD';
    } else if (lowerText.includes('missing proc')) {
      diagnosis = 'MISSING_PROCESSOR_RECORD';
    } else if (lowerText.includes('pending') || lowerText.includes('partial')) {
      diagnosis = 'POSSIBLE_PARTIAL_SETTLEMENT';
    } else if (lowerText.includes('unrelated')) {
      diagnosis = 'UNRELATED_TRANSACTION';
    } else {
      // Fallback based on deterministic status
      if (input.deterministicStatus === 'DUPLICATE') diagnosis = 'POSSIBLE_DUPLICATE';
      else if (input.deterministicStatus === 'CHARGEBACK') diagnosis = 'POSSIBLE_CHARGEBACK';
      else if (input.deterministicStatus === 'PENDING' || input.deterministicStatus === 'PROCESSING') diagnosis = 'POSSIBLE_PARTIAL_SETTLEMENT';
      else if (input.deterministicStatus === 'REFUND') diagnosis = 'POSSIBLE_REFUND';
      else if (input.deterministicStatus === 'UNRESOLVED' && !bankTx) diagnosis = 'MISSING_BANK_RECORD';
      else if (input.deterministicStatus === 'UNRESOLVED' && procTx?.id.startsWith('virtual-missing-proc-')) diagnosis = 'MISSING_PROCESSOR_RECORD';
    }

    // Map recommendation
    let recommendation: AIInvestigationOutput['recommendation'] = 'REVIEW';
    if (data.recommendedAction === 'APPROVE') {
      recommendation = 'REVIEW'; // Mapped to REVIEW so verification gate can verify it to VERIFIED_REVIEW
    } else if (data.recommendedAction === 'REJECT') {
      recommendation = 'ESCALATE';
    } else if (data.recommendedAction === 'REQUEST_DOCUMENTATION') {
      recommendation = 'REQUEST_EVIDENCE';
    } else if (data.recommendedAction === 'INVESTIGATE') {
      recommendation = 'REVIEW';
    }

    return {
      diagnosis,
      explanation: data.assessment,
      evidence: [
        { type: 'LIKELIHOOD', value: data.likelihood },
        { type: 'ASSESSMENT', value: data.assessment },
        { type: 'RECOMMENDED_ACTION', value: data.recommendedAction }
      ],
      recommendation,
      confidence: data.confidence,
      required_human_action: data.recommendedAction !== 'APPROVE',
      reasoning_summary: data.reasoning,
      risk_flags: data.recommendedAction === 'REJECT' ? ['REJECTED_BY_AI'] : []
    };
  }
}

/**
 * DEVELOPMENT MOCK PROVIDER: Performs dynamic rules-based analysis of the evidence context.
 * Clearly marked as MOCK.
 */
export class MockReconciliationAIProvider implements ReconciliationAIProvider {
  name = 'Mock AI Exception Resolver (Development)';

  async investigateException(input: AIExceptionResolverInput): Promise<AIInvestigationOutput> {
    const procTx = input.processorRecord.transaction;
    const bankTx = input.bankRecord?.transaction;
    const procDesc = (procTx.description || '').toLowerCase();
    const bankDesc = bankTx ? (bankTx.description || '').toLowerCase() : '';
    const combinedDesc = `${procDesc} ${bankDesc}`;

    // Helper: parse date differences
    let dateDiffDays = 999;
    if (bankTx) {
      const pDate = new Date(procTx.transaction_date);
      const bDate = new Date(bankTx.transaction_date);
      dateDiffDays = Math.abs(bDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24);
    }

    // 10. Hallucination test check: if description tries to force inventing data
    if (combinedDesc.includes('hallucinate') || combinedDesc.includes('force fee') || combinedDesc.includes('invent')) {
      return {
        diagnosis: 'INSUFFICIENT_EVIDENCE',
        explanation: 'The request contains contradictory or fabricated statements. Unable to verify information without direct transaction proof.',
        evidence: [
          { type: 'CONTRACTION_FLAG', value: true }
        ],
        recommendation: 'REQUEST_EVIDENCE',
        confidence: 99,
        required_human_action: true,
        reasoning_summary: 'AI refused to invent missing ledger records or reconcile based on semantic prompt pressure.',
        risk_flags: ['HALLUCINATION_GUARD_TRIGGERED']
      };
    }

    // 9. Contradictory evidence check
    if (input.evidence.absoluteAmountMatch === true && (input.evidence.amountDifference ?? 0) > 0.01) {
      return {
        diagnosis: 'INSUFFICIENT_EVIDENCE',
        explanation: 'Contradictory evidence detected: Control flags declare absolute amount match, but amount difference variance exists.',
        evidence: [
          { type: 'CONTRADICTION', value: true }
        ],
        recommendation: 'REQUEST_EVIDENCE',
        confidence: 70,
        required_human_action: true,
        reasoning_summary: 'Verification flags contradict numeric ledger differences.',
        risk_flags: ['CONTRADICTION_DETECTED']
      };
    }

    // 6. Pending Settlement check
    if (combinedDesc.includes('pending') || combinedDesc.includes('processing') || input.deterministicStatus === 'PENDING' || input.deterministicStatus === 'PROCESSING') {
      return {
        diagnosis: 'POSSIBLE_PARTIAL_SETTLEMENT',
        explanation: `The transaction is marked as pending/processing on the processor ledger. Final bank payout has not yet cleared.`,
        evidence: [
          { type: 'PENDING_STATUS', value: true }
        ],
        recommendation: 'REQUEST_EVIDENCE',
        confidence: 90,
        required_human_action: true,
        reasoning_summary: 'Pending settlements are expected temporal lags rather than permanent reconciliation errors.',
        risk_flags: []
      };
    }

    // 4. Missing Bank Record check
    if (!bankTx || procTx.id.startsWith('virtual-missing-bank-') || input.deterministicStatus === 'UNRESOLVED' && !bankTx) {
      return {
        diagnosis: 'MISSING_BANK_RECORD',
        explanation: `Processor recorded settlement of ₹${Math.abs(procTx.amount).toLocaleString()} on ${procTx.transaction_date.slice(0, 10)}, but no matching bank statement credit entry exists.`,
        evidence: [
          { type: 'PROCESSOR_AMOUNT', value: procTx.amount },
          { type: 'BANK_RECORD_EXISTS', value: false }
        ],
        recommendation: 'REQUEST_EVIDENCE',
        confidence: 95,
        required_human_action: true,
        reasoning_summary: 'Bank ledger scan failed to find any entry matching processor amount and date.',
        risk_flags: ['UNMATCHED_SETTLEMENT']
      };
    }

    // 5. Missing Processor Record check
    if (procTx.id.startsWith('virtual-missing-proc-') || combinedDesc.includes('missing processor') || combinedDesc.includes('virtual-missing-proc-')) {
      return {
        diagnosis: 'MISSING_PROCESSOR_RECORD',
        explanation: `Bank statement records a deposit of ₹${Math.abs(bankTx!.amount).toLocaleString()} on ${bankTx!.transaction_date.slice(0, 10)}, but corresponding transaction is missing in payment processor export.`,
        evidence: [
          { type: 'BANK_AMOUNT', value: bankTx!.amount },
          { type: 'PROCESSOR_RECORD_EXISTS', value: false }
        ],
        recommendation: 'REVIEW',
        confidence: 95,
        required_human_action: true,
        reasoning_summary: 'In-scope deposit occurred in the bank statement, but payment gateway logs lack this item.',
        risk_flags: ['MISSING_GATEWAY_RECORD']
      };
    }

    // 7. Chargeback exception check
    if (combinedDesc.includes('chargeback') || combinedDesc.includes('dispute') || input.deterministicStatus === 'CHARGEBACK') {
      return {
        diagnosis: 'POSSIBLE_CHARGEBACK',
        explanation: `Reconciliation exception matches chargeback keywords and dispute patterns. A client dispute has reversed the credit.`,
        evidence: [
          { type: 'CHARGEBACK_KEYWORDS', value: true }
        ],
        recommendation: 'ESCALATE',
        confidence: 95,
        required_human_action: true,
        reasoning_summary: 'Processor reversed payment credit due to active customer dispute.',
        risk_flags: ['DISPUTE_RAISED']
      };
    }

    // 7b. Refund check
    if (combinedDesc.includes('refund') || procTx.amount < 0 || (bankTx && bankTx.amount < 0)) {
      return {
        diagnosis: 'POSSIBLE_REFUND',
        explanation: `Customer refund event detected on processor logs, leading to negative adjustment of ₹${Math.abs(procTx.amount).toLocaleString()}.`,
        evidence: [
          { type: 'REFUND_KEYWORDS', value: true }
        ],
        recommendation: 'REVIEW',
        confidence: 92,
        required_human_action: true,
        reasoning_summary: 'Refund transactions represent outflow events that reverse previous deposits.',
        risk_flags: []
      };
    }

    // 3. Duplicate checks
    if (combinedDesc.includes('duplicate') || input.deterministicStatus === 'DUPLICATE') {
      return {
        diagnosis: 'POSSIBLE_DUPLICATE',
        explanation: `Duplicate entries detected matching exact date, amount, and reference tags.`,
        evidence: [
          { type: 'DUPLICATE_SIG', value: true }
        ],
        recommendation: 'REVIEW',
        confidence: 95,
        required_human_action: true,
        reasoning_summary: 'Identical amount and date indicate accidental double transmission or double import.',
        risk_flags: ['DUPLICATE_WARNING']
      };
    }

    const amtDiff = input.evidence.amountDifference ?? 0;

    // 8. Completely unrelated check
    if (amtDiff > 500 && dateDiffDays > 5) {
      return {
        diagnosis: 'UNRELATED_TRANSACTION',
        explanation: `The transactions represent unrelated financial events. Date difference is ${dateDiffDays.toFixed(1)} days and amount variance is too large.`,
        evidence: [
          { type: 'AMOUNT_DIFF', value: amtDiff },
          { type: 'DATE_DIFF_DAYS', value: dateDiffDays }
        ],
        recommendation: 'REQUEST_EVIDENCE',
        confidence: 85,
        required_human_action: true,
        reasoning_summary: 'Numeric parameters fall outside matching bounds.',
        risk_flags: ['OUT_OF_BOUNDS']
      };
    }

    // 2. Processor fee (any other amount difference > 0.01)
    if (amtDiff > 0.01) {
      return {
        diagnosis: 'PROBABLE_PROCESSOR_FEE',
        explanation: `The bank statement deposit (₹${Math.abs(bankTx!.amount).toLocaleString()}) is lower than the processor settlement amount (₹${Math.abs(procTx.amount).toLocaleString()}) by ₹${amtDiff.toFixed(2)}, indicating a gateway fee deduction.`,
        evidence: [
          { type: 'AMOUNT_DIFFERENCE', value: amtDiff },
          { type: 'DATE_MATCH', value: dateDiffDays <= 2 },
          { type: 'REFERENCE_ALIGNMENT', value: true }
        ],
        recommendation: 'REVIEW',
        confidence: 94,
        required_human_action: true,
        reasoning_summary: 'Amount variance is analyzed for fee deduction.',
        risk_flags: []
      };
    }

    // 1. Exact Match check
    if (amtDiff === 0 && dateDiffDays === 0) {
      return {
        diagnosis: 'UNKNOWN',
        explanation: 'Transactions match exactly in amount and date. No exception is present. The AI should not make speculative inferences beyond the matching evidence.',
        evidence: [
          { type: 'EXACT_MATCH', value: true }
        ],
        recommendation: 'NO_ACTION',
        confidence: 90,
        required_human_action: false,
        reasoning_summary: 'No anomaly or discrepancy detected. Deterministic logic was sufficient.',
        risk_flags: []
      };
    }

    // Fallback/Unknown
    return {
      diagnosis: 'UNKNOWN',
      explanation: 'Unable to determine exception cause with available transaction ledger variables.',
      evidence: [],
      recommendation: 'REVIEW',
      confidence: 30,
      required_human_action: true,
      reasoning_summary: 'Insufficient parameters for classification.',
      risk_flags: []
    };
  }
}

/**
 * Main entry point function to resolve exception analysis.
 */
export async function investigateException(
  input: AIExceptionResolverInput,
  options?: { providerName?: 'mock' | 'supabase' }
) {
  // Select provider based on configuration or override
  let provider: ReconciliationAIProvider;
  if (options?.providerName === 'supabase') {
    provider = new SupabaseEdgeFunctionAIProvider();
  } else {
    provider = new MockReconciliationAIProvider();
  }

  // Execute LLM investigation
  const aiOutput = await provider.investigateException(input);

  // Pass output through the deterministic verification gate
  const verification = verifyAIInvestigation(input, aiOutput);

  return {
    aiProvider: provider.name,
    aiOutput,
    verification
  };
}
