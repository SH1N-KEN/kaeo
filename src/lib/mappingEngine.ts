import { suggestMappingWithAI, validateAIMappingResponse } from './ai/mappingAI';

/**
 * Mapping Engine Logic
 * Detects how raw file columns map to Kaeo's normalized schema.
 */

export const TARGET_FIELDS = [
  { id: 'transaction_date', label: 'Transaction Date', required: true },
  { id: 'description', label: 'Description', required: true },
  { id: 'amount', label: 'Single Amount Column', required: false },
  { id: 'debit', label: 'Debit (Expense/Withdrawal)', required: false },
  { id: 'credit', label: 'Credit (Income/Deposit)', required: false },
  { id: 'currency', label: 'Currency', required: false },
  { id: 'type', label: 'Transaction Type', required: false },
  { id: 'status', label: 'Status', required: false },
  { id: 'counterparty_name', label: 'Counterparty Name', required: false },
  { id: 'counterparty_email', label: 'Counterparty Email', required: false },
  { id: 'external_id', label: 'External ID', required: false },
  { id: 'category', label: 'Category', required: false },
  { id: 'fee_amount', label: 'Fee Amount', required: false },
  { id: 'net_amount', label: 'Net Amount', required: false },
  { id: 'reference', label: 'Reference/UTR', required: false },
];

export interface MappingSuggestion {
  mapping: Record<string, string>;
  confidence: number;
  status: 'ready_to_import' | 'review_mapping' | 'mapping_required';
  warnings: string[];
  source: 'rules' | 'ai' | 'manual';
}

/**
 * Rule-based mapping logic (Fallback and First-Pass)
 */
export const suggestMappingFromColumns = (headers: string[]): MappingSuggestion => {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));

  const findHeader = (keywords: string[]) => {
    return headers.find((_, i) => keywords.some(k => normalizedHeaders[i].includes(k)));
  };

  mapping['transaction_date'] = findHeader(['date', 'txndate', 'posteddate', 'transactiondate']) || '';
  mapping['description'] = findHeader(['description', 'narration', 'particulars', 'remarks', 'payee', 'vendor']) || '';
  
  // Look for separate debit/credit columns
  const debitCol = findHeader(['debit', 'withdrawal', 'out', 'payment', 'dr']);
  const creditCol = findHeader(['credit', 'deposit', 'in', 'receipt', 'cr']);

  if (debitCol && creditCol) {
    mapping['debit'] = debitCol;
    mapping['credit'] = creditCol;
  } else {
    mapping['amount'] = findHeader(['amount', 'value', 'transactionamount', 'total']) || '';
  }

  mapping['currency'] = findHeader(['currency', 'ccy']) || '';
  mapping['reference'] = findHeader(['reference', 'utr', 'refno', 'chequeno']) || '';

  const confidence = calculateMappingConfidence(mapping, headers);
  
  return {
    mapping,
    confidence,
    source: 'rules',
    status: confidence >= 0.85 ? 'ready_to_import' : confidence >= 0.5 ? 'review_mapping' : 'mapping_required',
    warnings: confidence < 0.85 ? ['Low mapping confidence. Review recommended.'] : []
  };
};

/**
 * Intelligent Mapping Orchestrator
 * Runs rules, then AI if needed, then validates.
 */
export const generateBestMapping = async (
  rawColumns: string[], 
  previewRows: any[], 
  fileName: string, 
  detectedProvider: string
): Promise<MappingSuggestion> => {
  
  // 1. Run Rule-based mapping first
  const ruleResult = suggestMappingFromColumns(rawColumns);
  console.log(`[Mapping Engine] Rules result: ${ruleResult.confidence * 100}% confidence`);

  // 2. If high confidence, return immediately
  if (ruleResult.confidence >= 0.85) {
    return ruleResult;
  }

  // 3. If low/medium confidence, attempt AI mapping
  const aiInput = {
    fileName,
    detectedProvider,
    rawColumns,
    previewRows,
    requiredFields: ['transaction_date', 'description'],
    optionalFields: TARGET_FIELDS.filter(f => f.id !== 'transaction_date' && f.id !== 'description').map(f => f.id),
  };

  const aiResponse = await suggestMappingWithAI(aiInput);

  if (aiResponse && validateAIMappingResponse(aiResponse)) {
    console.log(`[Mapping Engine] AI result: ${aiResponse.confidence * 100}% confidence`);
    
    // Validate AI result strictly with code
    const aiConfidence = calculateMappingConfidence(aiResponse.column_mapping, rawColumns);
    
    if (aiConfidence >= 0.85) {
      return {
        mapping: aiResponse.column_mapping,
        confidence: aiConfidence,
        source: 'ai',
        status: 'ready_to_import',
        warnings: aiResponse.warnings
      };
    }
    
    // If AI is better than rules but still not high confidence
    if (aiConfidence > ruleResult.confidence) {
      return {
        mapping: aiResponse.column_mapping,
        confidence: aiConfidence,
        source: 'ai',
        status: 'review_mapping',
        warnings: aiResponse.warnings
      };
    }
  }

  // 4. Fallback to rules if AI is unavailable or less confident
  return ruleResult;
};

export const calculateMappingConfidence = (mapping: Record<string, string>, headers: string[]): number => {
  let score = 0;
  
  // Date is 40% of confidence
  if (mapping['transaction_date'] && headers.includes(mapping['transaction_date'])) score += 0.4;
  
  // Description is 40% of confidence
  if (mapping['description'] && headers.includes(mapping['description'])) score += 0.4;
  
  // Amount or separate Debit+Credit is 20% of confidence
  const hasAmount = mapping['amount'] && headers.includes(mapping['amount']);
  const hasDebitCredit = mapping['debit'] && headers.includes(mapping['debit']) && mapping['credit'] && headers.includes(mapping['credit']);
  
  if (hasAmount || hasDebitCredit) {
    score += 0.2;
  }

  // Bonus for optional fields (capped at +20%)
  const optionalFields = TARGET_FIELDS.filter(f => f.id !== 'transaction_date' && f.id !== 'description' && f.id !== 'amount' && f.id !== 'debit' && f.id !== 'credit');
  const optionalScore = optionalFields.reduce((acc, f) => {
    return acc + (mapping[f.id] && headers.includes(mapping[f.id]) ? 0.04 : 0);
  }, 0);

  return Math.min(1, score + optionalScore);
};

export const validateMapping = (mapping: Record<string, string>): string[] => {
  const errors: string[] = [];
  
  if (!mapping['transaction_date']) {
    errors.push('Missing required field: Transaction Date');
  }
  if (!mapping['description']) {
    errors.push('Missing required field: Description');
  }
  
  const hasAmount = Boolean(mapping['amount']);
  const hasDebitCredit = Boolean(mapping['debit'] && mapping['credit']);
  
  if (!hasAmount && !hasDebitCredit) {
    errors.push('Missing required field: Single Amount Column (or both Debit and Credit columns must be mapped)');
  }

  return errors;
};
