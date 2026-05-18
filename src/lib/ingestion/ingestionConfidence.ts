/**
 * Combined parser and mapping confidence system.
 * Returns a score between 0 and 1.
 */

export interface ParserConfidenceInput {
  fileType: 'csv' | 'xlsx' | 'pdf';
  headers: string[];
  cleanRowsCount: number;
  mapping: Record<string, string>;
  warningsCount: number;
}

export const calculateParserConfidence = (input: ParserConfidenceInput): number => {
  const { fileType, headers, cleanRowsCount, mapping, warningsCount } = input;

  if (cleanRowsCount === 0) return 0;

  // PDFs are automatically forced to low-confidence in the baseline system
  if (fileType === 'pdf') return 0.25;

  let score = 0.4; // Base score for a parseable file structure

  // 1. Core target mappings presence
  const hasDate = !!mapping['transaction_date'] && headers.includes(mapping['transaction_date']);
  const hasDesc = !!mapping['description'] && headers.includes(mapping['description']);
  
  // Amount can be direct OR separate debit/credit
  const hasAmount = !!mapping['amount'] && headers.includes(mapping['amount']);
  const hasDebitCredit = (!!mapping['debit'] && headers.includes(mapping['debit'])) || 
                         (!!mapping['credit'] && headers.includes(mapping['credit']));

  if (hasDate) score += 0.2;
  if (hasDesc) score += 0.2;
  if (hasAmount || hasDebitCredit) score += 0.2;

  // Bonus for optional mappings
  const optionalKeys = ['currency', 'reference', 'type', 'counterparty_name'];
  optionalKeys.forEach(key => {
    if (mapping[key] && headers.includes(mapping[key])) {
      score += 0.03;
    }
  });

  // Deduct for warnings
  score -= (warningsCount * 0.05);

  // Bounds checking
  return Math.max(0.1, Math.min(1.0, score));
};
