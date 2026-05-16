import Papa from 'papaparse';

export interface ParseResult {
  headers: string[];
  rows: any[];
  rowCount: number;
  provider: string;
  sourceType: string;
  warnings: string[];
  errors: string[];
}

export const detectProvider = (headers: string[], _firstRows: any[], fileName: string): { provider: string; sourceType: string } => {
  const h = headers.map(s => s.toLowerCase());
  const name = fileName.toLowerCase();

  // Heuristics
  if (h.includes('razorpay_payment_id') || h.includes('payment id') && name.includes('razorpay')) {
    return { provider: 'Razorpay', sourceType: 'gateway' };
  }
  
  if (h.includes('stripe id') || h.includes('balance transaction id')) {
    return { provider: 'Stripe', sourceType: 'gateway' };
  }

  if (h.includes('order number') && h.includes('lineitem quantity')) {
    return { provider: 'Shopify', sourceType: 'ecommerce' };
  }

  if (h.includes('transaction date') && h.includes('withdrawal') && h.includes('deposit')) {
    return { provider: 'Bank Statement', sourceType: 'bank' };
  }

  if (h.includes('voucher number') || h.includes('ledger name')) {
    return { provider: 'Tally', sourceType: 'erp' };
  }

  return { provider: 'Generic Finance File', sourceType: 'other' };
};

export const parseCSV = (file: File): Promise<ParseResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data;
        const rowCount = rows.length;
        const warnings: string[] = [];
        const errors: string[] = [];

        if (headers.length === 0) errors.push('No headers detected in file.');
        if (rowCount === 0) errors.push('The file appears to be empty.');

        // Finance field validation
        const h = headers.map(s => s.toLowerCase());
        const hasDate = h.some(s => s.includes('date'));
        const hasAmount = h.some(s => s.includes('amount') || s.includes('value'));
        const hasDesc = h.some(s => s.includes('desc') || s.includes('narrat') || s.includes('particular'));

        if (!hasDate) warnings.push('Missing common date field.');
        if (!hasAmount) warnings.push('Missing common amount field.');
        if (!hasDesc) warnings.push('Missing common description field.');

        const { provider, sourceType } = detectProvider(headers, rows.slice(0, 5), file.name);

        resolve({
          headers,
          rows: rows.slice(0, 20), // Only return preview rows
          rowCount,
          provider,
          sourceType,
          warnings,
          errors
        });
      },
      error: (err) => {
        resolve({
          headers: [],
          rows: [],
          rowCount: 0,
          provider: 'Unknown',
          sourceType: 'unknown',
          warnings: [],
          errors: [`Parsing error: ${err.message}`]
        });
      }
    });
  });
};
