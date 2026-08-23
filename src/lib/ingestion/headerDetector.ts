/**
 * Header Row Detector Heuristics
 * Analyzes raw cell grids to detect the optimal header row, skipping title/blank lines.
 */

const DATE_KEYWORDS = ['date', 'txn date', 'txn_date', 'transaction date', 'value date', 'posted', 'tran date', 'val date', 'txndate', 'value_date', 'dt', 'tx dt', 'txn dt', 'time'];
const DESC_KEYWORDS = ['description', 'narration', 'particulars', 'remarks', 'payee', 'vendor', 'details', 'particular', 'desc', 'naration', 'payee name'];
const AMT_KEYWORDS = ['amount', 'debit', 'credit', 'withdrawal', 'deposit', 'net amount', 'value', 'txn amount', 'balance', 'dr', 'cr', 'amt', 'withdrawal amt', 'deposit amt', 'closing balance', 'in', 'out'];

export interface HeaderDetectionResult {
  headerRowIndex: number;
  headers: string[];
  skippedRowCount: number;
  warnings: string[];
  headerRowsCount?: number;
}

export const detectHeaderRow = (grid: any[][]): HeaderDetectionResult => {
  const warnings: string[] = [];
  
  if (!grid || grid.length === 0) {
    return { headerRowIndex: 0, headers: [], skippedRowCount: 0, warnings: ['Empty data grid.'], headerRowsCount: 1 };
  }

  let bestRowIndex = 0;
  let maxScore = 0;
  let isBestCombined = false;
  let bestHeaders: string[] = [];

  const DATE_KEYWORDS_DETECTOR = [...DATE_KEYWORDS, 'order', 'payment', 'invoice'];
  const DESC_KEYWORDS_DETECTOR = [...DESC_KEYWORDS, 'supplier', 'item', 'category'];
  const AMT_KEYWORDS_DETECTOR = [...AMT_KEYWORDS, 'qty', 'quantity', 'rs.'];

  // Helper to combine two header rows
  const combineHeaders = (row1: any[], row2: any[]): string[] => {
    const length = Math.max(row1.length, row2.length);
    const combined: string[] = [];
    for (let c = 0; c < length; c++) {
      const val1 = row1[c] !== undefined && row1[c] !== null ? String(row1[c]).trim() : '';
      const val2 = row2[c] !== undefined && row2[c] !== null ? String(row2[c]).trim() : '';

      if (val1 && val2) {
        const l1 = val1.toLowerCase();
        const l2 = val2.toLowerCase();
        if (l1 === l2) {
          combined.push(val1);
        } else if (l1.includes(l2)) {
          combined.push(val1);
        } else if (l2.includes(l1)) {
          combined.push(val2);
        } else {
          combined.push(`${val1} ${val2}`);
        }
      } else if (val1) {
        combined.push(val1);
      } else if (val2) {
        combined.push(val2);
      } else {
        combined.push('');
      }
    }
    return combined;
  };

  const getScore = (headersList: string[]) => {
    let hasDate = false;
    let hasDesc = false;
    let hasAmt = false;
    let matchCount = 0;

    headersList.forEach(cell => {
      if (!cell) return;
      const strVal = cell.toLowerCase().trim();
      const normalizedHeader = strVal.replace(/[^a-z0-9]/g, '');
      const words = strVal.split(/[^a-z0-9]+/);

      const matchesKeyword = (keywords: string[]) => {
        return keywords.some(k => {
          const nk = k.replace(/[^a-z0-9]/g, '');
          if (['in', 'out', 'dr', 'cr'].includes(k)) {
            return words.includes(k) || normalizedHeader === nk;
          }
          return normalizedHeader.includes(nk) || words.includes(nk);
        });
      };

      if (!hasDate && matchesKeyword(DATE_KEYWORDS_DETECTOR)) {
        hasDate = true;
        matchCount++;
      }
      if (!hasDesc && matchesKeyword(DESC_KEYWORDS_DETECTOR)) {
        hasDesc = true;
        matchCount++;
      }
      if (!hasAmt && matchesKeyword(AMT_KEYWORDS_DETECTOR)) {
        hasAmt = true;
        matchCount++;
      }
    });

    let score = 0;
    if (hasDate) score += 2;
    if (hasDesc) score += 2;
    if (hasAmt) score += 2;
    if (matchCount >= 3) score += 1;
    return { score, matchCount };
  };

  const rowsToScan = Math.min(30, grid.length);

  for (let i = 0; i < rowsToScan; i++) {
    const row = grid[i];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    // Evaluate single row
    const singleHeaders = row.map(c => c !== null && c !== undefined ? String(c).trim() : '');
    const { score: singleScore } = getScore(singleHeaders);

    if (singleScore > maxScore) {
      maxScore = singleScore;
      bestRowIndex = i;
      isBestCombined = false;
      bestHeaders = singleHeaders;
    }

    // Evaluate combined row (i and i+1)
    if (i + 1 < grid.length) {
      const nextRow = grid[i + 1];
      if (nextRow && Array.isArray(nextRow) && nextRow.length > 0) {
        const combined = combineHeaders(row, nextRow);
        const { score: combinedScore } = getScore(combined);

        if (combinedScore > maxScore) {
          maxScore = combinedScore;
          bestRowIndex = i;
          isBestCombined = true;
          bestHeaders = combined;
        }
      }
    }
  }

  if (maxScore < 4) {
    bestRowIndex = 0;
    isBestCombined = false;
    bestHeaders = (grid[0] || []).map(c => c !== null && c !== undefined ? String(c).trim() : '');
    warnings.push('No obvious header row discovered. Assuming row 1 contains column titles.');
  }

  // Clean empty headers
  const headers = bestHeaders.map((h, idx) => {
    if (!h) {
      return `Column_${String.fromCharCode(65 + (idx % 26))}${idx >= 26 ? Math.floor(idx / 26) : ''}`;
    }
    return h;
  });

  const headerRowsCount = isBestCombined ? 2 : 1;

  if (bestRowIndex > 0) {
    warnings.push(`Skipped ${bestRowIndex} title/meta rows at the top of the file.`);
  }

  if (isBestCombined) {
    warnings.push('Detected and merged a two-row header block.');
  }

  return {
    headerRowIndex: bestRowIndex,
    headers,
    skippedRowCount: bestRowIndex + (isBestCombined ? 1 : 0),
    warnings,
    headerRowsCount
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
      const isKeyword = ['total', 'totals', 'subtotal', 'opening balance', 'closing balance', 'carried forward', 'brought forward'].some(k => str === k || str.startsWith(k + ' ') || str === k + ':');
      if (isKeyword) {
        const nonNullCount = Object.values(row).filter(x => x !== null && x !== undefined && String(x).trim() !== '').length;
        return nonNullCount <= 3;
      }
      return false;
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
