/**
 * General-purpose Amount Normalization Utilities
 */

export interface ParsedAmountResult {
  amount: number;
  isExpense: boolean;
  isIncome: boolean;
}

/**
 * Parses and sanitizes a numeric amount string or number generally.
 */
export const cleanAmount = (val: any): ParsedAmountResult => {
  if (val === null || val === undefined) {
    return { amount: 0, isExpense: false, isIncome: false };
  }

  if (typeof val === 'number') {
    if (isNaN(val)) {
      return { amount: 0, isExpense: false, isIncome: false };
    }
    return {
      amount: val,
      isExpense: val < 0,
      isIncome: val > 0
    };
  }

  let str = String(val).trim();
  if (str === '') {
    return { amount: 0, isExpense: false, isIncome: false };
  }

  let isExpense = false;
  let isIncome = false;

  // 1. Trailing minus sign: e.g. "120.00-"
  if (str.endsWith('-')) {
    isExpense = true;
    str = str.slice(0, -1).trim();
  }
  // 2. Leading minus sign: e.g. "-120.00"
  else if (str.startsWith('-')) {
    isExpense = true;
    str = str.slice(1).trim();
  }

  // 3. Parentheses format: (120.00) => expense
  if (str.startsWith('(') && str.endsWith(')')) {
    isExpense = true;
    str = str.slice(1, -1).trim();
  }

  // 4. DR/CR/Db/Cr suffixes (case-insensitive)
  const suffixMatch = str.match(/\s*(dr|db|debit|cr|credit)$/i);
  if (suffixMatch) {
    const suffix = suffixMatch[1].toLowerCase();
    if (['dr', 'db', 'debit'].includes(suffix)) {
      isExpense = true;
    } else if (['cr', 'credit'].includes(suffix)) {
      isIncome = true;
    }
    str = str.slice(0, -suffixMatch[0].length).trim();
  }

  // 5. Clean thousands separators, currency symbols, and spaces
  // Keep only numbers, decimal points, and dots.
  str = str.replace(/,/g, '').replace(/\s+/g, '');
  str = str.replace(/[^\d.]/g, ''); // Remove currency symbols like ₹, $, €, £

  let amount = parseFloat(str);
  if (isNaN(amount)) {
    return { amount: 0, isExpense: false, isIncome: false };
  }

  if (isExpense) {
    amount = -Math.abs(amount);
  } else if (isIncome) {
    amount = Math.abs(amount);
  } else {
    // If no explicit signs, base direction on numerical value
    isExpense = amount < 0;
    isIncome = amount > 0;
  }

  return { amount, isExpense, isIncome };
};
