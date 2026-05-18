/**
 * Header Row Detector Heuristics
 * Analyzes raw cell grids to detect the optimal header row, skipping title/blank lines.
 */

const DATE_KEYWORDS = ['date', 'txn date', 'txn_date', 'transaction date', 'value date', 'posted', 'tran date', 'val date'];
const DESC_KEYWORDS = ['description', 'narration', 'particulars', 'remarks', 'payee', 'vendor', 'details', 'particular'];
const AMT_KEYWORDS = ['amount', 'debit', 'credit', 'withdrawal', 'deposit', 'net amount', 'value', 'txn amount', 'balance'];

export interface HeaderDetectionResult {
  headerRowIndex: number;
  headers: string[];
  skippedRowCount: number;
  warnings: string[];
}

export const detectHeaderRow = (grid: any[][]): HeaderDetectionResult => {
  const warnings: string[] = [];
  
  if (!grid || grid.length === 0) {
    return { headerRowIndex: 0, headers: [], skippedRowCount: 0, warnings: ['Empty data grid.'] };
  }

  let bestRowIndex = 0;
  let maxScore = 0;

  // Scan first 30 rows
  const rowsToScan = Math.min(30, grid.length);

  for (let i = 0; i < rowsToScan; i++) {
    const row = grid[i];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    let hasDate = false;
    let hasDesc = false;
    let hasAmt = false;
    let matchCount = 0;

    row.forEach(cell => {
      if (cell === null || cell === undefined) return;
      const strVal = cell.toString().toLowerCase().trim();

      if (!hasDate && DATE_KEYWORDS.some(k => strVal === k || strVal.includes(k))) {
        hasDate = true;
        matchCount++;
      }
      if (!hasDesc && DESC_KEYWORDS.some(k => strVal === k || strVal.includes(k))) {
        hasDesc = true;
        matchCount++;
      }
      if (!hasAmt && AMT_KEYWORDS.some(k => strVal === k || strVal.includes(k))) {
        hasAmt = true;
        matchCount++;
      }
    });

    // Score is number of unique standard finance components discovered in this single row
    let score = 0;
    if (hasDate) score += 2; // Date is highly significant
    if (hasDesc) score += 2; // Description is highly significant
    if (hasAmt) score += 2;  // Amount is highly significant

    // Bonus for high match density
    if (matchCount >= 3) score += 1;

    if (score > maxScore) {
      maxScore = score;
      bestRowIndex = i;
    }
  }

  // If maxScore is very low (less than 4, i.e., we didn't match at least 2 major headers), fallback to row 0
  if (maxScore < 4) {
    bestRowIndex = 0;
    warnings.push('No obvious header row discovered. Assuming row 1 contains column titles.');
  }

  // Extract and clean headers
  const rawHeaderRow = grid[bestRowIndex] || [];
  const headers: string[] = rawHeaderRow.map((cell, idx) => {
    if (cell === null || cell === undefined || cell.toString().trim() === '') {
      return `Column_${String.fromCharCode(65 + (idx % 26))}${idx >= 26 ? Math.floor(idx / 26) : ''}`;
    }
    return cell.toString().trim();
  });

  if (bestRowIndex > 0) {
    warnings.push(`Skipped ${bestRowIndex} title/meta rows at the top of the file.`);
  }

  return {
    headerRowIndex: bestRowIndex,
    headers,
    skippedRowCount: bestRowIndex,
    warnings
  };
};

/**
 * Filter out pagination header duplicates or blank trailing lines.
 */
export const filterMessyRows = (
  rawRows: Record<string, any>[],
  _headers: string[]
): { cleanRows: Record<string, any>[]; skippedCount: number; warnings: string[] } => {
  const warnings: string[] = [];
  const cleanRows: Record<string, any>[] = [];
  let skippedCount = 0;

  rawRows.forEach((row, idx) => {
    // 1. Skip completely empty rows
    const hasValues = Object.values(row).some(v => v !== null && v !== undefined && v.toString().trim() !== '');
    if (!hasValues) {
      skippedCount++;
      return;
    }

    // 2. Skip rows that represent repeated headers (common in paginated accounting exports)
    const isRepeatedHeader = Object.entries(row).every(([key, value]) => {
      if (!value) return true;
      return key.toLowerCase().trim() === value.toString().toLowerCase().trim();
    });

    if (isRepeatedHeader) {
      skippedCount++;
      warnings.push(`Filtered out matching repeated header row at ledger index ${idx + 1}.`);
      return;
    }

    // 3. Skip obvious summary / total footer rows
    const isSummaryRow = Object.values(row).some(v => {
      if (!v) return false;
      const str = v.toString().toLowerCase().trim();
      return ['total', 'totals', 'subtotal', 'opening balance', 'closing balance', 'carried forward', 'brought forward'].some(k => str === k || str.startsWith(k));
    });

    if (isSummaryRow) {
      skippedCount++;
      warnings.push(`Filtered out summary/balance row at ledger index ${idx + 1}.`);
      return;
    }

    cleanRows.push(row);
  });

  return {
    cleanRows,
    skippedCount,
    warnings
  };
};
