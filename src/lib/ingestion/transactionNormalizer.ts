import { inferTransactionType } from '../normalizationEngine';

export interface NormalizerContext {
  provider: string;
  currency: string;
}

export interface NormalizationResult {
  transactions: any[];
  warnings: string[];
}

/**
 * Sanitizes numeric amount string, supporting parentheses, currency symbols, and DR/CR tags.
 */
export const cleanAmount = (val: any): { amount: number; isExpense: boolean; isIncome: boolean } => {
  if (val === null || val === undefined) {
    return { amount: 0, isExpense: false, isIncome: false };
  }

  let str = val.toString().trim().replace(/,/g, '');
  if (str === '') {
    return { amount: 0, isExpense: false, isIncome: false };
  }

  let isExpense = false;
  let isIncome = false;

  // 1. Parentheses format: (120.00) => expense
  if (str.startsWith('(') && str.endsWith(')')) {
    isExpense = true;
    str = str.slice(1, -1);
  }

  // 2. DR/CR suffixes
  if (str.toLowerCase().endsWith('dr')) {
    isExpense = true;
    str = str.slice(0, -2).trim();
  } else if (str.toLowerCase().endsWith('cr')) {
    isIncome = true;
    str = str.slice(0, -2).trim();
  }

  // 3. Clean symbols (currency signs etc)
  str = str.replace(/[^\d.-]/g, '');

  let amount = parseFloat(str);
  if (isNaN(amount)) {
    return { amount: 0, isExpense: false, isIncome: false };
  }

  if (isExpense) {
    amount = -Math.abs(amount);
  } else if (isIncome) {
    amount = Math.abs(amount);
  }

  return { amount, isExpense, isIncome };
};

/**
 * Parses diverse date formats reliably, including Indian formats (DD/MM/YYYY, DD-MM-YYYY, DD Mon YYYY).
 * Returns { date: Date; ambiguous: boolean; error: boolean }
 */
export const parseIngestedDate = (val: any): { date: Date; ambiguous: boolean; error: boolean } => {
  if (!val) return { date: new Date(), ambiguous: false, error: true };

  // If already parsed as a Date object or numeric Excel serial
  if (val instanceof Date) {
    return { date: val, ambiguous: false, error: false };
  }

  const str = val.toString().trim();
  
  // 1. Check if ISO-like YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return { date: isNaN(d.getTime()) ? new Date() : d, ambiguous: false, error: isNaN(d.getTime()) };
  }

  // 2. Check for DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY
  const delimiterMatch = str.match(/^(\d{1,2})([-/])(\d{1,2})[-/](\d{4})/);
  if (delimiterMatch) {
    const p1 = parseInt(delimiterMatch[1], 10);
    const p2 = parseInt(delimiterMatch[3], 10);
    const year = parseInt(delimiterMatch[4], 10);

    // If part 1 is greater than 12, it is definitely DD/MM/YYYY
    if (p1 > 12) {
      const d = new Date(year, p2 - 1, p1);
      return { date: d, ambiguous: false, error: isNaN(d.getTime()) };
    }
    
    // If part 2 is greater than 12, it is definitely MM/DD/YYYY
    if (p2 > 12) {
      const d = new Date(year, p1 - 1, p2);
      return { date: d, ambiguous: false, error: isNaN(d.getTime()) };
    }

    // Both are <= 12: Ambiguous! Default to standard Indian DD/MM/YYYY, but mark ambiguous
    const d = new Date(year, p2 - 1, p1);
    return { date: d, ambiguous: true, error: isNaN(d.getTime()) };
  }

  // 3. Check for word months: e.g. "12 May 2026" or "12-May-2026"
  const wordMonthMatch = str.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{4})/);
  if (wordMonthMatch) {
    const day = parseInt(wordMonthMatch[1], 10);
    const monthStr = wordMonthMatch[2];
    const year = parseInt(wordMonthMatch[3], 10);

    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIdx = monthNames.findIndex(m => monthStr.toLowerCase().startsWith(m));

    if (monthIdx !== -1) {
      const d = new Date(year, monthIdx, day);
      return { date: d, ambiguous: false, error: isNaN(d.getTime()) };
    }
  }

  // Standard fallback
  const d = new Date(str);
  return { date: isNaN(d.getTime()) ? new Date() : d, ambiguous: false, error: isNaN(d.getTime()) };
};

/**
 * Core Normalizer Function for Phase 12A
 */
export const normalizeIngestedRows = (
  rows: any[],
  mapping: Record<string, string>,
  context: NormalizerContext
): NormalizationResult => {
  const warnings: string[] = [];
  const transactions: any[] = [];
  let dateAmbiguityCount = 0;

  rows.forEach((row, index) => {
    // 1. Resolve date
    const rawDate = row[mapping['transaction_date']];
    const { date, ambiguous, error: dateError } = parseIngestedDate(rawDate);

    if (dateError) {
      warnings.push(`Row ${index + 1}: Skipping due to unparseable transaction date.`);
      return;
    }

    if (ambiguous) {
      dateAmbiguityCount++;
    }

    // 2. Resolve amount & direction
    let amount = 0;
    let explicitExpense = false;
    let explicitIncome = false;

    // Check if separate debit/credit columns are mapped
    const debitCol = mapping['debit'];
    const creditCol = mapping['credit'];

    if (debitCol || creditCol) {
      let parsedDebit = 0;
      let parsedCredit = 0;
      let hasDebit = false;
      let hasCredit = false;

      if (debitCol && row[debitCol] !== undefined && row[debitCol] !== null) {
        const valStr = row[debitCol].toString().trim();
        // Ignore standard placeholders like '-', '0', '0.00'
        if (valStr !== '' && valStr !== '-' && valStr !== '0' && valStr !== '0.00') {
          const { amount: rawAmt } = cleanAmount(row[debitCol]);
          const absAmt = Math.abs(rawAmt);
          if (absAmt > 0) {
            parsedDebit = absAmt;
            hasDebit = true;
          }
        }
      }

      if (creditCol && row[creditCol] !== undefined && row[creditCol] !== null) {
        const valStr = row[creditCol].toString().trim();
        // Ignore standard placeholders like '-', '0', '0.00'
        if (valStr !== '' && valStr !== '-' && valStr !== '0' && valStr !== '0.00') {
          const { amount: rawAmt } = cleanAmount(row[creditCol]);
          const absAmt = Math.abs(rawAmt);
          if (absAmt > 0) {
            parsedCredit = absAmt;
            hasCredit = true;
          }
        }
      }

      if (hasDebit && hasCredit) {
        // If both are non-zero, net them.
        amount = parsedCredit - parsedDebit;
        if (amount < 0) {
          explicitExpense = true;
          amount = -Math.abs(amount);
        } else if (amount > 0) {
          explicitIncome = true;
          amount = Math.abs(amount);
        }
      } else if (hasDebit) {
        amount = -parsedDebit; // Negative represents expense
        explicitExpense = true;
      } else if (hasCredit) {
        amount = parsedCredit; // Positive represents income
        explicitIncome = true;
      } else {
        // Both columns are empty or resolved to 0 (ignored placeholders like '-' or '0')
        amount = 0;
      }
    } else {
      // Single amount column mapping
      const amountCol = mapping['amount'];
      const rawAmtVal = row[amountCol];
      const { amount: parsedAmt, isExpense, isIncome } = cleanAmount(rawAmtVal);
      amount = parsedAmt;
      explicitExpense = isExpense;
      explicitIncome = isIncome;
    }

    // 3. Resolve description
    const rawDesc = row[mapping['description']] || '';

    // 4. Infer transaction type
    let rawType = mapping['type'] ? row[mapping['type']] : undefined;
    if (explicitExpense) rawType = 'debit';
    if (explicitIncome) rawType = 'credit';

    const type = inferTransactionType(rawDesc, amount, rawType);

    // 5. Build standardized transaction schema
    transactions.push({
      transaction_date: date.toISOString(),
      description: rawDesc,
      amount: amount,
      currency: context.currency,
      type: type,
      category: mapping['category'] ? row[mapping['category']] : null,
      counterparty_name: mapping['counterparty_name'] ? row[mapping['counterparty_name']] : null,
      source_provider: context.provider,
      raw_row_json: row
    });
  });

  if (dateAmbiguityCount > 0) {
    warnings.push(`Detected ${dateAmbiguityCount} rows with ambiguous date format (e.g. DD/MM vs MM/DD). Assumed Indian standard (DD/MM/YYYY).`);
  }

  return {
    transactions,
    warnings
  };
};
