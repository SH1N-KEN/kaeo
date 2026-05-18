import type { NormalizedTransaction } from '../types/finance';

/**
 * Normalization Engine Logic
 * Converts raw rows from various providers into Kaeo's standard NormalizedTransaction format.
 */

const KEYWORDS = {
  // Strong Income Phrases (Checked first)
  income_strong: [
    'client payment', 'customer payment', 'payment received', 'received from', 'received payment',
    'sales', 'revenue', 'payout', 'settlement received', 'invoice paid by client', 'credit', 'deposit',
    'inflow', 'received', 'cr', 'amount cr'
  ],
  // Vendor Specific Phrases
  vendor_strong: [
    'vendor payment', 'payment to', 'paid to'
  ],
  // Strong Expense Phrases
  expense_strong: [
    'google ads', 'meta ads', 'facebook ads', 'salary', 'payroll', 'rent', 'office supplies', 
    'subscription', 'software', 'aws', 'cloud', 'bill', 'purchase', 'expense', 'debit', 'invoice',
    'withdrawal', 'paid', 'payment', 'dr', 'amount dr', 'withdrawal dr', 'debit amount', 'outflow',
    'charges', 'fee', 'rtgs debit', 'neft debit', 'upi payment', 'imps payment'
  ],
  refund: [
    'refund', 'refunded', 'reversal', 'cashback', 'reimbursement', 'recovery', 'returned', 'chargeback'
  ],
  failed: [
    'failed', 'declined', 'rejected', 'cancelled', 'bounced'
  ]
};

export const inferTransactionType = (description: string, amount: number, rawType?: string): NormalizedTransaction['type'] => {
  const desc = description.toLowerCase();
  const rType = rawType?.toLowerCase() || '';

  // 1. Check refund/recovery FIRST (Task 3: Separated when description contains refund keywords)
  if (KEYWORDS.refund.some(k => desc.includes(k))) return 'refund';
  if (KEYWORDS.failed.some(k => desc.includes(k))) return 'failed_payment';

  // 2. Explicit debit/credit/type column if present (Task 5: type = expense if debit value, type = income or refund if credit value)
  if (['credit', 'income', 'received', 'deposit', 'cr', 'amount cr', 'inflow'].some(k => rType === k || rType.includes(k))) {
    return 'income';
  }
  if (['debit', 'expense', 'paid', 'withdrawal', 'dr', 'amount dr', 'withdrawal dr', 'debit amount', 'outflow'].some(k => rType === k || rType.includes(k))) {
    return 'expense';
  }

  // 3. Strong income phrases BEFORE generic payment phrases
  if (KEYWORDS.income_strong.some(k => desc.includes(k))) return 'income';

  // 4. Strong expense/vendor phrases
  if (KEYWORDS.vendor_strong.some(k => desc.includes(k))) return 'vendor_payment';
  if (KEYWORDS.expense_strong.some(k => desc.includes(k))) return 'expense';

  // 5. If amount is negative → expense
  if (amount < 0) return 'expense';
  
  // 6. If amount is positive but context is unclear → unknown, not income
  return 'unknown';
};

export const normalizeRows = (
  rows: any[], 
  mapping: Record<string, string>,
  context: { provider: string; currency: string }
): Omit<NormalizedTransaction, 'id' | 'organization_id' | 'client_id' | 'import_id' | 'file_id'>[] => {
  
  return rows.map(row => {
    const rawDate = row[mapping['transaction_date']];
    const rawDesc = row[mapping['description']] || '';
    const rawAmount = row[mapping['amount']];
    const rawType = mapping['type'] ? row[mapping['type']] : undefined;
    
    // Clean amount (remove symbols, handles strings)
    const cleanAmountStr = rawAmount?.toString().replace(/[^\d.-]/g, '') || '0';
    const amount = parseFloat(cleanAmountStr);
    
    const type = inferTransactionType(rawDesc, amount, rawType);
    
    return {
      transaction_date: new Date(rawDate).toISOString(),
      description: rawDesc,
      amount: amount,
      currency: context.currency,
      type: type,
      category: null,
      counterparty_name: null,
      source_provider: context.provider,
      raw_row_json: row
    };
  });
};
