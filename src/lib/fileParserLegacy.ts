import Papa from 'papaparse';
import { detectProvider } from './fileParser';
import type { ParseResult } from './fileParser';

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
          rows: rows.slice(0, 20),
          allRows: rows,
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
          allRows: [],
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
