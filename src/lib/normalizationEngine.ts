import type { NormalizedTransaction } from '../types/finance';

/**
 * Normalization Engine Logic — v2 (Direction-First)
 *
 * KEY INVARIANT: Cash direction (debit/credit column) ALWAYS overrides narration keywords.
 * Narration is used only to sub-classify within the direction bucket.
 *
 * Direction model:
 *   direction = 'inflow'  → money came IN  (credit column populated)
 *   direction = 'outflow' → money went OUT (debit column populated)
 *   direction = 'unknown' → no column info, fall back to amount sign
 */

// ── Refund / Reversal keywords ─────────────────────────────────────────────
export const REFUND_KEYWORDS = [
  'refund', 'reversal', 'rev ', ' rev', 'chargeback', 'return', 'cashback',
  'reimburs', 'recovery', 'reversed', 'failed txn refund', 'upi return',
  'upiret', 'upi ret', 'trf ret', 'ret upi', 'ret neft', 'ret rtgs'
];

// ── Transfer keywords ────────────────────────────────────────────────────────
export const TRANSFER_KEYWORDS = [
  'self transfer', 'own account', 'own a/c', 'sweep', 'fd booking', 'fd maturity',
  'fd premature', 'loan transfer', 'loan disburs', 'opening balance', 'closing balance',
  'balance transfer', 'inter account', 'internal transfer', 'sweep in', 'sweep out',
  'trf to self', 'transfer to self'
];

// ── Bank charge keywords ─────────────────────────────────────────────────────
export const BANK_CHARGE_KEYWORDS = [
  'amb chrg', 'amb charge', 'sms chg', 'sms charge', 'bank charge', 'bank fee',
  'annual fee', 'locker charge', 'demat charge', 'imps charge', 'neft charge',
  'rtgs charge', 'wire fee', 'overdraft fee', 'account maintenance', 'commission',
  'alert chg', 'dc intl pos', 'forex markup', 'intl txn', 'insurance premium',
  'lic premium', 'premium deducted', 'bank commission', 'service charge',
  'processing fee', 'emi debit', 'loan emi', 'emi bounce'
];

// ── Salary / payroll keywords ────────────────────────────────────────────────
const SALARY_KEYWORDS = [
  'salary', 'payroll', 'wages', 'stipend', 'bonus', 'monthly pay', 'pay slip',
  'staff payment', 'wage transfer', 'employee pay', 'hr payment', 'salaries'
];

// ── Strong income phrases (only used when direction = inflow) ───────────────
const STRONG_INCOME_KEYWORDS = [
  'customer payment', 'client payment', 'payment received', 'invoice paid',
  'sales receipt', 'subscription revenue', 'invoice settlement', 'project payment',
  'revenue', 'payout', 'settlement received', 'proceeds'
];

// ── Failed / declined keywords ───────────────────────────────────────────────
const FAILED_KEYWORDS = [
  'failed', 'declined', 'rejected', 'cancelled', 'bounced', 'dishonoured',
  'dishonored', 'return unpaid', 'cheque return', 'chq return', 'ecs return'
];

// ── Interest keywords ────────────────────────────────────────────────────────
const INTEREST_KEYWORDS = [
  'int credit', 'int.credit', 'interest credit', 'interest earned',
  'interest received', 'int rec', 'interest income', 'savings interest',
  'fd interest', 'int paid', 'interest paid', 'int.paid', 'interest charged'
];

/**
 * Infer transaction type using direction-first logic.
 *
 * @param description - Raw narration text
 * @param amount      - Signed amount (negative = outflow)
 * @param rawType     - Optional raw type string from source file
 * @param direction   - Explicit direction derived from debit/credit columns
 */
export const inferTransactionType = (
  description: string,
  amount: number,
  rawType?: string,
  direction: 'inflow' | 'outflow' | 'unknown' = 'unknown'
): NormalizedTransaction['type'] => {
  const desc = description.toLowerCase();
  const rType = rawType?.toLowerCase() || '';

  // ── Resolve effective direction ──────────────────────────────────────────
  // If explicit direction provided, use it. Otherwise fall back to amount sign.
  let effectiveDirection: 'inflow' | 'outflow' | 'unknown';
  if (direction !== 'unknown') {
    effectiveDirection = direction;
  } else if (amount > 0) {
    effectiveDirection = 'inflow';
  } else if (amount < 0) {
    effectiveDirection = 'outflow';
  } else {
    effectiveDirection = 'unknown';
  }

  // ── 1. Failed / declined transactions (direction-agnostic) ───────────────
  if (FAILED_KEYWORDS.some(k => desc.includes(k))) return 'failed_payment';

  // ── 2. Transfer detection (direction-agnostic) ───────────────────────────
  if (TRANSFER_KEYWORDS.some(k => desc.includes(k))) return 'transfer';

  // ── 3. Bank charges (always outflow from bank's perspective) ────────────
  if (BANK_CHARGE_KEYWORDS.some(k => desc.includes(k))) {
    return effectiveDirection === 'inflow' ? 'income' : 'bank_charge';
  }

  // ── 4. Direction = INFLOW handling ──────────────────────────────────────
  if (effectiveDirection === 'inflow') {
    // Refund / reversal on an inflow = money came back to us
    if (REFUND_KEYWORDS.some(k => desc.includes(k))) return 'refund';

    // Interest credit
    if (INTEREST_KEYWORDS.some(k => desc.includes(k))) return 'income';

    // Salary inflow = someone reimbursed salary / received salary (rare, mark income)
    if (SALARY_KEYWORDS.some(k => desc.includes(k))) return 'income';

    // Strong income phrases
    if (STRONG_INCOME_KEYWORDS.some(k => desc.includes(k))) return 'income';

    // Default for any inflow = income (customer payment / credit)
    return 'income';
  }

  // ── 5. Direction = OUTFLOW handling ─────────────────────────────────────
  if (effectiveDirection === 'outflow') {
    // Refund keyword on an outflow = we're paying back a customer refund
    // Still an outflow expense (not revenue)
    if (REFUND_KEYWORDS.some(k => desc.includes(k))) return 'expense';

    // Salary / payroll outflow
    if (SALARY_KEYWORDS.some(k => desc.includes(k))) return 'expense';

    // Generic expense/vendor payment
    if (['subscription', 'monthly plan', 'annual plan', 'licence', 'license'].some(k => desc.includes(k))) {
      return 'subscription';
    }
    if (['vendor payment', 'payment to', 'paid to', 'supplier payment'].some(k => desc.includes(k))) {
      return 'vendor_payment';
    }

    return 'expense';
  }

  // ── 6. Unknown direction: fall back to keyword scan ──────────────────────
  if (REFUND_KEYWORDS.some(k => desc.includes(k)) && amount > 0) return 'refund';
  if (FAILED_KEYWORDS.some(k => desc.includes(k))) return 'failed_payment';
  if (SALARY_KEYWORDS.some(k => desc.includes(k)) && amount < 0) return 'expense';

  // Explicit type column signals
  if (['credit', 'deposit', 'cr', 'inflow'].some(k => rType === k || rType.includes(k))) return 'income';
  if (['debit', 'withdrawal', 'dr', 'outflow'].some(k => rType === k || rType.includes(k))) return 'expense';

  if (amount < 0) return 'expense';
  if (amount > 0) return 'income';

  return 'unknown';
};

/**
 * Legacy normalizeRows — kept for compatibility, uses single amount column.
 * New code should use normalizeIngestedRows from transactionNormalizer.ts.
 */
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
    const rawAmountStr = String(rawAmount || '0').trim().replace(/,/g, '').replace(/\s+/g, '');
    const cleanAmountStr = rawAmountStr.replace(/[^\d.-]/g, '');
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
