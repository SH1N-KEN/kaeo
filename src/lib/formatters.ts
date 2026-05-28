export interface FormatOptions {
  showSign?: boolean;
  compact?: boolean;
}

/**
 * Formats a number in Indian Rupees (INR) with Indian digit grouping.
 * Clean negative formatting: -₹77,827 (not ₹-77,827).
 * No decimals by default.
 */
export const formatINR = (amount: number, options?: FormatOptions): string => {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const formatterOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  };

  if (options?.compact) {
    formatterOptions.notation = 'compact';
    formatterOptions.maximumFractionDigits = 1;
  }

  const formatter = new Intl.NumberFormat('en-IN', formatterOptions);
  const formatted = formatter.format(absAmount);

  if (isNegative) {
    return `-${formatted}`;
  }
  if (options?.showSign && amount > 0) {
    return `+${formatted}`;
  }
  return formatted;
};

/**
 * Formats a number in Indian Rupees (INR) always showing positive/negative signs.
 * E.g., +₹1,50,000 or -₹77,827.
 */
export const formatSignedINR = (amount: number): string => {
  return formatINR(amount, { showSign: true });
};

/**
 * Normalizes client or workspace names, returning the real business name if valid,
 * or "No business selected" if missing, null, empty, or invalid.
 */
export const getCleanClientName = (name?: string | null): string => {
  if (!name) return 'No business selected';
  const trimmed = name.trim();
  if (trimmed === '') return 'No business selected';
  return trimmed;
};
export function formatCurrency(
  amount: number | null | undefined,
  _currency?: string,
  signed = false,
): string {
  const value = Number(amount ?? 0);
  return formatINR(value, { showSign: signed });
}

export function formatSignedCurrency(
  amount: number | null | undefined,
  _currency?: string,
): string {
  return formatCurrency(amount, _currency, true);
}