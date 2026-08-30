import type { AIExceptionResolverInput, AIInvestigationOutput } from './aiReconciliationTypes';

export interface VerificationGateResult {
  status: 'VERIFIED_REVIEW' | 'VERIFICATION_FAILED';
  passed: boolean;
  errors: string[];
}

/**
 * Checks the AI diagnosis and recommendation against hard financial constraints.
 * 
 * If verification passes, the final UI status displays VERIFIED_REVIEW.
 * If verification fails, the final UI status displays VERIFICATION_FAILED.
 */
export function verifyAIInvestigation(
  input: AIExceptionResolverInput,
  aiOutput: AIInvestigationOutput
): VerificationGateResult {
  const errors: string[] = [];

  // Constrain to allowed recommendations
  const allowedRecommendations = ['REVIEW', 'ESCALATE', 'NO_ACTION', 'REQUEST_EVIDENCE'];
  if (!allowedRecommendations.includes(aiOutput.recommendation)) {
    errors.push(`AI returned invalid recommendation: "${aiOutput.recommendation}".`);
  }

  // AI must NEVER recommend MATCHED directly
  if ((aiOutput.recommendation as any) === 'MATCHED') {
    errors.push('AI is not authorized to declare a MATCHED recommendation.');
  }

  // Constrain to allowed diagnoses
  const allowedDiagnoses = [
    'PROBABLE_PROCESSOR_FEE',
    'POSSIBLE_DUPLICATE',
    'POSSIBLE_DATE_SHIFT',
    'POSSIBLE_PARTIAL_SETTLEMENT',
    'MISSING_BANK_RECORD',
    'MISSING_PROCESSOR_RECORD',
    'POSSIBLE_REFUND',
    'POSSIBLE_CHARGEBACK',
    'INSUFFICIENT_EVIDENCE',
    'UNRELATED_TRANSACTION',
    'UNKNOWN'
  ];
  if (!allowedDiagnoses.includes(aiOutput.diagnosis)) {
    errors.push(`AI returned invalid diagnosis: "${aiOutput.diagnosis}".`);
  }

  // Check for contradictory evidence
  if (input.evidence.absoluteAmountMatch === true && (input.evidence.amountDifference ?? 0) > 0.01) {
    errors.push('Contradictory evidence: absoluteAmountMatch is true, but there is a non-zero amount difference.');
  }

  // Rule checks based on diagnosis
  if (aiOutput.diagnosis === 'PROBABLE_PROCESSOR_FEE') {
    // 1. Amount difference exists
    const amtDiff = input.evidence.amountDifference ?? 0;
    if (amtDiff <= 0) {
      errors.push('No amount difference exists to support a fee adjustment.');
    }

    // 2. Amount difference is within configured fee tolerance
    // Configure: fee must be <= 5% of processor amount or <= 500 INR
    const processorAmt = Math.abs(input.processorRecord.transaction.amount);
    if (processorAmt > 0) {
      const feePercent = (amtDiff / processorAmt) * 100;
      const isWithinTolerance = feePercent <= 5.01 || amtDiff <= 500;
      if (!isWithinTolerance) {
        errors.push(`Fee difference of ₹${amtDiff.toFixed(2)} (${feePercent.toFixed(2)}%) exceeds tolerance window (max 5% or ₹500).`);
      }
    }

    // 3. Date relationship is valid (difference between processor date and bank date is <= 7 days)
    if (input.bankRecord) {
      const pDate = new Date(input.processorRecord.transaction.transaction_date);
      const bDate = new Date(input.bankRecord.transaction.transaction_date);
      const dateDiffDays = Math.abs(bDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dateDiffDays > 7.01) {
        errors.push(`Date difference of ${dateDiffDays.toFixed(1)} days exceeds acceptable settlement window (max 7 days).`);
      }
    } else {
      errors.push('Bank record is missing, date relationship cannot be checked.');
    }

    // 4. Candidate processor record exists
    if (!input.processorRecord || !input.processorRecord.transaction || input.processorRecord.transaction.id.startsWith('virtual-missing-proc-')) {
      errors.push('No valid processor record exists for fee calculation.');
    }

    // 5. No duplicate candidate exists
    const processorAmtRounded = Math.round(Math.abs(input.processorRecord.transaction.amount));
    const duplicateCandidates = input.candidateMatches.filter(c => 
      c.transaction.id !== input.processorRecord.transaction.id &&
      Math.round(Math.abs(c.transaction.amount)) === processorAmtRounded
    );
    if (duplicateCandidates.length > 0) {
      errors.push('Duplicate candidate processor records detected, causing settlement ambiguity.');
    }

    // 6. No contradictory evidence exists
    if (input.evidence.absoluteAmountMatch === true && amtDiff > 0) {
      errors.push('Contradictory evidence: absoluteAmountMatch is true, yet amount difference exists.');
    }
  }

  else if (aiOutput.diagnosis === 'POSSIBLE_DUPLICATE') {
    // Verify that some duplicate bank record or duplicate processor record exists
    const hasDuplicateCandidates = input.candidateMatches.length > 0;
    const isDeterministicDup = input.deterministicStatus === 'DUPLICATE';
    if (!hasDuplicateCandidates && !isDeterministicDup) {
      errors.push('No duplicate candidates or duplicate markers found in the exception context.');
    }
  }

  else if (aiOutput.diagnosis === 'POSSIBLE_DATE_SHIFT') {
    if (input.bankRecord) {
      const pDate = new Date(input.processorRecord.transaction.transaction_date);
      const bDate = new Date(input.bankRecord.transaction.transaction_date);
      const dateDiffDays = Math.abs(bDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dateDiffDays <= 0.01) {
        errors.push('No date shift exists; transactions occur on the same day.');
      } else if (dateDiffDays > 14.01) {
        errors.push(`Date difference of ${dateDiffDays.toFixed(1)} days exceeds maximum date shift tolerance (14 days).`);
      }
    } else {
      errors.push('Bank record is missing, date shift cannot be verified.');
    }
  }

  else if (aiOutput.diagnosis === 'MISSING_BANK_RECORD') {
    if (input.bankRecord && !input.bankRecord.transaction.id.startsWith('virtual-missing-bank-')) {
      errors.push('Bank record exists in control records, contradicting the missing bank record diagnosis.');
    }
  }

  else if (aiOutput.diagnosis === 'MISSING_PROCESSOR_RECORD') {
    if (input.processorRecord && !input.processorRecord.transaction.id.startsWith('virtual-missing-proc-')) {
      errors.push('Processor record exists in control records, contradicting the missing processor record diagnosis.');
    }
  }

  else if (aiOutput.diagnosis === 'POSSIBLE_REFUND') {
    const isRefundKeyword = 
      (input.processorRecord.transaction.description || '').toLowerCase().includes('refund') ||
      (input.bankRecord?.transaction.description || '').toLowerCase().includes('refund');
    const isNegativeAmount = input.processorRecord.transaction.amount < 0 || (input.bankRecord && input.bankRecord.transaction.amount < 0);
    
    if (!isRefundKeyword && !isNegativeAmount) {
      errors.push('No textual (refund keywords) or numerical (negative amounts) evidence of a customer refund.');
    }
  }

  else if (aiOutput.diagnosis === 'POSSIBLE_CHARGEBACK') {
    const descLower = (
      (input.processorRecord.transaction.description || '') + 
      ' ' + 
      (input.bankRecord?.transaction.description || '')
    ).toLowerCase();
    
    const hasDisputeKeywords = descLower.includes('chargeback') || descLower.includes('dispute') || descLower.includes('cb');
    if (!hasDisputeKeywords) {
      errors.push('No chargeback or dispute keywords found in descriptions.');
    }
  }

  else if (aiOutput.diagnosis === 'UNRELATED_TRANSACTION') {
    // If diagnosis is unrelated, verify there's actually a reason (e.g. huge amount diff, date difference exceeds standard windows, completely different description)
    if (input.bankRecord) {
      const pAmt = Math.abs(input.processorRecord.transaction.amount);
      const bAmt = Math.abs(input.bankRecord.transaction.amount);
      const pDate = new Date(input.processorRecord.transaction.transaction_date);
      const bDate = new Date(input.bankRecord.transaction.transaction_date);
      const dateDiffDays = Math.abs(bDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24);
      
      const isCloseAmount = Math.abs(pAmt - bAmt) <= 10;
      const isCloseDate = dateDiffDays <= 3;
      if (isCloseAmount && isCloseDate) {
        errors.push('Transactions match closely in date and amount; they are likely related.');
      }
    }
  }

  // Verification outcome
  if (errors.length > 0) {
    return {
      status: 'VERIFICATION_FAILED',
      passed: false,
      errors
    };
  }

  return {
    status: 'VERIFIED_REVIEW',
    passed: true,
    errors
  };
}
