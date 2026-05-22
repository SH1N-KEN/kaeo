/**
 * Kaeo Category Engine
 *
 * Deterministic keyword-based category inference for transactions.
 * Outputs clean human-readable category names for display.
 * Does NOT make network calls — safe to use anywhere in the app.
 */

export type TransactionCategory =
  | 'Software / SaaS'
  | 'Cloud / Hosting'
  | 'Payments / Gateway'
  | 'Payroll'
  | 'Marketing'
  | 'Office Supplies'
  | 'Travel'
  | 'Consulting / Services'
  | 'Rent / Utilities'
  | 'Banking / Charges'
  | 'Taxes / Compliance'
  | 'Refunds / Recoveries'
  | 'Revenue / Sales'
  | 'Uncategorized';

export const ALL_CATEGORIES: TransactionCategory[] = [
  'Software / SaaS',
  'Cloud / Hosting',
  'Payments / Gateway',
  'Payroll',
  'Marketing',
  'Office Supplies',
  'Travel',
  'Consulting / Services',
  'Rent / Utilities',
  'Banking / Charges',
  'Taxes / Compliance',
  'Refunds / Recoveries',
  'Revenue / Sales',
  'Uncategorized',
];

// ── Keyword rule table ──────────────────────────────────────────────────────
// Order matters: more specific rules first to prevent false matches.

const CATEGORY_RULES: Array<{
  category: TransactionCategory;
  keywords: string[];
}> = [
  {
    category: 'Refunds / Recoveries',
    keywords: [
      'refund', 'refunded', 'reversal', 'cashback', 'reimbursement',
      'recovery', 'returned', 'chargeback', 'reversal credit',
    ],
  },
  {
    category: 'Cloud / Hosting',
    keywords: [
      'aws', 'amazon web services', 'azure', 'gcp', 'google cloud',
      'cloudflare', 'digitalocean', 'supabase', 'render', 'railway',
      'netlify', 'hetzner', 'linode', 'vultr',
    ],
  },
  {
    category: 'Software / SaaS',
    keywords: [
      'github', 'gitlab', 'vercel', 'notion', 'slack', 'zoom',
      'microsoft', 'google workspace', 'canva', 'figma', 'adobe',
      'atlassian', 'jira', 'linear', 'dropbox', 'hubspot', 'salesforce',
      'asana', 'trello', 'intercom', 'zendesk', 'postman', 'loom',
      'grammarly', 'airtable', 'miro', 'webflow', 'stripe atlas',
      'software subscription', 'saas',
    ],
  },
  {
    category: 'Payments / Gateway',
    keywords: [
      'razorpay', 'stripe', 'paypal', 'payment gateway', 'payout',
      'settlement', 'merchant fee', 'payment processing', 'gateway fee',
      'transaction fee', 'processing fee', 'cashfree', 'paytm gateway',
      'payu', 'instamojo',
    ],
  },
  {
    category: 'Marketing',
    keywords: [
      'google ads', 'meta ads', 'facebook ads', 'instagram ads',
      'linkedin ads', 'adwords', 'marketing spend', 'ad campaign',
      'campaign spend', 'twitter ads', 'youtube ads', 'bing ads',
      'display ads', 'sponsored', 'influencer', 'seo', 'sem',
    ],
  },
  {
    category: 'Payroll',
    keywords: [
      'salary', 'payroll', 'wages', 'employee payment', 'stipend',
      'consultant salary', 'monthly salary', 'pay slip', 'hr payment',
      'staff payment', 'wage transfer',
    ],
  },
  {
    category: 'Travel',
    keywords: [
      'travel', 'hotel', 'flight', 'airfare', 'taxi', 'uber', 'ola',
      'card travel desk', 'airline', 'booking.com', 'airbnb', 'cleartrip',
      'makemytrip', 'indigo', 'spicejet', 'irctc', 'train ticket',
      'cab', 'boarding', 'transit', 'visa fee', 'airport',
    ],
  },
  {
    category: 'Office Supplies',
    keywords: [
      'office supplies', 'urban office supplies', 'stationary', 'stationery',
      'printer', 'supplies', 'pen ', 'paper ', 'notebook', 'desk', 'chair',
      'office equipment', 'office furniture', 'supplies purchase',
    ],
  },
  {
    category: 'Consulting / Services',
    keywords: [
      'consulting', 'professional fee', 'retainer', 'agency fee',
      'vendor services', 'acme services', 'bluepine consulting',
      'freelancer', 'contractor', 'outsourcing', 'advisory',
      'management consulting', 'legal fee', 'audit fee',
    ],
  },
  {
    category: 'Rent / Utilities',
    keywords: [
      'rent', 'electricity', 'water bill', 'internet', 'broadband',
      'utility', 'co-working', 'office rent', 'lease', 'maintenance',
      'wifi bill', 'data plan', 'mobile recharge',
    ],
  },
  {
    category: 'Banking / Charges',
    keywords: [
      'bank charge', 'service charge', 'bank fee', 'annual fee',
      'imps charge', 'neft charge', 'rtgs charge', 'wire fee',
      'overdraft fee', 'account maintenance', 'bank commission',
      'transaction charge', 'demat', 'locker',
    ],
  },
  {
    category: 'Taxes / Compliance',
    keywords: [
      'gst', 'tds', 'income tax', 'tax payment', 'compliance',
      'tax filing', 'roc fee', 'mca fee', 'advance tax', 'tcs',
      'customs duty', 'excise', 'professional tax', 'itr',
    ],
  },
  {
    category: 'Revenue / Sales',
    keywords: [
      'customer payment', 'invoice paid', 'sales receipt', 'revenue',
      'client payment received', 'payment received from', 'received payment',
      'invoice settlement', 'project payment', 'subscription revenue',
    ],
  },
];

/**
 * Infer a human-readable category from transaction description, vendor, and type.
 *
 * @param description - Transaction description/narration
 * @param vendor - Optional vendor/counterparty name
 * @param type - Transaction type ('income', 'expense', 'refund', 'unknown', etc.)
 * @returns TransactionCategory string
 */
export function inferTransactionCategory(
  description: string,
  vendor?: string | null,
  type?: string | null
): TransactionCategory {
  const t = type?.toLowerCase() ?? '';

  // 1. Income type always → Revenue / Sales (unless refund keywords found)
  if (t === 'income') {
    const combined = `${description} ${vendor ?? ''}`.toLowerCase();
    const isRefund = CATEGORY_RULES[0].keywords.some(k => combined.includes(k));
    return isRefund ? 'Refunds / Recoveries' : 'Revenue / Sales';
  }

  // 2. Explicit refund type
  if (t === 'refund') {
    return 'Refunds / Recoveries';
  }

  // 3. Unknown type stays Uncategorized
  if (t === 'unknown' || t === 'failed_payment') {
    return 'Uncategorized';
  }

  // 4. Keyword scan for expense types (expense, vendor_payment, subscription, etc.)
  const haystack = `${description} ${vendor ?? ''}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(kw => haystack.includes(kw))) {
      return rule.category;
    }
  }

  // 5. Fallback
  return 'Uncategorized';
}

/**
 * Returns the best display category for a transaction:
 * - If the stored category is meaningful, return it.
 * - Otherwise, infer from description/vendor/type.
 */
export function getDisplayCategory(tx: {
  category?: string | null;
  description?: string | null;
  counterparty_name?: string | null;
  type?: string | null;
}): TransactionCategory {
  const stored = tx.category?.trim();
  const isEmpty =
    !stored ||
    stored === '' ||
    stored.toLowerCase() === 'uncategorized' ||
    stored.toLowerCase() === 'unknown' ||
    stored.toLowerCase() === 'generic' ||
    stored.toLowerCase() === 'null';

  if (!isEmpty) {
    // Return stored value cast to TransactionCategory if it's a valid one,
    // otherwise fall through to inference.
    if (ALL_CATEGORIES.includes(stored as TransactionCategory)) {
      return stored as TransactionCategory;
    }
  }

  return inferTransactionCategory(
    tx.description ?? '',
    tx.counterparty_name,
    tx.type
  );
}

/**
 * Returns the Tailwind class pair [bg, text] for a given category badge.
 * Deliberately low-saturation — no rainbow.
 */
export function getCategoryBadgeStyle(category: TransactionCategory): {
  bg: string;
  text: string;
  border: string;
} {
  switch (category) {
    case 'Revenue / Sales':
      return { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' };
    case 'Refunds / Recoveries':
      return { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' };
    case 'Payroll':
      return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' };
    case 'Banking / Charges':
    case 'Taxes / Compliance':
      return { bg: 'bg-risk/10', text: 'text-risk', border: 'border-risk/20' };
    case 'Uncategorized':
      return { bg: 'bg-muted/60', text: 'text-muted-foreground', border: 'border-border/50' };
    default:
      return { bg: 'bg-muted/40', text: 'text-foreground/70', border: 'border-border/40' };
  }
}
