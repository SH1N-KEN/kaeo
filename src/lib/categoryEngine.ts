/**
 * Kaeo Category Engine — v2 (Direction-Aware)
 *
 * KEY RULE: Direction overrides narration keywords.
 * - If direction is 'outflow', we never classify as Revenue/Income.
 * - If direction is 'inflow', we never classify as an expense.
 *
 * Does NOT make network calls — safe to use anywhere in the app.
 */

// ── Full category taxonomy ──────────────────────────────────────────────────

// Inflow categories
export type InflowCategory =
  | 'Customer Payment / Revenue'
  | 'Refunds / Recoveries'
  | 'Interest Income'
  | 'Capital / Owner Infusion'
  | 'Loan Received'
  | 'Transfer In'
  | 'Unknown Income';

// Outflow categories
export type OutflowCategory =
  | 'Payroll / Salary'
  | 'Rent'
  | 'Utilities'
  | 'Software / SaaS'
  | 'Cloud / Hosting'
  | 'Marketing / Ads'
  | 'Payment Gateway'
  | 'Banking / Charges'
  | 'Taxes / Compliance'
  | 'Travel / Fuel'
  | 'Food / Meals'
  | 'Office Supplies'
  | 'Insurance'
  | 'Vendor Payment'
  | 'Contractor / Professional Services'
  | 'Transfer Out'
  | 'Cash Withdrawal'
  | 'Uncategorized Expense';

// Legacy / shared categories (kept for backward compat)
export type LegacyCategory =
  | 'Revenue / Sales'
  | 'Payments / Gateway'
  | 'Payroll'
  | 'Marketing'
  | 'Consulting / Services'
  | 'Rent / Utilities'
  | 'Uncategorized'
  | 'Unknown';

export type TransactionCategory = InflowCategory | OutflowCategory | LegacyCategory;

export const ALL_CATEGORIES: TransactionCategory[] = [
  // Inflow
  'Customer Payment / Revenue',
  'Refunds / Recoveries',
  'Interest Income',
  'Capital / Owner Infusion',
  'Loan Received',
  'Transfer In',
  'Unknown Income',
  // Outflow
  'Payroll / Salary',
  'Rent',
  'Utilities',
  'Software / SaaS',
  'Cloud / Hosting',
  'Marketing / Ads',
  'Payment Gateway',
  'Banking / Charges',
  'Taxes / Compliance',
  'Travel / Fuel',
  'Food / Meals',
  'Office Supplies',
  'Insurance',
  'Vendor Payment',
  'Contractor / Professional Services',
  'Transfer Out',
  'Cash Withdrawal',
  'Uncategorized Expense',
  // Legacy
  'Revenue / Sales',
  'Payments / Gateway',
  'Payroll',
  'Marketing',
  'Consulting / Services',
  'Rent / Utilities',
  'Uncategorized',
  'Unknown',
];

// ── Refund / reversal keywords ───────────────────────────────────────────────
const REFUND_KEYWORDS = [
  'refund', 'reversal', 'cashback', 'reimburs', 'recovery', 'returned',
  'chargeback', 'upiret', 'upi ret', 'trf ret', 'ret neft', 'rev '
];

// ── Transfer keywords ────────────────────────────────────────────────────────
const TRANSFER_KEYWORDS = [
  'self transfer', 'own account', 'sweep', 'fd booking', 'fd maturity',
  'opening balance', 'closing balance', 'internal transfer', 'balance transfer'
];

// ── Bank charge keywords ─────────────────────────────────────────────────────
const BANK_CHARGE_KEYWORDS = [
  'amb chrg', 'sms chg', 'bank charge', 'bank fee', 'annual fee', 'locker',
  'demat', 'imps charge', 'neft charge', 'rtgs charge', 'commission',
  'alert chg', 'dc intl pos', 'forex markup', 'service charge', 'overdraft'
];

// ── Outflow category rule table (order matters — specific first) ─────────────
const OUTFLOW_RULES: Array<{ category: OutflowCategory; keywords: string[] }> = [
  {
    category: 'Payroll / Salary',
    keywords: ['salary', 'payroll', 'wages', 'stipend', 'bonus', 'monthly pay', 'staff payment', 'hr payment', 'employee pay', 'salaries'],
  },
  {
    category: 'Rent',
    keywords: ['rent', 'office rent', 'lease payment', 'rental'],
  },
  {
    category: 'Utilities',
    keywords: ['electricity', 'water bill', 'internet', 'broadband', 'utility', 'co-working', 'wifi', 'mobile recharge', 'data plan'],
  },
  {
    category: 'Cloud / Hosting',
    keywords: ['aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'cloudflare', 'digitalocean', 'supabase', 'render', 'railway', 'netlify', 'hetzner', 'linode', 'vultr'],
  },
  {
    category: 'Software / SaaS',
    keywords: ['github', 'gitlab', 'vercel', 'notion', 'slack', 'zoom', 'microsoft', 'google workspace', 'canva', 'figma', 'adobe', 'atlassian', 'jira', 'linear', 'dropbox', 'hubspot', 'salesforce', 'asana', 'trello', 'intercom', 'zendesk', 'postman', 'loom', 'grammarly', 'airtable', 'miro', 'webflow', 'godaddy', 'claude', 'anthropic', 'openai', 'saas', 'subscription', 'software'],
  },
  {
    category: 'Marketing / Ads',
    keywords: ['google ads', 'meta ads', 'facebook ads', 'instagram ads', 'linkedin ads', 'adwords', 'marketing spend', 'ad campaign', 'campaign spend', 'twitter ads', 'youtube ads', 'bing ads', 'sponsored', 'influencer'],
  },
  {
    category: 'Payment Gateway',
    keywords: ['razorpay', 'stripe', 'paypal', 'payment gateway', 'merchant fee', 'gateway fee', 'processing fee', 'cashfree', 'payu', 'instamojo', 'billdesk', 'juspay', 'ccavenue'],
  },
  {
    category: 'Taxes / Compliance',
    keywords: ['gst', 'tds', 'income tax', 'tax payment', 'compliance', 'tax filing', 'roc fee', 'mca fee', 'advance tax', 'tcs', 'customs duty', 'professional tax', 'itr', 'filing fee'],
  },
  {
    category: 'Banking / Charges',
    keywords: ['bank charge', 'service charge', 'bank fee', 'annual fee', 'imps charge', 'neft charge', 'rtgs charge', 'wire fee', 'overdraft fee', 'account maintenance', 'bank commission', 'transaction charge', 'demat', 'locker', 'insurance premium', 'lic premium', 'emi debit', 'loan emi'],
  },
  {
    category: 'Travel / Fuel',
    keywords: ['travel', 'hotel', 'flight', 'airfare', 'taxi', 'uber', 'ola', 'airline', 'booking.com', 'airbnb', 'cleartrip', 'makemytrip', 'indigo', 'spicejet', 'irctc', 'cab', 'boarding', 'visa fee', 'airport', 'petrol', 'fuel', 'diesel', 'iocl', 'hpcl', 'bpcl', 'nammayatri'],
  },
  {
    category: 'Food / Meals',
    keywords: ['swiggy', 'zomato', 'restaurant', 'food', 'meals', 'eatsure', 'blinkit', 'fudr', 'cafe', 'canteen', 'breakfast', 'lunch', 'dinner'],
  },
  {
    category: 'Office Supplies',
    keywords: ['office supplies', 'stationery', 'stationary', 'printer', 'paper ', 'notebook', 'desk', 'chair', 'office equipment', 'office furniture'],
  },
  {
    category: 'Insurance',
    keywords: ['insurance', 'lic ', 'hdfc life', 'max life', 'icici prudential', 'sbi life', 'star health', 'health insurance', 'term plan', 'mediclaim'],
  },
  {
    category: 'Contractor / Professional Services',
    keywords: ['consulting', 'professional fee', 'retainer', 'agency fee', 'freelancer', 'contractor', 'outsourcing', 'advisory', 'legal fee', 'audit fee', 'management consulting'],
  },
  {
    category: 'Vendor Payment',
    keywords: ['vendor payment', 'vendor pay', 'supplier payment', 'purchase', 'invoice payment', 'bill payment'],
  },
  {
    category: 'Cash Withdrawal',
    keywords: ['cash wdl', 'cash withdrawal', 'atm withdrawal', 'cdm cash'],
  },
];

/**
 * Infer a human-readable category from transaction description, vendor, type, and direction.
 *
 * @param description - Transaction description/narration
 * @param vendor      - Optional vendor/counterparty name
 * @param type        - Transaction type ('income', 'expense', 'refund', 'transfer', 'bank_charge', etc.)
 * @param direction   - Cash direction ('inflow'|'outflow'|'unknown')
 */
export function inferTransactionCategory(
  description: string,
  vendor?: string | null,
  type?: string | null,
  direction: 'inflow' | 'outflow' | 'unknown' = 'unknown'
): string {
  const t = type?.toLowerCase() ?? '';
  const haystack = `${description} ${vendor ?? ''}`.toLowerCase();

  // ── Resolve effective direction ──────────────────────────────────────────
  // If explicit direction provided, use it. Otherwise infer from type.
  let effectiveDir = direction;
  if (effectiveDir === 'unknown') {
    if (['income', 'refund'].includes(t)) effectiveDir = 'inflow';
    else if (['expense', 'vendor_payment', 'subscription', 'bank_charge'].includes(t)) effectiveDir = 'outflow';
    else if (t === 'transfer') effectiveDir = 'unknown'; // transfers can go either way
  }

  // ── 1. Transfer type ─────────────────────────────────────────────────────
  if (t === 'transfer' || TRANSFER_KEYWORDS.some(k => haystack.includes(k))) {
    return effectiveDir === 'inflow' ? 'Transfer In' : 'Transfer Out';
  }

  // ── 2. Bank charge type ──────────────────────────────────────────────────
  if (t === 'bank_charge' || (effectiveDir === 'outflow' && BANK_CHARGE_KEYWORDS.some(k => haystack.includes(k)))) {
    return 'Banking / Charges';
  }

  // ── 3. Explicit refund type ──────────────────────────────────────────────
  if (t === 'refund') {
    return 'Refunds / Recoveries';
  }

  // ── 4. Inflow direction → revenue-side categories ────────────────────────
  if (effectiveDir === 'inflow') {
    // Refund/reversal keyword on inflow
    if (REFUND_KEYWORDS.some(k => haystack.includes(k))) return 'Refunds / Recoveries';

    // Interest income
    if (['interest credit', 'interest earned', 'int credit', 'savings interest', 'fd interest'].some(k => haystack.includes(k))) {
      return 'Interest Income';
    }

    // Capital / Owner infusion
    if (['capital infus', 'owner capital', 'director loan', 'promoter', 'equity infusion'].some(k => haystack.includes(k))) {
      return 'Capital / Owner Infusion';
    }

    // Loan received
    if (['loan receiv', 'loan credit', 'disburs'].some(k => haystack.includes(k))) {
      return 'Loan Received';
    }

    // Default inflow = customer payment
    return 'Customer Payment / Revenue';
  }

  // ── 5. Outflow direction → expense-side categories ───────────────────────
  if (effectiveDir === 'outflow') {
    // GUARD: If type says income but direction says outflow → reclassify as expense
    // This prevents "Revenue / Sales" from appearing with negative amounts
    for (const rule of OUTFLOW_RULES) {
      if (rule.keywords.some(kw => haystack.includes(kw))) {
        return rule.category;
      }
    }
    return 'Uncategorized Expense';
  }

  // ── 6. Unknown direction: scan all categories ────────────────────────────
  // Check outflow rules first (expenses are more specific)
  for (const rule of OUTFLOW_RULES) {
    if (rule.keywords.some(kw => haystack.includes(kw))) {
      return rule.category;
    }
  }

  // Refund keywords with no direction
  if (REFUND_KEYWORDS.some(k => haystack.includes(k))) return 'Refunds / Recoveries';

  // Fallback by type
  if (t === 'income') return 'Customer Payment / Revenue';
  if (t === 'unknown') return 'Unknown';
  if (t === 'failed_payment') return 'Unknown';

  return 'Uncategorized';
}

/**
 * Returns the best display category for a transaction:
 * - If the stored category is meaningful, return it.
 * - Otherwise, infer from description/vendor/type/direction.
 */
export function getDisplayCategory(tx: {
  category?: string | null;
  description?: string | null;
  counterparty_name?: string | null;
  type?: string | null;
  amount?: number | null;
  direction?: string | null;
}): string {
  const stored = tx.category?.trim();
  const isEmpty =
    !stored ||
    stored === '' ||
    stored.toLowerCase() === 'uncategorized' ||
    stored.toLowerCase() === 'unknown' ||
    stored.toLowerCase() === 'generic' ||
    stored.toLowerCase() === 'null';

  if (!isEmpty) {
    return stored;
  }

  // Derive direction hint from amount if not stored
  let dir: 'inflow' | 'outflow' | 'unknown' = 'unknown';
  if (tx.direction === 'inflow') dir = 'inflow';
  else if (tx.direction === 'outflow') dir = 'outflow';
  else if (tx.amount !== null && tx.amount !== undefined) {
    dir = tx.amount > 0 ? 'inflow' : tx.amount < 0 ? 'outflow' : 'unknown';
  }

  return inferTransactionCategory(
    tx.description ?? '',
    tx.counterparty_name,
    tx.type,
    dir
  );
}

/**
 * Returns true if this category belongs to the income/inflow side.
 */
export function isInflowCategory(cat: string): boolean {
  const inflowCats = [
    'Customer Payment / Revenue', 'Revenue / Sales', 'Refunds / Recoveries',
    'Interest Income', 'Capital / Owner Infusion', 'Loan Received', 'Transfer In', 'Unknown Income'
  ];
  return inflowCats.includes(cat);
}

/**
 * Returns true if this category is a transfer (neither income nor expense).
 */
export function isTransferCategory(cat: string): boolean {
  return cat === 'Transfer In' || cat === 'Transfer Out';
}

/**
 * Returns the Tailwind class pair [bg, text] for a given category badge.
 * Deliberately low-saturation — no rainbow.
 */
export function getCategoryBadgeStyle(category: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (category) {
    case 'Customer Payment / Revenue':
    case 'Revenue / Sales':
    case 'Interest Income':
    case 'Capital / Owner Infusion':
    case 'Loan Received':
    case 'Unknown Income':
      return { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' };
    case 'Refunds / Recoveries':
      return { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' };
    case 'Transfer In':
    case 'Transfer Out':
      return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' };
    case 'Payroll / Salary':
    case 'Payroll':
      return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' };
    case 'Banking / Charges':
    case 'Taxes / Compliance':
      return { bg: 'bg-risk/10', text: 'text-risk', border: 'border-risk/20' };
    case 'Uncategorized Expense':
    case 'Uncategorized':
    case 'Unknown':
      return { bg: 'bg-muted/60', text: 'text-muted-foreground', border: 'border-border/50' };
    default:
      return { bg: 'bg-muted/40', text: 'text-foreground/70', border: 'border-border/40' };
  }
}
