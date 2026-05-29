export type PaymentMethod =
  | 'bank_transfer'
  | 'upi'
  | 'card'
  | 'prepaid_card'
  | 'cash'
  | 'payment_gateway'
  | 'unknown'
  | 'other';

export type ProofStatus =
  | 'not_required'
  | 'missing'
  | 'attached'
  | 'needs_review';

/**
 * Detects the payment method based on transaction description.
 */
export function detectPaymentMethod(description: string): PaymentMethod {
  const desc = (description || '').toLowerCase();
  
  if (['upi', 'vpa', 'phonepe', 'gpay', 'google pay', 'paytm upi', 'npci'].some(k => desc.includes(k))) {
    return 'upi';
  }
  if (['card', 'debit card', 'credit card', 'pos'].some(k => desc.includes(k))) {
    return 'card';
  }
  if (['enkash', 'prepaid', 'corporate card'].some(k => desc.includes(k))) {
    return 'prepaid_card';
  }
  if (['cash'].some(k => desc.includes(k))) {
    return 'cash';
  }
  if (['razorpay', 'payu', 'cashfree', 'stripe', 'gateway'].some(k => desc.includes(k))) {
    return 'payment_gateway';
  }
  if (['neft', 'rtgs', 'imps', 'transfer'].some(k => desc.includes(k))) {
    return 'bank_transfer';
  }
  return 'unknown';
}

/**
 * Checks if the description suggests category "Staff / Petty Expenses".
 */
export function shouldSuggestStaffCategory(description: string): boolean {
  const desc = (description || '').toLowerCase();
  
  // Make sure it contains at least one keyword, but avoid overly general terms like just 'food' without some other context if possible, 
  // or return true only if it is a strong match.
  // The user prompt: "Staff / Petty Expenses category support: Infer softly from descriptions containing: staff, employee, petty, reimbursement, local purchase, office purchase, cash expense, travel claim, conveyance, meal, food, fuel, supplies. Do not over-classify aggressively. If confidence is low, do not auto-mark strongly. Prefer needs_review or leave category unchanged."
  
  // Let's check for strong matches:
  const strongKeywords = ['staff', 'employee', 'petty', 'reimbursement', 'local purchase', 'office purchase', 'cash expense', 'travel claim', 'conveyance'];
  const softKeywords = ['meal', 'food', 'fuel', 'supplies'];
  
  if (strongKeywords.some(k => desc.includes(k))) {
    return true;
  }
  
  // For soft keywords, we require secondary context like "purchase", "cash", "expense", "local", "petty", "reimb"
  if (softKeywords.some(k => desc.includes(k))) {
    return ['cash', 'expense', 'local', 'petty', 'reimb', 'office', 'staff', 'emp', 'claim', 'convey'].some(k => desc.includes(k));
  }
  
  return false;
}

/**
 * Infers if a transaction is a staff expense.
 */
export function inferStaffExpense(description: string, category: string | null): boolean {
  const desc = (description || '').toLowerCase();
  const cat = (category || '').toLowerCase();
  
  if (cat.includes('staff') || cat.includes('petty')) {
    return true;
  }
  
  // Examples:
  // - petty cash
  // - staff reimbursement
  // - employee travel
  // - local office purchase
  // - food/meal/conveyance/fuel/supplies with staff/petty context
  const hasStaffPettyContext = ['staff', 'employee', 'petty', 'reimbursement', 'local office', 'office purchase', 'travel claim'].some(k => desc.includes(k));
  if (hasStaffPettyContext) {
    return true;
  }
  
  const hasExpenseContext = ['meal', 'food', 'fuel', 'supplies', 'conveyance'].some(k => desc.includes(k));
  if (hasExpenseContext && ['reimb', 'cash', 'claim', 'petty', 'staff', 'employee'].some(k => desc.includes(k))) {
    return true;
  }
  
  return false;
}
