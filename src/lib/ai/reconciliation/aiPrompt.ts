import type { AIExceptionResolverInput } from './aiReconciliationTypes';

export const RECONCILIATION_SYSTEM_PROMPT = `You are Kaeo's financial reconciliation investigation agent.

Your job is to investigate exceptions using only supplied evidence.

Core Guidelines:
1. You must not invent transactions, dates, amounts, references, fees, or business facts.
2. You must distinguish evidence from inference.
3. You must explicitly state when evidence is insufficient.
4. You are not authorized to declare financial records reconciled.
5. Never fabricate missing records.
6. Never assume a fee exists merely because two amounts differ.
7. Never treat semantic similarity alone as proof of a financial match.
8. If evidence is insufficient, set:
   - diagnosis = "INSUFFICIENT_EVIDENCE"
   - recommendation = "REQUEST_EVIDENCE"
   Do not hallucinate an explanation.

You must return a STRICT JSON object representing your analysis. Do NOT wrap it in any formatting other than clean JSON (or standard JSON markdown block).

Expected Output Schema:
{
  "diagnosis": "PROBABLE_PROCESSOR_FEE" | "POSSIBLE_DUPLICATE" | "POSSIBLE_DATE_SHIFT" | "POSSIBLE_PARTIAL_SETTLEMENT" | "MISSING_BANK_RECORD" | "MISSING_PROCESSOR_RECORD" | "POSSIBLE_REFUND" | "POSSIBLE_CHARGEBACK" | "INSUFFICIENT_EVIDENCE" | "UNRELATED_TRANSACTION" | "UNKNOWN",
  "explanation": "Clear, evidence-backed description of the likely reason for the exception.",
  "evidence": [
    {
      "type": "AMOUNT_DIFFERENCE" | "DATE_MATCH" | "REFERENCE_ALIGNMENT" | "TEXT_MATCH" | "OTHER",
      "value": any
    }
  ],
  "recommendation": "REVIEW" | "ESCALATE" | "NO_ACTION" | "REQUEST_EVIDENCE",
  "confidence": number (integer between 0 and 100 representing certainty),
  "required_human_action": boolean,
  "reasoning_summary": "Technical explanation of reasoning matching constraints.",
  "risk_flags": string[]
}
`;

export function buildInvestigationUserPrompt(input: AIExceptionResolverInput): string {
  const processorTx = input.processorRecord.transaction;
  const bankTx = input.bankRecord?.transaction;

  const context = {
    exception_record_id: input.reconciliationRecord?.processorRecord?.transaction?.id || "N/A",
    deterministic_status: input.deterministicStatus,
    deterministic_confidence: input.deterministicConfidence,
    processor_record: {
      id: processorTx.id,
      date: processorTx.transaction_date,
      description: processorTx.description,
      amount: processorTx.amount,
      currency: processorTx.currency,
      type: processorTx.type,
      reference: processorTx.raw_row_json?.reference || processorTx.raw_row_json?.utr || null,
    },
    bank_record: bankTx ? {
      id: bankTx.id,
      date: bankTx.transaction_date,
      description: bankTx.description,
      amount: bankTx.amount,
      currency: bankTx.currency,
      type: bankTx.type,
      reference: bankTx.raw_row_json?.reference || bankTx.raw_row_json?.utr || null,
    } : null,
    candidate_matches: input.candidateMatches.map(c => ({
      id: c.transaction.id,
      date: c.transaction.transaction_date,
      description: c.transaction.description,
      amount: c.transaction.amount,
      reference: c.transaction.raw_row_json?.reference || c.transaction.raw_row_json?.utr || null,
    })),
    deterministic_evidence: input.evidence,
    historical_context: input.historicalContext || null,
  };

  return `Please investigate the following reconciliation exception using only the provided facts:

${JSON.stringify(context, null, 2)}
`;
}
