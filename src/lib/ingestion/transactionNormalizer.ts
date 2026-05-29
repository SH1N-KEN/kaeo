import { inferTransactionType } from '../normalizationEngine';
import { inferTransactionCategory } from '../categoryEngine';
import { 
  normalizeCurrencyCode, 
  getFallbackRate, 
  convertToBaseCurrency, 
  needsConversion 
} from '../currency';
import { parseIndianNarration } from '../transactionIntelligence';

/**
 * Detects currency from row mappings, cell values, and row headers/keys.
 */
export const detectCurrency = (
  row: any,
  mapping: Record<string, string>,
  baseCurrency: string
): string => {
  // 1. Check if there is an explicit mapped currency column and it has a value
  if (mapping['currency'] && row[mapping['currency']]) {
    const val = String(row[mapping['currency']]).trim();
    if (val) {
      const normalized = normalizeCurrencyCode(val);
      if (normalized) return normalized;
    }
  }

  // 2. Scan the amount-related cell values for currency symbols
  const amountCols = [mapping['amount'], mapping['debit'], mapping['credit']].filter(Boolean);
  for (const col of amountCols) {
    if (row[col] !== undefined && row[col] !== null) {
      const strVal = String(row[col]);
      if (strVal.includes('₹') || strVal.includes('INR')) return 'INR';
      if (strVal.includes('$') || strVal.includes('USD')) return 'USD';
      if (strVal.includes('€') || strVal.includes('EUR')) return 'EUR';
      if (strVal.includes('£') || strVal.includes('GBP')) return 'GBP';
    }
  }

  // 3. Scan the row object keys (headers) and row values for any currency indications
  for (const key of Object.keys(row)) {
    const keyLower = key.toLowerCase();
    const valStr = String(row[key]);
    
    if (keyLower.includes('currency')) {
      const normalized = normalizeCurrencyCode(valStr);
      if (normalized) return normalized;
    }
    
    if (keyLower.includes('₹') || keyLower.includes('inr')) return 'INR';
    if (keyLower.includes('$') || keyLower.includes('usd')) return 'USD';
    if (keyLower.includes('€') || keyLower.includes('eur')) return 'EUR';
    if (keyLower.includes('£') || keyLower.includes('gbp')) return 'GBP';
  }

  // 4. Default to the workspace base currency
  return normalizeCurrencyCode(baseCurrency);
};

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

  let str = String(val).trim();
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
  const lowerStr = str.toLowerCase();
  if (lowerStr.endsWith('dr') || lowerStr.endsWith(' db') || lowerStr.endsWith('debit')) {
    isExpense = true;
    str = str.replace(/(dr|db|debit)$/i, '').trim();
  } else if (lowerStr.endsWith('cr') || lowerStr.endsWith('credit')) {
    isIncome = true;
    str = str.replace(/(cr|credit)$/i, '').trim();
  }

  // 3. Remove ALL commas and spaces FIRST to prevent parseInt/parseFloat truncation
  str = str.replace(/,/g, '').replace(/\s+/g, '');

  // 4. Clean other symbols (currency signs etc)
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
  if (val === null || val === undefined || val === '') return { date: new Date(), ambiguous: false, error: true };

  // If already parsed as a Date object
  if (val instanceof Date) {
    return { date: val, ambiguous: false, error: false };
  }

  // Handle Excel serial date (numeric or string matching 5 digits)
  if (typeof val === 'number') {
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000));
      return { date: d, ambiguous: false, error: isNaN(d.getTime()) };
    }
  }

  const str = val.toString().trim();
  if (/^\d{5}$/.test(str)) {
    const num = Number(str);
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    return { date: d, ambiguous: false, error: isNaN(d.getTime()) };
  }
  
  // 1. Check if ISO-like YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return { date: isNaN(d.getTime()) ? new Date() : d, ambiguous: false, error: isNaN(d.getTime()) };
  }

  // 2. Check for DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY or 2-digit year variants
  const delimiterMatch = str.match(/^(\d{1,2})([-/])(\d{1,2})[-/](\d{2,4})/);
  if (delimiterMatch) {
    const p1 = parseInt(delimiterMatch[1], 10);
    const p2 = parseInt(delimiterMatch[3], 10);
    let year = parseInt(delimiterMatch[4], 10);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    if (p1 > 12) {
      const d = new Date(year, p2 - 1, p1);
      return { date: d, ambiguous: false, error: isNaN(d.getTime()) };
    }
    
    if (p2 > 12) {
      const d = new Date(year, p1 - 1, p2);
      return { date: d, ambiguous: false, error: isNaN(d.getTime()) };
    }

    // Both are <= 12: Ambiguous! Default to standard Indian DD/MM/YYYY, but mark ambiguous
    const d = new Date(year, p2 - 1, p1);
    return { date: d, ambiguous: true, error: isNaN(d.getTime()) };
  }

  // 3. Check for word months: e.g. "12 May 2026" or "12-May-2026" or 2-digit years
  const wordMonthMatch = str.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})/);
  if (wordMonthMatch) {
    const day = parseInt(wordMonthMatch[1], 10);
    const monthStr = wordMonthMatch[2];
    let year = parseInt(wordMonthMatch[3], 10);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

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
 * Core Normalizer Function — v2 (Direction-First)
 *
 * KEY INVARIANT:
 *   1. Derive direction from debit/credit columns FIRST.
 *   2. Pass direction to type inference and intelligence layer.
 *   3. Post-process: if type says income but direction says outflow → reclassify.
 *   4. No transaction should ever have type=income + negative amount (unless it's an adjustment).
 */
export const normalizeIngestedRows = (
  rows: any[],
  mapping: Record<string, string>,
  context: NormalizerContext
): NormalizationResult => {
  const warnings: string[] = [];
  const transactions: any[] = [];
  let dateAmbiguityCount = 0;
  let prevBalance: number | null = null;

  if (context.provider === 'Expense Ledger') {
    rows.forEach((row, index) => {
      let rawDate = null;
      const paymentDateKey = Object.keys(row).find(k => k.toLowerCase().includes('payment date'));
      const orderDateKey = Object.keys(row).find(k => k.toLowerCase().includes('order date'));

      if (paymentDateKey && row[paymentDateKey] !== undefined && row[paymentDateKey] !== null && String(row[paymentDateKey]).trim() !== '') {
        rawDate = row[paymentDateKey];
      } else if (orderDateKey && row[orderDateKey] !== undefined && row[orderDateKey] !== null && String(row[orderDateKey]).trim() !== '') {
        rawDate = row[orderDateKey];
      } else {
        rawDate = row[mapping['transaction_date']];
      }

      const { date, ambiguous, error: dateError } = parseIngestedDate(rawDate);

      if (dateError) {
        warnings.push(`Row ${index + 1}: Skipping due to unparseable transaction date.`);
        return;
      }

      if (ambiguous) {
        dateAmbiguityCount++;
      }

      const amountCol = mapping['amount'];
      const rawAmtVal = row[amountCol];
      const { amount: parsedAmt } = cleanAmount(rawAmtVal);
      const amount = -Math.abs(parsedAmt); // negative for expense

      if (amount === 0) {
        warnings.push(`Row ${index + 1}: Skipping due to zero or missing amount.`);
        return;
      }

      let itemVal = '';
      let supplierVal = '';
      let invoiceVal = '';

      const itemKey = Object.keys(row).find(k => k.toLowerCase().includes('item') || k.toLowerCase().includes('description'));
      const supplierKey = Object.keys(row).find(k => k.toLowerCase().includes('supplier') || k.toLowerCase().includes('vendor'));
      const invoiceKey = Object.keys(row).find(k => k.toLowerCase().includes('invoice no') || k.toLowerCase().includes('invoice number'));

      if (itemKey) itemVal = String(row[itemKey] || '').trim();
      if (supplierKey) supplierVal = String(row[supplierKey] || '').trim();
      if (invoiceKey) invoiceVal = String(row[invoiceKey] || '').trim();

      const parts = [];
      if (itemVal) parts.push(itemVal);
      if (supplierVal) parts.push(supplierVal);
      if (invoiceVal) parts.push(invoiceVal);

      const formattedDesc = parts.length > 0 ? parts.join(' — ') : (row[mapping['description']] || 'Expense Row');
      const extractedCounterparty = supplierVal || row[mapping['counterparty_name']] || null;
      const category = row[mapping['category']] || 'Uncategorized Expense';

      const qtyKey = Object.keys(row).find(k => k.toLowerCase().includes('qty') || k.toLowerCase().includes('quantity'));
      const quantity = qtyKey ? row[qtyKey] : null;

      let confidenceLevel: 'high' | 'medium' | 'low' = 'high';
      if (!rawDate || amount === 0) {
        confidenceLevel = 'low';
      } else if (!invoiceVal) {
        confidenceLevel = 'medium';
      }

      const originalCurrency = detectCurrency(row, mapping, context.currency);
      const exchangeRate = needsConversion(originalCurrency, context.currency)
        ? getFallbackRate(originalCurrency, context.currency)
        : 1;
      const amountInBaseCurrency = convertToBaseCurrency(amount, originalCurrency, context.currency, exchangeRate);

      const txObj: any = {
        transaction_date: date.toISOString(),
        description: formattedDesc,
        amount: amount,
        original_amount: amount,
        original_currency: originalCurrency,
        currency: originalCurrency,
        exchange_rate: exchangeRate,
        amount_in_base_currency: amountInBaseCurrency,
        fx_date: date.toISOString().split('T')[0],
        fx_source: needsConversion(originalCurrency, context.currency) ? 'fallback_static' : null,
        fx_metadata: {},
        type: 'expense',
        category: category,
        counterparty_name: extractedCounterparty,
        source_provider: context.provider,
        reference: invoiceVal || null,
        review_status: 'pending',
        source_type: 'expense_ledger',
        raw_row_json: {
          ...row,
          invoice_number: invoiceVal || null,
          quantity: quantity || null,
          confidence_level: confidenceLevel,
          direction_derived: 'outflow',
          raw_debit: Math.abs(amount),
          raw_credit: 0
        }
      };

      transactions.push(txObj);
    });

    if (dateAmbiguityCount > 0) {
      warnings.push(`Detected ${dateAmbiguityCount} rows with ambiguous date format (e.g. DD/MM vs MM/DD). Assumed Indian standard (DD/MM/YYYY).`);
    }

    return {
      transactions,
      warnings
    };
  }

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
    //    DIRECTION IS DETERMINED HERE — NOT BY KEYWORDS
    let amount = 0;
    let rawDebit = 0;
    let rawCredit = 0;
    let direction: 'inflow' | 'outflow' | 'unknown' = 'unknown';

    const debitCol = mapping['debit'];
    const creditCol = mapping['credit'];

    if (debitCol || creditCol) {
      let hasDebit = false;
      let hasCredit = false;

      if (debitCol && row[debitCol] !== undefined && row[debitCol] !== null) {
        const valStr = row[debitCol].toString().trim();
        if (valStr !== '' && valStr !== '-' && valStr !== '0' && valStr !== '0.00') {
          const { amount: rawAmt } = cleanAmount(row[debitCol]);
          const absAmt = Math.abs(rawAmt);
          if (absAmt > 0) {
            rawDebit = absAmt;
            hasDebit = true;
          }
        }
      }

      if (creditCol && row[creditCol] !== undefined && row[creditCol] !== null) {
        const valStr = row[creditCol].toString().trim();
        if (valStr !== '' && valStr !== '-' && valStr !== '0' && valStr !== '0.00') {
          const { amount: rawAmt } = cleanAmount(row[creditCol]);
          const absAmt = Math.abs(rawAmt);
          if (absAmt > 0) {
            rawCredit = absAmt;
            hasCredit = true;
          }
        }
      }

      if (hasDebit && hasCredit) {
        // Both populated: net them and derive direction from net
        const net = rawCredit - rawDebit;
        amount = net;
        direction = net > 0 ? 'inflow' : net < 0 ? 'outflow' : 'neutral' as any;
      } else if (hasDebit) {
        amount = -rawDebit;   // Debit = money leaving = negative
        direction = 'outflow';
      } else if (hasCredit) {
        amount = rawCredit;   // Credit = money coming = positive
        direction = 'inflow';
      } else {
        amount = 0;
        direction = 'unknown';
      }
    } else {
      // Single amount column
      const amountCol = mapping['amount'];
      const rawAmtVal = row[amountCol];
      const { amount: parsedAmt, isExpense, isIncome } = cleanAmount(rawAmtVal);
      amount = parsedAmt;

      // Derive direction from parsed amount and DR/CR hints
      if (isExpense) direction = 'outflow';
      else if (isIncome) direction = 'inflow';
      else if (parsedAmt < 0) direction = 'outflow';
      else if (parsedAmt > 0) direction = 'inflow';
      else direction = 'unknown';

      // Store debit/credit breakdown
      if (direction === 'outflow') rawDebit = Math.abs(parsedAmt);
      else if (direction === 'inflow') rawCredit = parsedAmt;
    }

    // 3. Resolve description
    const rawDesc = row[mapping['description']] || '';

    // 4. Infer transaction type — DIRECTION FIRST
    //    Pass direction explicitly so keywords cannot override debit/credit column truth
    const type = inferTransactionType(rawDesc, amount, undefined, direction);

    // 5. Run Indian narration intelligence (with explicit direction)
    let extractedCounterparty: string | null = mapping['counterparty_name'] ? (row[mapping['counterparty_name']] ? String(row[mapping['counterparty_name']]).trim() : null) : null;
    let intelligenceMetadata: any = {};
    let confidenceLevel: 'high' | 'medium' | 'low' = 'high';
    let inferredCategory = '';

    const rawCategory = mapping['category'] ? row[mapping['category']] : null;
    const storedCat = rawCategory ? String(rawCategory).trim() : '';
    const isCatMissing =
      !storedCat ||
      storedCat.toLowerCase() === 'uncategorized' ||
      storedCat.toLowerCase() === 'unknown' ||
      storedCat.toLowerCase() === 'generic' ||
      storedCat.toLowerCase() === 'null';

    if (context.provider === 'Bank Statement' || context.provider === 'Generic Finance File') {
      const intel = parseIndianNarration(rawDesc, direction);

      if (intel.counterparty_name && intel.counterparty_name !== 'No counterparty') {
        extractedCounterparty = intel.counterparty_name;
      }

      if (isCatMissing) {
        inferredCategory = intel.likely_category;
      } else {
        inferredCategory = storedCat;
      }

      confidenceLevel = intel.confidence;
      intelligenceMetadata = {
        payment_rail: intel.payment_rail,
        counterparty_type: intel.counterparty_type,
        reference_number: intel.reference_number,
        upi_id: intel.upi_id,
        bank_ifsc_or_code: intel.bank_ifsc_or_code,
        intelligence_confidence: intel.confidence,
        intelligence_reason: intel.reason,
        is_internal_transfer: intel.is_internal_transfer,
        direction_hint: intel.direction_hint
      };

      // Override type to 'transfer' if intelligence says internal transfer
      // but only if type wasn't already something stronger (failed_payment)
      if (intel.is_internal_transfer && type !== 'failed_payment') {
        // Use transfer type — but keep direction for display
        // (will be set below in txObj)
      }
    } else {
      if (isCatMissing) {
        inferredCategory = inferTransactionCategory(rawDesc, extractedCounterparty, type, direction);
      } else {
        inferredCategory = storedCat;
      }
    }

    // Map reference field if mapped
    const refCol = mapping['reference'];
    let reference = refCol && row[refCol] !== undefined && row[refCol] !== null ? String(row[refCol]).trim() : null;

    // If intel extracted a reference, use it
    if (intelligenceMetadata.reference_number && !reference) {
      reference = intelligenceMetadata.reference_number;
    }

    // 6. Post-processing: direction/type conflict resolution
    //    CRITICAL: Prevent "income" type on outflow direction (negative revenue bug)
    let finalType = type;
    let finalCategory = inferredCategory;
    let reviewStatus = 'new';

    const isInternalTransfer = intelligenceMetadata.is_internal_transfer === true;

    if (isInternalTransfer && finalType !== 'failed_payment') {
      finalType = 'transfer';
      finalCategory = direction === 'inflow' ? 'Transfer In' : 'Transfer Out';
      confidenceLevel = 'high';
    } else if (direction === 'outflow' && finalType === 'income') {
      // CONFLICT: debit row classified as income — reclassify
      const narrationLower = rawDesc.toLowerCase();
      const hasRefundKw = ['refund', 'reversal', 'cashback', 'reimburs', 'recovery', 'chargeback'].some(k => narrationLower.includes(k));

      if (hasRefundKw) {
        // Paying back a customer refund — still an outflow expense
        finalType = 'expense';
        finalCategory = 'Vendor Payment'; // or could be Refund Paid Out
      } else {
        // Truly ambiguous — mark for review
        finalType = 'expense';
        finalCategory = finalCategory && !['Customer Payment / Revenue', 'Revenue / Sales', 'Unknown Income'].includes(finalCategory)
          ? finalCategory
          : 'Uncategorized Expense';
        reviewStatus = 'needs_review';
        warnings.push(`Row ${index + 1}: Debit row classified as income — reclassified to expense (needs review).`);
      }
    } else if (direction === 'inflow' && ['expense', 'vendor_payment', 'bank_charge'].includes(finalType)) {
      // CONFLICT: credit row classified as expense — check if it's a refund/recovery
      const narrationLower = rawDesc.toLowerCase();
      const hasRefundKw = ['refund', 'reversal', 'cashback', 'reimburs', 'recovery', 'chargeback', 'upiret'].some(k => narrationLower.includes(k));

      if (hasRefundKw) {
        finalType = 'refund';
        finalCategory = 'Refunds / Recoveries';
      } else {
        // Credit amount classified as expense — reclassify as income
        finalType = 'income';
        finalCategory = 'Customer Payment / Revenue';
        reviewStatus = 'needs_review';
      }
    }

    // If confidence is low, mark for review (but not if already needs_review)
    if (confidenceLevel === 'low' && reviewStatus === 'new') {
      reviewStatus = 'needs_review';
    }

    // Detect currency for this row
    const originalCurrency = detectCurrency(row, mapping, context.currency);
    const exchangeRate = needsConversion(originalCurrency, context.currency)
      ? getFallbackRate(originalCurrency, context.currency)
      : 1;
    const amountInBaseCurrency = convertToBaseCurrency(amount, originalCurrency, context.currency, exchangeRate);

    // Resolve balance and check reconciliation
    let balanceMismatch = false;
    const balanceKey = Object.keys(row).find(k => k.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === 'closingbalance');
    if (balanceKey) {
      const balanceVal = row[balanceKey];
      if (balanceVal !== null && balanceVal !== undefined && balanceVal !== '') {
        const cleanBal = typeof balanceVal === 'number' ? balanceVal : parseFloat(String(balanceVal).replace(/,/g, '').trim());
        if (!isNaN(cleanBal)) {
          if (prevBalance !== null) {
            const expectedDelta = amount;
            const actualDelta = cleanBal - prevBalance;
            const diff = Math.abs(expectedDelta - actualDelta);
            if (diff > 0.02) {
              balanceMismatch = true;
              warnings.push(`Row ${index + 1}: Balance movement does not match debit/credit amount.`);
            }
          }
          prevBalance = cleanBal;
        }
      }
    }

    if (balanceMismatch && reviewStatus === 'new') {
      reviewStatus = 'needs_review';
    }

    // 7. Build standardized transaction schema
    const txObj: any = {
      transaction_date: date.toISOString(),
      description: rawDesc,
      amount: amount,
      original_amount: amount,
      original_currency: originalCurrency,
      currency: originalCurrency,
      exchange_rate: exchangeRate,
      amount_in_base_currency: amountInBaseCurrency,
      fx_date: date.toISOString().split('T')[0],
      fx_source: needsConversion(originalCurrency, context.currency) ? 'fallback_static' : null,
      fx_metadata: needsConversion(originalCurrency, context.currency)
        ? { conversion_type: 'static', fallback_rate: true }
        : {},
      type: finalType,
      category: finalCategory,
      counterparty_name: extractedCounterparty,
      source_provider: context.provider,
      reference: reference,
      review_status: reviewStatus,
      raw_row_json: {
        ...row,
        intelligence: intelligenceMetadata,
        direction_derived: direction,
        raw_debit: rawDebit,
        raw_credit: rawCredit
      }
    };

    if (balanceMismatch) {
      txObj.raw_row_json.metadata = {
        ...(row && row.metadata),
        balance_mismatch: true
      };
    }

    transactions.push(txObj);
  });

  if (dateAmbiguityCount > 0) {
    warnings.push(`Detected ${dateAmbiguityCount} rows with ambiguous date format (e.g. DD/MM vs MM/DD). Assumed Indian standard (DD/MM/YYYY).`);
  }

  return {
    transactions,
    warnings
  };
};
