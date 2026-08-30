import { supabase } from '../supabase';
import type { ReconciliationRunResult, ReconciliationMatchResult } from '../../types/reconciliation';
import type { NormalizedTransaction } from '../../types/finance';

export interface ReconciliationRunDb {
  id: string;
  workspace_id: string;
  client_id: string | null;
  bank_file_id: string | null;
  processor_file_id: string | null;
  status: string;
  created_at: string;
  completed_at: string;
  summary: any;
  source_metadata: any;
}

export interface ReconciliationRecordDb {
  id: string;
  run_id: string;
  status: string;
  processor_transaction_id: string | null;
  bank_transaction_id: string | null;
  processor_amount: number | null;
  bank_amount: number | null;
  normalized_amount: number | null;
  processor_date: string | null;
  bank_date: string | null;
  processor_description: string | null;
  bank_description: string | null;
  processor_reference: string | null;
  bank_reference: string | null;
  confidence: number | null;
  evidence: any;
  reason: string | null;
  audit_log: any;
  created_at: string;
}

/**
 * Tries to find a matching transaction ID in the database to link it as a foreign key.
 */
function findDbTransactionId(
  tx: NormalizedTransaction | undefined,
  dbTransactions: any[]
): string | null {
  if (!tx || !tx.id || tx.id.startsWith('virtual-')) return null;

  // Try to find a match in the database transactions by amount, date, and description
  const match = dbTransactions.find(dbTx => {
    // 1. Amount match (absolute comparison)
    const amountDiff = Math.abs(Math.abs(dbTx.amount) - Math.abs(tx.amount));
    if (amountDiff > 0.01) return false;

    // 2. Date match
    if (dbTx.transaction_date !== tx.transaction_date) return false;

    // 3. Description or Reference match
    const dbDesc = (dbTx.description || '').toLowerCase();
    const txDesc = (tx.description || '').toLowerCase();
    if (dbDesc === txDesc) return true;

    const dbRef = (dbTx.reference || '').toLowerCase();
    const txRef = (tx.raw_row_json?.reference || tx.raw_row_json?.utr || '').toLowerCase();
    if (txRef && dbRef === txRef) return true;

    if (dbDesc.includes(txDesc) || txDesc.includes(dbDesc)) return true;

    return false;
  });

  return match ? match.id : null;
}

/**
 * Creates a reconciliation run and all its child records atomically.
 */
export async function createReconciliationRun(
  workspaceId: string,
  clientId: string | null,
  bankFileId: string | null,
  processorFileId: string | null,
  summary: ReconciliationRunResult['summary'],
  results: ReconciliationMatchResult[],
  sourceMetadata: {
    bank_file_name: string;
    processor_file_name: string;
    bank_file_size?: number;
    processor_file_size?: number;
    bank_row_count?: number;
    processor_row_count?: number;
  }
): Promise<string> {
  // Fetch existing transactions for this client/workspace to link records where they exist
  let dbTransactions: any[] = [];
  try {
    const query = supabase
      .from('transactions')
      .select('id, transaction_date, amount, description, reference')
      .eq('organization_id', workspaceId);

    if (clientId) {
      query.eq('client_id', clientId);
    }

    const { data } = await query;
    if (data) {
      dbTransactions = data;
    }
  } catch (err) {
    console.error('Error fetching transactions for matching:', err);
  }

  // Map results to database record structures
  const recordInserts = results.map(r => {
    const procTx = r.processorRecord?.transaction;
    const bankTx = r.bankRecord?.transaction;

    const procTxId = findDbTransactionId(procTx, dbTransactions);
    const bankTxId = findDbTransactionId(bankTx, dbTransactions);

    return {
      status: r.decision.status,
      processor_transaction_id: procTxId,
      bank_transaction_id: bankTxId,
      processor_amount: procTx ? procTx.amount : null,
      bank_amount: bankTx ? bankTx.amount : null,
      normalized_amount: r.decision.evidence.normalizedSettlementAmount ?? (procTx ? Math.abs(procTx.amount) : (bankTx ? Math.abs(bankTx.amount) : null)),
      processor_date: procTx?.transaction_date || null,
      bank_date: bankTx?.transaction_date || null,
      processor_description: procTx?.description || null,
      bank_description: bankTx?.description || null,
      processor_reference: procTx?.raw_row_json?.reference || procTx?.raw_row_json?.utr || null,
      bank_reference: bankTx?.raw_row_json?.reference || bankTx?.raw_row_json?.utr || null,
      confidence: r.decision.evidence.confidenceScore ?? null,
      evidence: r.decision.evidence,
      reason: r.decision.reason,
      audit_log: r.auditTrail
    };
  });

  // Call the atomic postgres function RPC
  const { data: runId, error } = await supabase.rpc('create_reconciliation_run_atomic', {
    p_workspace_id: workspaceId,
    p_client_id: clientId,
    p_bank_file_id: bankFileId,
    p_processor_file_id: processorFileId,
    p_summary: summary,
    p_source_metadata: sourceMetadata,
    p_records: recordInserts
  });

  if (error) {
    console.error('Error in createReconciliationRun atomic RPC:', error);
    throw new Error(`Failed to persist reconciliation run: ${error.message}`);
  }

  return runId as string;
}

/**
 * Fetches the latest reconciliation run for the workspace and client.
 */
export async function getLatestReconciliationRun(
  workspaceId: string,
  clientId: string | null
): Promise<ReconciliationRunDb | null> {
  const query = supabase
    .from('reconciliation_runs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (clientId) {
    query.eq('client_id', clientId);
  } else {
    query.is('client_id', null);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching latest reconciliation run:', error);
    throw error;
  }

  return data && data.length > 0 ? (data[0] as ReconciliationRunDb) : null;
}

/**
 * Retrieves details for a specific reconciliation run.
 */
export async function getReconciliationRun(runId: string): Promise<ReconciliationRunDb> {
  const { data, error } = await supabase
    .from('reconciliation_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (error) {
    console.error(`Error fetching reconciliation run ${runId}:`, error);
    throw error;
  }

  return data as ReconciliationRunDb;
}

/**
 * Lists all reconciliation runs for a workspace/client.
 */
export async function listReconciliationRuns(
  workspaceId: string,
  clientId: string | null
): Promise<ReconciliationRunDb[]> {
  const query = supabase
    .from('reconciliation_runs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (clientId) {
    query.eq('client_id', clientId);
  } else {
    query.is('client_id', null);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error listing reconciliation runs:', error);
    throw error;
  }

  return data as ReconciliationRunDb[];
}

/**
 * Fetches all child records for a reconciliation run.
 */
export async function getReconciliationRecords(runId: string): Promise<ReconciliationRecordDb[]> {
  const { data, error } = await supabase
    .from('reconciliation_records')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(`Error fetching records for run ${runId}:`, error);
    throw error;
  }

  return data as ReconciliationRecordDb[];
}

/**
 * Reconstructs a full ReconciliationRunResult from a DB run and its child records.
 */
export function reconstructReconciliationResult(
  run: ReconciliationRunDb,
  records: ReconciliationRecordDb[]
): ReconciliationRunResult {
  const results: ReconciliationMatchResult[] = records.map(dbRec => {
    const procTx: NormalizedTransaction = {
      id: dbRec.processor_transaction_id || `virtual-${dbRec.id}-proc`,
      organization_id: run.workspace_id,
      client_id: run.client_id || '',
      import_id: null,
      file_id: run.processor_file_id,
      transaction_date: dbRec.processor_date || '',
      description: dbRec.processor_description || 'Missing Processor Record',
      amount: Number(dbRec.processor_amount || 0),
      currency: 'INR',
      type: 'unknown',
      category: null,
      counterparty_name: null,
      source_provider: null,
      raw_row_json: {
        reference: dbRec.processor_reference || undefined
      }
    };

    const matchResult: ReconciliationMatchResult = {
      processorRecord: { transaction: procTx },
      decision: {
        status: dbRec.status as any,
        reason: dbRec.reason || '',
        verificationPassed: dbRec.status === 'MATCHED' || dbRec.status === 'PENDING' || dbRec.status === 'PROCESSING' || dbRec.status === 'OUT_OF_SCOPE',
        evidence: dbRec.evidence || {}
      },
      auditTrail: Array.isArray(dbRec.audit_log) ? dbRec.audit_log : []
    };

    if (dbRec.bank_amount !== null || dbRec.bank_description || dbRec.bank_date) {
      matchResult.bankRecord = {
        transaction: {
          id: dbRec.bank_transaction_id || `virtual-${dbRec.id}-bank`,
          organization_id: run.workspace_id,
          client_id: run.client_id || '',
          import_id: null,
          file_id: run.bank_file_id,
          transaction_date: dbRec.bank_date || '',
          description: dbRec.bank_description || 'Missing Bank Record',
          amount: Number(dbRec.bank_amount || 0),
          currency: 'INR',
          type: 'unknown',
          category: null,
          counterparty_name: null,
          source_provider: null,
          raw_row_json: {
            reference: dbRec.bank_reference || undefined
          }
        }
      };
    }

    return matchResult;
  });

  const outOfScopeBankTxns = results
    .filter(r => r.decision.status === 'OUT_OF_SCOPE' && r.bankRecord)
    .map(r => r.bankRecord!.transaction);

  return {
    summary: run.summary,
    results,
    outOfScopeBankTxns
  };
}

/**
 * Updates an individual reconciliation record.
 */
export async function updateReconciliationRecord(
  recordId: string,
  updates: Partial<ReconciliationRecordDb>
): Promise<void> {
  const { error } = await supabase
    .from('reconciliation_records')
    .update(updates)
    .eq('id', recordId);

  if (error) {
    console.error(`Error updating reconciliation record ${recordId}:`, error);
    throw new Error(`Failed to update reconciliation record: ${error.message}`);
  }
}

