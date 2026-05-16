import { supabase } from './supabase';
import { normalizeVendorName } from './vendorEngine';

/**
 * Risk Detection Engine
 * Identifies financial anomalies and risks from transaction data.
 */

const normalizeForDuplicateCheck = (desc: string): string => {
  return desc
    .toLowerCase()
    .replace(/duplicate|copy|re-run/gi, '')
    .replace(/invoice|bill|#\d+/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const isGenericVendorPaymentDescription = (desc: string): boolean => {
  const genericTerms = [
    'vendor payment',
    'payment to vendor',
    'supplier payment',
    'invoice payment',
    'vendor payout',
    'service payment',
    'payout to',
    'paid to'
  ];
  const normalized = desc.toLowerCase().trim();
  return genericTerms.some(term => normalized.includes(term));
};

export const analyzeRisksForClient = async (orgId: string, clientId: string) => {
  // 1. Fetch all transactions
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('client_id', clientId)
    .order('transaction_date', { ascending: false });

  if (error) throw error;
  if (!txs || txs.length === 0) return [];

  const risks: any[] = [];

  // --- 1. Duplicate Detection (Multi-Tier) ---
  const processedIndices = new Set<number>();

  for (let i = 0; i < txs.length; i++) {
    if (processedIndices.has(i)) continue;
    
    const current = txs[i];
    const currentNorm = normalizeForDuplicateCheck(current.description);
    const currentAmt = Math.abs(current.amount);
    const currentDate = new Date(current.transaction_date);
    const currentIsGeneric = isGenericVendorPaymentDescription(current.description);
    
    const group = [current];
    let tier: 'high' | 'medium' = 'high';
    
    for (let j = i + 1; j < txs.length; j++) {
      if (processedIndices.has(j)) continue;
      
      const other = txs[j];
      const otherNorm = normalizeForDuplicateCheck(other.description);
      const otherAmt = Math.abs(other.amount);
      const otherDate = new Date(other.transaction_date);
      const otherIsGeneric = isGenericVendorPaymentDescription(other.description);
      
      // Tier 1 — Strong duplicate, high severity
      const isExplicitDuplicate = (current.description.toLowerCase().includes('duplicate') || 
                                  other.description.toLowerCase().includes('duplicate')) &&
                                  Math.abs(currentAmt - otherAmt) < 0.01;

      const daysDiff = Math.abs(currentDate.getTime() - otherDate.getTime()) / (1000 * 60 * 60 * 24);
      const isSimilar = currentNorm === otherNorm && 
                        Math.abs(currentAmt - otherAmt) < 0.01 && 
                        daysDiff <= 7;

      if (isExplicitDuplicate || isSimilar) {
        group.push(other);
        processedIndices.add(j);
        tier = 'high';
        continue;
      }

      // Tier 2 — Possible duplicate, medium severity
      const isSameDate = currentDate.getTime() === otherDate.getTime();
      const isSameAmount = Math.abs(currentAmt - otherAmt) < 0.01;
      const bothExpenseLike = ['expense', 'vendor_payment', 'subscription'].includes(current.type) && 
                              ['expense', 'vendor_payment', 'subscription'].includes(other.type);
      
      if (isSameDate && isSameAmount && bothExpenseLike && (currentIsGeneric || otherIsGeneric)) {
        group.push(other);
        processedIndices.add(j);
        tier = 'medium';
      }
    }

    if (group.length > 1) {
      const isPossible = tier === 'medium';
      
      risks.push({
        organization_id: orgId,
        client_id: clientId,
        title: isPossible 
          ? `Possible duplicate vendor payment` 
          : `Duplicate Payment Suspected: ${group[0].description.replace(/ duplicate/gi, '')}`,
        severity: tier,
        risk_type: 'duplicate_payment_suspected',
        amount_at_risk: currentAmt,
        evidence: {
          transaction_ids: group.map(d => d.id),
          descriptions: group.map(d => d.description),
          dates: group.map(d => d.transaction_date),
          reason: isPossible 
            ? 'Multiple generic vendor payments with identical amounts found on the same date.'
            : group.some(d => d.description.toLowerCase().includes('duplicate')) 
              ? 'Explicit "duplicate" marker found in transaction description.'
              : 'Multiple entries with identical amounts and similar descriptions within a 7-day window.'
        },
        suggested_action: isPossible
          ? 'Verify whether these payments were made to distinct vendors or if one is a duplicate entry.'
          : 'Verify if these represent multiple services or a single erroneous billing event.',
        status: 'open',
        related_transaction_ids: group.map(d => d.id)
      });
    }
  }

  // --- 2. Subscription Detection (Improved) ---
  const vendorGroups: Record<string, any[]> = {};
  txs.forEach(tx => {
    const { normalized } = normalizeVendorName(tx.description);
    if (!normalized) return;
    if (!vendorGroups[normalized]) vendorGroups[normalized] = [];
    vendorGroups[normalized].push(tx);
  });

  Object.entries(vendorGroups).forEach(([vendor, cluster]) => {
    if (cluster.length >= 2) {
      // Check for similar amounts (+/- 5%) across different months
      const months = new Set(cluster.map(tx => new Date(tx.transaction_date).getMonth()));
      const years = new Set(cluster.map(tx => new Date(tx.transaction_date).getFullYear()));
      
      const hasMultipleMonths = months.size > 1 || years.size > 1;
      const baseAmt = Math.abs(cluster[0].amount);
      const consistentAmount = cluster.every(tx => Math.abs(Math.abs(tx.amount) - baseAmt) / baseAmt < 0.05);

      if (hasMultipleMonths && consistentAmount) {
        risks.push({
          organization_id: orgId,
          client_id: clientId,
          title: `Recurring Subscription: ${cluster[0].description.split(' ')[0]}`,
          severity: 'low',
          risk_type: 'recurring_subscription_detected',
          amount_at_risk: baseAmt,
          evidence: {
            frequency: 'Monthly (estimated)',
            transaction_count: cluster.length,
            vendor_name: vendor,
            consistent_amount: formatCurrency(baseAmt)
          },
          suggested_action: 'Audit this subscription to ensure continued utility and ROI.',
          status: 'open',
          related_transaction_ids: cluster.map(c => c.id)
        });
      }
    }
  });

  // --- 3. Unknown Transaction Type ---
  const unknownTxs = txs.filter(tx => tx.type === 'unknown');
  if (unknownTxs.length > 0) {
    risks.push({
      organization_id: orgId,
      client_id: clientId,
      title: 'Strategic Data Gap: Unclassified Entries',
      severity: 'medium',
      risk_type: 'unknown_transaction_type',
      amount_at_risk: unknownTxs.reduce((acc, tx) => acc + Math.abs(tx.amount), 0),
      evidence: {
        count: unknownTxs.length,
        samples: unknownTxs.slice(0, 3).map(tx => tx.description)
      },
      suggested_action: 'Perform manual classification to refine financial intelligence and reports.',
      status: 'open',
      related_transaction_ids: unknownTxs.map(tx => tx.id)
    });
  }

  // 2. Sync to database
  // First, delete existing open risks to prevent accumulation
  await supabase
    .from('risk_events')
    .delete()
    .eq('client_id', clientId)
    .eq('status', 'open');

  if (risks.length > 0) {
    const { error: insertErr } = await supabase
      .from('risk_events')
      .insert(risks);
    
    if (insertErr) {
      console.error('[Risk Engine] Insert error:', insertErr);
      throw insertErr;
    }
  }

  return risks;
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};
