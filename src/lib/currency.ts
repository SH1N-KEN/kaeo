// Currency and FX conversion utility library

import { formatINR } from './formatters';

export const SUPPORTED_CURRENCIES = ['INR'];

export const getCurrencySymbol = (_currency: string): string => {
  return '₹';
};

export const normalizeCurrencyCode = (_value: string): string => {
  return 'INR';
};

export const needsConversion = (_fromCurrency: string, _toCurrency: string): boolean => {
  return false;
};

export const getFallbackRate = (_fromCurrency: string, _toCurrency: string): number => {
  return 1;
};

export const convertToBaseCurrency = (
  amount: number,
  _fromCurrency: string,
  _toCurrency: string,
  _rate?: number | null
): number => {
  return amount;
};

export interface FormatOptions {
  forceSign?: boolean;
  maximumFractionDigits?: number;
}

export const formatMoney = (
  amount: number,
  _currency: string = 'INR',
  options: FormatOptions = {}
): string => {
  return formatINR(amount, { showSign: options.forceSign });
};

