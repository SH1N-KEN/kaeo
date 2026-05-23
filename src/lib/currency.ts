// Currency and FX conversion utility library

export const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

export const getCurrencySymbol = (currency: string): string => {
  const code = normalizeCurrencyCode(currency);
  switch (code) {
    case 'INR': return '₹';
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    default: return '$';
  }
};

export const normalizeCurrencyCode = (value: string): string => {
  if (!value) return 'INR';
  const clean = value.trim().toUpperCase();
  if (clean.includes('₹') || clean.includes('INR')) return 'INR';
  if (clean.includes('$') || clean.includes('USD')) return 'USD';
  if (clean.includes('€') || clean.includes('EUR')) return 'EUR';
  if (clean.includes('£') || clean.includes('GBP')) return 'GBP';
  return clean;
};

export const needsConversion = (fromCurrency: string, toCurrency: string): boolean => {
  return normalizeCurrencyCode(fromCurrency) !== normalizeCurrencyCode(toCurrency);
};

export const getFallbackRate = (fromCurrency: string, toCurrency: string): number => {
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);
  if (from === to) return 1;

  if (to === 'INR') {
    if (from === 'USD') return 83;
    if (from === 'EUR') return 90;
    if (from === 'GBP') return 105;
  }

  if (from === 'INR') {
    if (to === 'USD') return 1 / 83;
    if (to === 'EUR') return 1 / 90;
    if (to === 'GBP') return 1 / 105;
  }

  // Fallbacks for other pairs
  const rates: Record<string, Record<string, number>> = {
    USD: { EUR: 0.92, GBP: 0.79 },
    EUR: { USD: 1.08, GBP: 0.86 },
    GBP: { USD: 1.27, EUR: 1.16 }
  };

  return rates[from]?.[to] || 1;
};

export const convertToBaseCurrency = (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rate?: number | null
): number => {
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);
  if (from === to) return amount;

  const activeRate = (rate !== undefined && rate !== null && rate > 0)
    ? rate
    : getFallbackRate(from, to);

  return amount * activeRate;
};

export interface FormatOptions {
  forceSign?: boolean;
  maximumFractionDigits?: number;
}

export const formatMoney = (
  amount: number,
  currency: string = 'INR',
  options: FormatOptions = {}
): string => {
  const code = normalizeCurrencyCode(currency);
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  let locale = 'en-IN';
  if (code === 'USD') locale = 'en-US';
  else if (code === 'EUR') locale = 'de-DE';
  else if (code === 'GBP') locale = 'en-GB';

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: options.maximumFractionDigits !== undefined ? options.maximumFractionDigits : 0
  });

  const formatted = formatter.format(absAmount);
  
  if (isNegative) {
    return `-${formatted}`;
  }
  if (options.forceSign && amount > 0) {
    return `+${formatted}`;
  }
  return formatted;
};
