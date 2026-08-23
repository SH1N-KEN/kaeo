/**
 * General-purpose Ingestion Continuation Row Merger
 */

export interface ContinuationMergeResult {
  cleanRows: Record<string, any>[];
  mergedCount: number;
}

/**
 * Merges multi-line narration rows where dates/amounts are missing but narration/description is present.
 */
export const mergeContinuationRows = (
  rows: Record<string, any>[],
  mapping: Record<string, string>,
  _headers: string[]
): ContinuationMergeResult => {
  const cleanRows: Record<string, any>[] = [];
  let mergedCount = 0;
  let currentTx: Record<string, any> | null = null;

  // Resolve header mappings
  const dateCol = mapping['transaction_date'];
  const descCol = mapping['description'];
  const amountCol = mapping['amount'];
  const debitCol = mapping['debit'];
  const creditCol = mapping['credit'];

  // Helper to check if a value is blank/null
  const isBlank = (val: any): boolean => {
    return val === null || val === undefined || String(val).trim() === '';
  };

  rows.forEach((row, idx) => {
    const rawDate = dateCol ? row[dateCol] : null;
    const rawDesc = descCol ? row[descCol] : null;
    const rawAmt = amountCol ? row[amountCol] : null;
    const rawDebit = debitCol ? row[debitCol] : null;
    const rawCredit = creditCol ? row[creditCol] : null;

    const hasDate = !isBlank(rawDate);
    const hasDesc = !isBlank(rawDesc);
    
    // Check if any amount field is populated
    const hasAmt = !isBlank(rawAmt) || !isBlank(rawDebit) || !isBlank(rawCredit);

    // In a general bank statement, a new transaction starts if we have a valid date and a description/amount.
    // However, sometimes date might be present but no amount (this is filtered later or handled).
    // The key indicator of a continuation row is: NO date, NO amount, but YES description.
    const isNewTransaction = hasDate && (hasDesc || hasAmt);

    if (isNewTransaction) {
      currentTx = { ...row };
      cleanRows.push(currentTx);
    } else {
      // Check if this row is a continuation of the previous transaction
      const isContinuation = !hasDate && !hasAmt && hasDesc && descCol;
      
      if (isContinuation && currentTx && descCol) {
        const prevNarration = String(currentTx[descCol] || '').trim();
        const nextNarration = String(rawDesc).trim();

        // Safe concat using boundary checks
        const lastChar = prevNarration.charAt(prevNarration.length - 1);
        const firstChar = nextNarration.charAt(0);
        const isAlphanumeric = (ch: string) => /[a-zA-Z0-9]/.test(ch);

        if (prevNarration && nextNarration) {
          if (isAlphanumeric(lastChar) && isAlphanumeric(firstChar)) {
            currentTx[descCol] = prevNarration + nextNarration;
          } else {
            currentTx[descCol] = prevNarration + ' ' + nextNarration;
          }
        } else if (nextNarration) {
          currentTx[descCol] = nextNarration;
        }

        mergedCount++;
        console.log(`[Parser] Merged continuation row ${idx + 1} narration "${nextNarration}" into transaction at clean row index ${cleanRows.length}`);
      } else {
        // If it is neither a new transaction nor a continuation, it represents a skipped row (e.g. blank spacer row)
        console.log(`[Parser] Skipped blank or non-financial row at raw index ${idx + 1}: ${JSON.stringify(row)}`);
      }
    }
  });

  return {
    cleanRows,
    mergedCount
  };
};
