export interface MappingSuggestion {
  targetField: string;
  sourceColumn: string | null;
  confidence: number;
}

export const TARGET_FIELDS = [
  { id: 'transaction_date', label: 'Transaction Date', required: true },
  { id: 'description', label: 'Description', required: true },
  { id: 'amount', label: 'Amount', required: true },
  { id: 'currency', label: 'Currency', required: false },
  { id: 'type', label: 'Type (Credit/Debit)', required: false },
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

const FUZZY_MATCHERS: Record<string, string[]> = {
  transaction_date: ['date', 'time', 'created', 'at', 'period'],
  description: ['desc', 'narrat', 'particular', 'note', 'remark'],
  amount: ['amount', 'value', 'price', 'total', 'withdrawal', 'deposit', 'debit', 'credit'],
  currency: ['curr', 'ccy', 'unit'],
  type: ['type', 'kind', 'method'],
  status: ['status', 'state', 'stage'],
  counterparty_name: ['name', 'merchant', 'vendor', 'customer', 'entity'],
  counterparty_email: ['email', 'mail'],
  external_id: ['id', 'ref', 'utr', 'transaction_id', 'payment_id'],
  category: ['cat', 'group', 'tag'],
  fee_amount: ['fee', 'charge', 'tax', 'gst'],
  net_amount: ['net', 'settle'],
  reference: ['ref', 'utr', 'remark'],
  payment_method: ['method', 'card', 'upi', 'bank'],
  invoice_id: ['invoice', 'bill'],
  order_id: ['order', 'cart'],
  product_name: ['product', 'item', 'service'],
  tax_amount: ['tax', 'gst', 'vat', 'igst', 'cgst', 'sgst'],
};

export const suggestMappingFromColumns = (rawColumns: string[]): Record<string, string> => {
  const mapping: Record<string, string> = {};
  const normalizedCols = rawColumns.map(c => c.toLowerCase());

  TARGET_FIELDS.forEach(target => {
    const matchers = FUZZY_MATCHERS[target.id] || [];
    
    // Find best match
    let bestMatchIndex = -1;
    let highestScore = 0;

    normalizedCols.forEach((col, idx) => {
      matchers.forEach(m => {
        if (col === m) {
          highestScore = 100;
          bestMatchIndex = idx;
        } else if (col.includes(m) && highestScore < 80) {
          highestScore = 80;
          bestMatchIndex = idx;
        }
      });
    });

    if (bestMatchIndex !== -1) {
      mapping[target.id] = rawColumns[bestMatchIndex];
    }
  });

  return mapping;
};

export const calculateMappingConfidence = (mapping: Record<string, string>, _rawColumns: string[]): number => {
  const mappedCount = Object.keys(mapping).length;
  const requiredFields = TARGET_FIELDS.filter(f => f.required);
  const requiredMapped = requiredFields.filter(f => mapping[f.id]).length;

  if (requiredMapped < requiredFields.length) return 30; // Low confidence if required fields missing
  
  const score = (requiredMapped / requiredFields.length) * 60 + (mappedCount / TARGET_FIELDS.length) * 40;
  return Math.min(Math.round(score), 100);
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
