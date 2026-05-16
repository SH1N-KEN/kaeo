export interface NormalizedTransaction {
  transaction_date: string | null;
  description: string;
  counterparty_name?: string;
  counterparty_email?: string;
  type: 'income' | 'expense' | 'transfer' | 'refund' | 'failed_payment' | 'unknown';
  status?: string;
  amount: number;
  currency: string;
  fee_amount?: number;
  net_amount?: number;
  category?: string;
  source_provider?: string;
  reference?: string;
  external_id?: string;
  raw_row_json: any;
  warnings_json: string[];
}

export const parseAmount = (value: any): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  // Clean string: remove ₹, commas, spaces
  let cleaned = value.toString().replace(/[₹,\s]/g, '');
  
  // Handle parentheses (5000) -> -5000
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.substring(1, cleaned.length - 1);
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const parseTransactionDate = (value: any): string | null => {
  if (!value) return null;
  
  const str = value.toString().trim();
  
  // Try ISO format first
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  // Handle DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[/-]/);
  if (parts.length === 3) {
    // Basic heuristic: if first part > 12, it's likely DD/MM/YYYY
    // This is simple for Phase 4; we can improve later.
    const p1 = parseInt(parts[0]);
    const p2 = parseInt(parts[1]);
    const p3 = parseInt(parts[2]);
    
    if (p1 > 12) {
      // Assume DD/MM/YYYY
      const d = new Date(p3, p2 - 1, p1);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } else if (p3 > 1000) {
      // Assume MM/DD/YYYY
      const d = new Date(p3, p1 - 1, p2);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }
  
  return null;
};

export const inferTransactionType = (amount: number, description: string): NormalizedTransaction['type'] => {
  const desc = description.toLowerCase();
  
  if (desc.includes('refund')) return 'refund';
  if (desc.includes('failed') || desc.includes('declined')) return 'failed_payment';
  if (desc.includes('transfer')) return 'transfer';
  
  if (amount > 0) return 'income';
  if (amount < 0) return 'expense';
  
  return 'unknown';
};

export const normalizeRows = (
  rows: any[], 
  mapping: Record<string, string>, 
  context: { provider?: string; currency?: string }
): NormalizedTransaction[] => {
  return rows.map(row => {
    const warnings: string[] = [];
    
    const rawAmount = row[mapping.amount];
    const amount = parseAmount(rawAmount);
    if (!rawAmount) warnings.push('Missing amount value');
    
    const rawDate = row[mapping.transaction_date];
    const date = parseTransactionDate(rawDate);
    if (!date) warnings.push(`Invalid date format: ${rawDate}`);
    
    const description = (row[mapping.description] || '').toString();
    if (!description) warnings.push('Missing description');
    
    const type = mapping.type ? (row[mapping.type]?.toString().toLowerCase() as any) : inferTransactionType(amount, description);

    return {
      transaction_date: date,
      description: description || 'Untitled Transaction',
      counterparty_name: row[mapping.counterparty_name],
      counterparty_email: row[mapping.counterparty_email],
      type: type || 'unknown',
      status: row[mapping.status],
      amount: amount,
      currency: row[mapping.currency] || context.currency || 'INR',
      fee_amount: parseAmount(row[mapping.fee_amount]),
      net_amount: parseAmount(row[mapping.net_amount]),
      category: row[mapping.category],
      source_provider: context.provider,
      reference: row[mapping.reference] || row[mapping.external_id],
      external_id: row[mapping.external_id],
      raw_row_json: row,
      warnings_json: warnings
    };
  });
};

export const validateNormalizedTransaction = (tx: NormalizedTransaction) => {
  const errors: string[] = [];
  if (!tx.description) errors.push('Missing description');
  if (tx.amount === 0 && !tx.raw_row_json[tx.description]) errors.push('Zero amount with no context');
  return errors;
};
