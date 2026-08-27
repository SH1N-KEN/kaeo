import { supabase } from '../supabase';
import { isValidReference } from './referenceValidator';

export interface DuplicateReport {
  intraFileDuplicates: number;
  dbDuplicates: number;
  totalIncoming: number;
  importableCount: number;
  cleanTransactions: any[];
}

/**
 * Deterministic fingerprint for valid references.
 */
export const generateFingerprint = (clientId: string, reference: any): string | null => {
  if (!isValidReference(reference)) return null;
  const cleanRef = String(reference).trim().toLowerCase();
  return `${clientId}_ref_${cleanRef}`;
};

export const generateContentFingerprint = (
  clientId: string,
  dateStr: string,
  amtStr: string,
  descStr: string,
  typeStr: string
): string => {
  const cleanDesc = descStr.trim().toLowerCase();
  const cleanType = typeStr.trim().toLowerCase();
  return `${clientId}_sig_${dateStr}_${amtStr}_${cleanDesc}_${cleanType}`;
};

/**
 * Deduplicates transactions based on a general-purpose zero-special-casing strategy.
 */
export const checkDuplicateTransactions = async (
  clientId: string,
  incomingTransactions: any[]
): Promise<DuplicateReport> => {
  console.log('[Duplicate Engine] checkDuplicateTransactions active');
  
  if (incomingTransactions.length === 0) {
    return { intraFileDuplicates: 0, dbDuplicates: 0, totalIncoming: 0, importableCount: 0, cleanTransactions: [] };
  }

  // 1. Fetch existing hashes from Supabase
  let dbFingerprints = new Set<string>();
  try {
    const { data: existingHashes, error } = await supabase
      .from('transactions')
      .select('source_row_hash, reference')
      .eq('client_id', clientId);

    if (error) {
      console.error('[Duplicate Engine] Failed to query existing hashes:', error);
    } else if (existingHashes) {
      existingHashes.forEach((tx) => {
        const fp = generateFingerprint(clientId, tx.reference);
        if (fp) {
          dbFingerprints.add(fp);
        }
        if (tx.source_row_hash) {
          dbFingerprints.add(tx.source_row_hash);
        }
      });
    }
  } catch (err) {
    console.error('[Duplicate Engine] Unexpected error querying DB:', err);
  }

  const seenRefs = new Set<string>();
  const seenSignatures = new Set<string>(); // for reference-less transactions
  const cleanTransactions: any[] = [];
  
  let intraFileDuplicates = 0;
  let dbDuplicates = 0;

  incomingTransactions.forEach((tx, idx) => {
    const ref = tx.reference;
    const hasValidRef = isValidReference(ref);

    if (hasValidRef) {
      const fingerprint = generateFingerprint(clientId, ref)!;

      if (seenRefs.has(fingerprint)) {
        intraFileDuplicates++;
        console.log(`[Duplicate Engine] Dropped row ${idx + 1}: Intra-file duplicate with valid reference "${ref}"`);
      } else if (dbFingerprints.has(fingerprint)) {
        dbDuplicates++;
        console.log(`[Duplicate Engine] Dropped row ${idx + 1}: Database duplicate with valid reference "${ref}"`);
      } else {
        seenRefs.add(fingerprint);
        cleanTransactions.push({
          ...tx,
          source_row_hash: fingerprint
        });
      }
    } else {
      // Reference is missing or invalid placeholder:
      // Deduplicate WITHIN the upload and AGAINST the database using content signatures
      const dateStr = tx.transaction_date ? new Date(tx.transaction_date).toISOString() : '';
      const amtStr = String(tx.amount);
      const descStr = String(tx.description || '').trim().toLowerCase();
      const typeStr = String(tx.type || '');
      const signatureFingerprint = generateContentFingerprint(clientId, dateStr, amtStr, descStr, typeStr);

      if (seenSignatures.has(signatureFingerprint)) {
        intraFileDuplicates++;
        console.log(`[Duplicate Engine] Dropped row ${idx + 1}: Intra-file duplicate reference-less transaction. Signature: "${signatureFingerprint}"`);
      } else if (dbFingerprints.has(signatureFingerprint)) {
        dbDuplicates++;
        console.log(`[Duplicate Engine] Dropped row ${idx + 1}: Database duplicate reference-less transaction. Signature: "${signatureFingerprint}"`);
      } else {
        seenSignatures.add(signatureFingerprint);
        
        // "Flag any reference-less transaction for manual review regardless of dedup outcome."
        cleanTransactions.push({
          ...tx,
          source_row_hash: signatureFingerprint,
          review_status: 'needs_review'
        });
      }
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
