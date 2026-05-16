export interface NormalizedTransaction {
  transaction_date: string | null;
  description: string;
  counterparty_name?: string;
  counterparty_email?: string;
  type: 'income' | 'expense' | 'transfer' | 'refund' | 'failed_payment' | 'vendor_payment' | 'subscription' | 'unknown';
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

const EXPENSE_KEYWORDS = [
  'google ads', 'meta ads', 'facebook ads', 'salary', 'payroll', 'rent', 
  'office supplies', 'vendor payment', 'invoice', 'subscription', 'software', 
  'aws', 'cloud', 'zoho', 'notion', 'slack', 'figma', 'canva', 'payment to', 
  'paid to', 'debit', 'purchase', 'expense', 'bill'
];

const INCOME_KEYWORDS = [
  'client payment', 'payment received', 'received', 'revenue', 'sales', 
  'payout', 'credit', 'deposit', 'refund received', 'invoice paid by client', 
  'customer payment'
];

const REFUND_KEYWORDS = ['refund', 'refunded', 'chargeback'];
const FAILED_KEYWORDS = ['failed', 'declined', 'bounced'];

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
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  const parts = str.split(/[/-]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0]);
    const p2 = parseInt(parts[1]);
    const p3 = parseInt(parts[2]);
    
    if (p1 > 12) {
      const d = new Date(p3, p2 - 1, p1);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } else if (p3 > 1000) {
      const d = new Date(p3, p1 - 1, p2);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }
  
  return null;
};

export const inferTransactionType = (amount: number, description: string): NormalizedTransaction['type'] => {
  const desc = description.toLowerCase();
  
  // 1. Refund keywords
  if (REFUND_KEYWORDS.some(k => desc.includes(k))) return 'refund';
  
  // 2. Failed keywords
  if (FAILED_KEYWORDS.some(k => desc.includes(k))) return 'failed_payment';
  
  // 3. Vendor payment specific
  if (desc.includes('vendor payment')) return 'vendor_payment';
  
  // 4. Expense keywords
  if (EXPENSE_KEYWORDS.some(k => desc.includes(k))) {
    if (desc.includes('subscription')) return 'subscription';
    return 'expense';
  }
  
  // 5. Income keywords
  if (INCOME_KEYWORDS.some(k => desc.includes(k))) return 'income';
  
  // 6. Amount sign fallback
  if (amount < 0) return 'expense';
  
  // 7. Unclear positive amount -> unknown (Don't assume income)
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
    
    // Type Inference Priority
    let type: NormalizedTransaction['type'] = 'unknown';
    
    if (mapping.type && row[mapping.type]) {
      // Explicit column exists
      const val = row[mapping.type].toLowerCase();
      if (val.includes('income') || val.includes('credit')) type = 'income';
      else if (val.includes('expense') || val.includes('debit')) type = 'expense';
      else if (val.includes('transfer')) type = 'transfer';
      else if (val.includes('refund')) type = 'refund';
      else type = inferTransactionType(amount, description);
    } else {
      type = inferTransactionType(amount, description);
    }

    return {
      transaction_date: date,
      description: description || 'Untitled Transaction',
      counterparty_name: row[mapping.counterparty_name],
      counterparty_email: row[mapping.counterparty_email],
      type: type,
      status: row[mapping.status],
      amount: Math.abs(amount), // We keep magnitude, type handles the sign
      currency: row[mapping.currency] || context.currency || 'INR',
      fee_amount: Math.abs(parseAmount(row[mapping.fee_amount])),
      net_amount: Math.abs(parseAmount(row[mapping.net_amount])),
      category: row[mapping.category],
      source_provider: context.provider,
      reference: row[mapping.reference] || row[mapping.external_id],
      external_id: row[mapping.external_id],
      raw_row_json: row,
      warnings_json: warnings
    };
  });
};
