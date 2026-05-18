import { supabase } from '../supabase';

/**
 * Generates a unique, deterministic fingerprint for a financial transaction.
 * Scrapes date (date portion), absolute amount, and cleaned description to resist minor text changes.
 */
export const generateFingerprint = (
  clientId: string,
  txDate: string,
  amount: number,
  description: string
): string => {
  const dateStr = new Date(txDate).toISOString().split('T')[0];
  const absAmount = Math.abs(amount).toFixed(2);
  const cleanDesc = description.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  
  return `${clientId}_${dateStr}_${absAmount}_${cleanDesc}`;
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
  if (incomingTransactions.length === 0) {
    return { intraFileDuplicates: 0, dbDuplicates: 0, totalIncoming: 0, importableCount: 0, cleanTransactions: [] };
  }

  const seenFingerprints = new Set<string>();
  const uniqueIncoming: any[] = [];
  let intraFileDuplicates = 0;

  // 1. Identify intra-file duplicates (redundant rows in the same upload)
  incomingTransactions.forEach((tx) => {
    const fingerprint = generateFingerprint(
      clientId,
      tx.transaction_date,
      tx.amount,
      tx.description
    );

    if (seenFingerprints.has(fingerprint)) {
      intraFileDuplicates++;
    } else {
      seenFingerprints.add(fingerprint);
      uniqueIncoming.push({
        ...tx,
        source_row_hash: fingerprint // store fingerprint in source_row_hash column!
      });
    }
  });

  // 2. Query Supabase database to check against existing transactions
  // To optimize, we'll fetch existing source_row_hashes for this client
  const { data: existingHashes, error } = await supabase
    .from('transactions')
    .select('source_row_hash, transaction_date, amount, description')
    .eq('client_id', clientId);

  if (error) {
    console.error('[Duplicate Engine] Failed to query existing hashes:', error);
  }

  // Create a map of existing db fingerprints
  const dbFingerprints = new Set<string>();
  if (existingHashes) {
    existingHashes.forEach((tx) => {
      if (tx.source_row_hash) {
        dbFingerprints.add(tx.source_row_hash);
      } else {
        // Build fallback fingerprint if source_row_hash isn't filled for historical rows
        const fp = generateFingerprint(clientId, tx.transaction_date, tx.amount, tx.description);
        dbFingerprints.add(fp);
      }
    });
  }

  // 3. Filter out DB duplicates
  const cleanTransactions: any[] = [];
  let dbDuplicates = 0;

  uniqueIncoming.forEach((tx) => {
    if (dbFingerprints.has(tx.source_row_hash)) {
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
