export interface MappingSuggestion {
  mapping: Record<string, string>;
  confidence: number;
  status: 'ready_to_import' | 'review_mapping' | 'mapping_required';
  warnings: string[];
}

export const TARGET_FIELDS = [
  { id: 'transaction_date', label: 'Transaction Date', required: true },
  { id: 'description', label: 'Description', required: true },
  { id: 'amount', label: 'Amount', required: true },
  { id: 'currency', label: 'Currency', required: false },
  { id: 'type', label: 'Type', required: false },
  { id: 'status', label: 'Status', required: false },
  { id: 'counterparty_name', label: 'Counterparty Name', required: false },
  { id: 'counterparty_email', label: 'Counterparty Email', required: false },
  { id: 'external_id', label: 'External ID', required: false },
  { id: 'category', label: 'Category', required: false },
  { id: 'fee_amount', label: 'Fee Amount', required: false },
  { id: 'net_amount', label: 'Net Amount', required: false },
  { id: 'reference', label: 'Reference/UTR', required: false },
  { id: 'payment_method', label: 'Payment Method', required: false },
  { id: 'invoice_id', label: 'Invoice ID', required: false },
  { id: 'order_id', label: 'Order ID', required: false },
  { id: 'product_name', label: 'Product Name', required: false },
  { id: 'tax_amount', label: 'Tax Amount', required: false },
];

const ALIASES: Record<string, string[]> = {
  transaction_date: [
    'date', 'transaction date', 'txn date', 'created', 'created_at', 
    'paid_at', 'payment date', 'order date', 'settlement date', 'period'
  ],
  description: [
    'description', 'narration', 'particulars', 'details', 'memo', 
    'note', 'merchant', 'vendor', 'counterparty', 'name', 'payment description'
  ],
  amount: [
    'amount', 'transaction amount', 'paid amount', 'gross', 'net', 
    'total', 'withdrawal', 'deposit', 'value', 'payment amount', 'balance'
  ],
  currency: ['currency', 'curr', 'currency_code', 'ccy', 'unit'],
  type: ['type', 'transaction_type', 'payment_type', 'event_type', 'debit_credit', 'dr_cr', 'kind'],
  status: ['status', 'payment_status', 'transaction_status', 'state', 'stage'],
  counterparty_name: ['customer', 'customer_name', 'vendor', 'vendor_name', 'merchant', 'supplier', 'party', 'counterparty', 'entity'],
  counterparty_email: ['email', 'customer_email', 'buyer_email', 'contact_email', 'mail'],
  external_id: [
    'id', 'transaction_id', 'txn_id', 'payment_id', 'order_id', 
    'reference', 'utr', 'ref_no', 'payment_ref', 'ref'
  ],
  category: ['category', 'cat', 'group', 'tag', 'labels'],
  fee_amount: ['fee', 'charge', 'tax', 'gst', 'commission'],
  net_amount: ['net', 'settle', 'net amount'],
  reference: ['reference', 'utr', 'ref_no', 'remark'],
  payment_method: ['payment_method', 'method', 'card', 'upi', 'bank', 'mode'],
  invoice_id: ['invoice', 'bill', 'invoice_id', 'invoice_no'],
  order_id: ['order', 'cart', 'order_id', 'order_no'],
  product_name: ['product', 'item', 'service', 'product_name'],
  tax_amount: ['tax', 'gst', 'vat', 'igst', 'cgst', 'sgst', 'tax_amount'],
};

export const suggestMappingFromColumns = (rawColumns: string[]): MappingSuggestion => {
  const mapping: Record<string, string> = {};
  const normalizedCols = rawColumns.map(c => c.toLowerCase().trim().replace(/[_-]/g, ' '));
  const warnings: string[] = [];

  // 1. Primary Mapping Logic
  TARGET_FIELDS.forEach(target => {
    const aliases = ALIASES[target.id] || [];
    
    let bestMatch = '';
    let highestScore = 0;

    rawColumns.forEach((originalCol, idx) => {
      const col = normalizedCols[idx];
      
      aliases.forEach(alias => {
        if (col === alias) {
          highestScore = 1.0;
          bestMatch = originalCol;
        } else if (col.includes(alias) && highestScore < 0.8) {
          highestScore = 0.8;
          bestMatch = originalCol;
        } else if (alias.includes(col) && highestScore < 0.6) {
          highestScore = 0.6;
          bestMatch = originalCol;
        }
      });
    });

    if (bestMatch) {
      mapping[target.id] = bestMatch;
    }
  });

  // 2. Specialized Logic (Debit/Credit handling)
  const hasDebit = normalizedCols.some(c => c === 'debit' || c === 'withdrawal');
  const hasCredit = normalizedCols.some(c => c === 'credit' || c === 'deposit');

  if (hasDebit && hasCredit && !mapping.amount) {
    warnings.push('Detected split Debit/Credit columns. Both will be processed.');
    // In this phase we map 'amount' to the primary value, 
    // but we note the presence of split columns for Phase 4.
  }

  // 3. Confidence Calculation
  const requiredFields = TARGET_FIELDS.filter(f => f.required);
  const requiredMapped = requiredFields.filter(f => mapping[f.id]).length;
  const optionalMapped = Object.keys(mapping).length - requiredMapped;
  
  // Base confidence on required fields (80% weight) and optional fields (20% weight)
  const requiredScore = requiredMapped / requiredFields.length;
  const optionalScore = Math.min(optionalMapped / 3, 1); // Cap optional contribution
  
  const rawConfidence = (requiredScore * 0.85) + (optionalScore * 0.15);
  const confidence = Math.round(rawConfidence * 100) / 100;

  // 4. Status Determination
  let status: MappingSuggestion['status'] = 'mapping_required';
  if (requiredMapped < requiredFields.length) {
    status = 'mapping_required';
    const missing = requiredFields.filter(f => !mapping[f.id]).map(f => f.label);
    warnings.push(`Missing required fields: ${missing.join(', ')}`);
  } else if (confidence >= 0.85) {
    status = 'ready_to_import';
  } else if (confidence >= 0.65) {
    status = 'review_mapping';
    warnings.push('Moderate confidence. Please review before importing.');
  } else {
    status = 'review_mapping';
    warnings.push('Low confidence. Manual mapping strongly recommended.');
  }

  return { mapping, confidence, status, warnings };
};

export const calculateMappingConfidence = (mapping: Record<string, string>, _rawColumns: string[]): number => {
  // Backwards compatibility helper
  const requiredFields = TARGET_FIELDS.filter(f => f.required);
  const requiredMapped = requiredFields.filter(f => mapping[f.id]).length;
  if (requiredMapped < requiredFields.length) return 30;
  
  const mappedCount = Object.keys(mapping).length;
  const score = (requiredMapped / requiredFields.length) * 0.8 + (mappedCount / TARGET_FIELDS.length) * 0.2;
  return Math.round(score * 100);
};

export const validateMapping = (mapping: Record<string, string>): string[] => {
  const errors: string[] = [];
  TARGET_FIELDS.forEach(f => {
    if (f.required && !mapping[f.id]) {
      errors.push(`Missing required field: ${f.label}`);
    }
  });
  return errors;
};
