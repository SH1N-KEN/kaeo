import type { NormalizedTransaction } from '../types/finance';

/**
 * Normalization Engine Logic
 * Converts raw rows from various providers into Kaeo's standard NormalizedTransaction format.
 */

const KEYWORDS = {
  expense: [
    'ads', 'google', 'meta', 'facebook', 'invoice', 'service', 'office', 'supplies', 'rent', 
    'subscription', 'software', 'cloud', 'aws', 'azure', 'digitalocean', 'uber', 'ola', 
    'swiggy', 'zomato', 'utility', 'electricity', 'water', 'internet'
  ],
  vendor_payment: [
    'vendor', 'payment', 'payout', 'zenith', 'acme', 'corp', 'limited', 'services', 'consultant'
  ],
  income: [
    'revenue', 'income', 'customer', 'payment received', 'sales', 'credit', 'interest', 'dividend'
  ],
  refund: [
    'refund', 'reversal', 'cashback'
  ],
  failed: [
    'failed', 'declined', 'rejected', 'cancelled'
  ]
};

export const inferTransactionType = (description: string, amount: number): NormalizedTransaction['type'] => {
  const desc = description.toLowerCase();
  
  // Priority 1: Failed
  if (KEYWORDS.failed.some(k => desc.includes(k))) return 'failed';

  // Priority 2: Refund
  if (KEYWORDS.refund.some(k => desc.includes(k))) return 'refund';

  // Priority 3: Vendor Payment
  if (KEYWORDS.vendor_payment.some(k => desc.includes(k))) return 'vendor_payment';

  // Priority 4: General Expense
  if (KEYWORDS.expense.some(k => desc.includes(k))) return 'expense';

  // Priority 5: Income
  if (KEYWORDS.income.some(k => desc.includes(k))) return 'income';

  // Fallback to sign
  if (amount < 0) return 'expense';
  
  // If positive but no income keywords, we mark as unknown to prevent false revenue
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
    
    // Clean amount (remove symbols, handles strings)
    const cleanAmountStr = rawAmount?.toString().replace(/[^\d.-]/g, '') || '0';
    const amount = parseFloat(cleanAmountStr);
    
    const type = inferTransactionType(rawDesc, amount);
    
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
