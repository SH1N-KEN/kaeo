import { supabase } from '../supabase';

/**
 * Validates if a reference is a real, non-placeholder value.
 * Treating null, undefined, empty string, '0', and '0.00' as missing/placeholder references.
 */
export const isReferenceValValid = (ref: any): boolean => {
  if (ref === null || ref === undefined) return false;
  const str = String(ref).trim();
  return str !== '' && str !== '0' && str !== '0.00';
};

/**
 * Generates a unique, deterministic fingerprint for a financial transaction based on reference.
 * If reference is missing or a placeholder, returns null.
 */
export const generateFingerprint = (
  clientId: string,
  reference: any
): string | null => {
  if (!isReferenceValValid(reference)) return null;
  const cleanRef = String(reference).trim().toLowerCase();
  return `${clientId}_ref_${cleanRef}`;
};

export interface DuplicateReport {
  intraFileDuplicates: number;
  dbDuplicates: number;
  totalIncoming: number;
  importableCount: number;
  cleanTransactions: any[];
}

/**
 * Scans an array of incoming transactions, identifies intra-file duplicates,
 * queries the Supabase database, identifies matches, and returns a clean deduplicated list.
 */
export const checkDuplicateTransactions = async (
  clientId: string,
  incomingTransactions: any[]
): Promise<DuplicateReport> => {
  console.log("DEDUP_FIX_V2_ACTIVE");
  if (incomingTransactions.length === 0) {
    return { intraFileDuplicates: 0, dbDuplicates: 0, totalIncoming: 0, importableCount: 0, cleanTransactions: [] };
  }

  const seenFingerprints = new Set<string>();
  const uniqueIncoming: any[] = [];
  let intraFileDuplicates = 0;

  // 1. Identify intra-file duplicates (redundant rows in the same upload)
  incomingTransactions.forEach((tx) => {
    const fingerprint = generateFingerprint(clientId, tx.reference);

    if (fingerprint) {
      if (seenFingerprints.has(fingerprint)) {
        intraFileDuplicates++;
      } else {
        seenFingerprints.add(fingerprint);
        uniqueIncoming.push({
          ...tx,
          source_row_hash: fingerprint // store reference fingerprint in source_row_hash column!
        });
      }
    } else {
      // If a reference number isn't available for a row (or is a default placeholder like 0),
      // don't auto-dedupe it at all — flag it for manual review instead.
      uniqueIncoming.push({
        ...tx,
        source_row_hash: null,
        review_status: 'needs_review'
      });
    }
  });

  // 2. Query Supabase database to check against existing transactions
  // Fetch existing source_row_hashes and references for this client
  const { data: existingHashes, error } = await supabase
    .from('transactions')
    .select('source_row_hash, transaction_date, amount, description, reference')
    .eq('client_id', clientId);

  if (error) {
    console.error('[Duplicate Engine] Failed to query existing hashes:', error);
  }

  // Create a map of existing db fingerprints
  const dbFingerprints = new Set<string>();
  if (existingHashes) {
    existingHashes.forEach((tx) => {
      const fp = generateFingerprint(clientId, tx.reference);
      if (fp) {
        dbFingerprints.add(fp);
      } else if (tx.source_row_hash && tx.source_row_hash.startsWith(`${clientId}_ref_`)) {
        dbFingerprints.add(tx.source_row_hash);
      }
    });
  }

  // 3. Filter out DB duplicates
  const cleanTransactions: any[] = [];
  let dbDuplicates = 0;

  uniqueIncoming.forEach((tx) => {
    if (tx.source_row_hash && dbFingerprints.has(tx.source_row_hash)) {
      dbDuplicates++;
    } else {
      cleanTransactions.push(tx);
    }
  });

  return {
    intraFileDuplicates,
    dbDuplicates,
    totalIncoming: incomingTransactions.length,
    importableCount: cleanTransactions.length,
    cleanTransactions
  };
};
