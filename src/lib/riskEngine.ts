import { supabase } from './supabase';
import { normalizeVendorName } from './vendorEngine';

/**
 * Risk Detection Engine
 * Identifies financial anomalies and risks from transaction data.
 */

export const analyzeRisksForClient = async (orgId: string, clientId: string) => {
  // 1. Fetch all transactions
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('client_id', clientId);

  if (error) throw error;
  if (!txs || txs.length === 0) return [];

  const risks: any[] = [];

  // --- Duplicate Detection ---
  const seenMap: Record<string, any[]> = {};
  txs.forEach(tx => {
    const amt = Math.abs(tx.amount);
    const date = new Date(tx.transaction_date).toISOString().split('T')[0];
    const key = `${amt}-${date}`; // Exact amount and date

    if (!seenMap[key]) seenMap[key] = [];
    seenMap[key].push(tx);
  });

  Object.values(seenMap).forEach(duplicates => {
    if (duplicates.length > 1) {
      risks.push({
        organization_id: orgId,
        client_id: clientId,
        title: 'Duplicate Payment Suspected',
        severity: 'high',
        risk_type: 'duplicate_payment_suspected',
        amount_at_risk: Math.abs(duplicates[0].amount),
        evidence: {
          transaction_ids: duplicates.map(d => d.id),
          descriptions: duplicates.map(d => d.description),
          reason: 'Identical amount and date detected across multiple entries.'
        },
        suggested_action: 'Verify if these are distinct services or a double-billing error.',
        status: 'open',
        related_transaction_ids: duplicates.map(d => d.id)
      });
    }
  });

  // --- Subscription Detection ---
  const vendorClusters: Record<string, any[]> = {};
  txs.forEach(tx => {
    const { normalized } = normalizeVendorName(tx.description);
    if (!normalized) return;
    if (!vendorClusters[normalized]) vendorClusters[normalized] = [];
    vendorClusters[normalized].push(tx);
  });

  Object.entries(vendorClusters).forEach(([vendor, cluster]) => {
    if (cluster.length >= 2) {
      // Check for similar amounts across different months
      const months = new Set(cluster.map(tx => new Date(tx.transaction_date).getMonth()));
      if (months.size >= 2) {
        risks.push({
          organization_id: orgId,
          client_id: clientId,
          title: `Recurring Subscription: ${vendor}`,
          severity: 'low',
          risk_type: 'recurring_subscription_detected',
          amount_at_risk: Math.abs(cluster[0].amount),
          evidence: {
            frequency: 'Monthly (estimated)',
            transaction_count: cluster.length,
            vendor_name: vendor
          },
          suggested_action: 'Review if this software/service is still providing ROI.',
          status: 'open',
          related_transaction_ids: cluster.map(c => c.id)
        });
      }
    }
  });

  // --- Unknown Transaction Type ---
  const unknownTxs = txs.filter(tx => tx.type === 'unknown');
  if (unknownTxs.length > 0) {
    risks.push({
      organization_id: orgId,
      client_id: clientId,
      title: 'Uncategorized Transactions',
      severity: 'medium',
      risk_type: 'unknown_transaction_type',
      amount_at_risk: unknownTxs.reduce((acc, tx) => acc + Math.abs(tx.amount), 0),
      evidence: {
        count: unknownTxs.length,
        samples: unknownTxs.slice(0, 3).map(tx => tx.description)
      },
      suggested_action: 'Manual classification required to improve strategic accuracy.',
      status: 'open',
      related_transaction_ids: unknownTxs.map(tx => tx.id)
    });
  }

  // 2. Sync to database
  if (risks.length > 0) {
    const { error: insertErr } = await supabase
      .from('risk_events')
      .upsert(risks, { onConflict: 'client_id, title, risk_type' }); // Simple conflict check
    
    if (insertErr) console.error('[Risk Engine] Sync error:', insertErr);
  }

  return risks;
};
