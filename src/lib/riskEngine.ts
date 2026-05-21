import { supabase } from './supabase';
import { normalizeVendorName, inferCategory } from './vendorEngine';

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
    'service payment',
    'vendor payout',
    'bill payment',
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
    const currentAmt = Math.abs(current.amount);
    const currentDate = new Date(current.transaction_date);
    const currentNorm = normalizeForDuplicateCheck(current.description);
    const currentIsGeneric = isGenericVendorPaymentDescription(current.description);
    
    const group = [current];
    let tier: 'high' | 'medium' = 'high';
    
    for (let j = i + 1; j < txs.length; j++) {
      if (processedIndices.has(j)) continue;
      
      const other = txs[j];
      const otherAmt = Math.abs(other.amount);
      const otherDate = new Date(other.transaction_date);
      const otherNorm = normalizeForDuplicateCheck(other.description);
      const otherIsGeneric = isGenericVendorPaymentDescription(other.description);
      
      // Match criteria:
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
        description: isPossible 
          ? 'Multiple generic vendor payments with identical amounts found on the same date.'
          : 'Multiple entries with identical amounts and similar descriptions within a 7-day window.',
        evidence_json: {
          transaction_ids: group.map(d => d.id),
          descriptions: group.map(d => d.description),
          dates: group.map(d => d.transaction_date),
          reason: isPossible 
            ? 'Generic vendor labels found with matching financials on the same day.'
            : group.some(d => d.description.toLowerCase().includes('duplicate')) 
              ? 'Explicit "duplicate" marker found in transaction description.'
              : 'Structural similarity in description and financial data.'
        },
        suggested_action: isPossible
          ? 'Verify whether these payments were made to distinct vendors or if one is a duplicate entry.'
          : 'Verify if these represent multiple services or a single erroneous billing event.',
        status: 'open',
        related_transaction_ids: group.map(d => d.id)
      });
    }
  }

  // --- 2. Subscription Detection ---
  const vendorGroups: Record<string, any[]> = {};
  txs.filter(tx => ['expense', 'vendor_payment', 'subscription'].includes(tx.type))
     .forEach(tx => {
       const { normalized } = normalizeVendorName(tx.description);
       if (!normalized) return;
       if (!vendorGroups[normalized]) vendorGroups[normalized] = [];
       vendorGroups[normalized].push(tx);
     });

  Object.entries(vendorGroups).forEach(([vendor, cluster]) => {
    if (cluster.length >= 2) {
      const months = new Set(cluster.map(tx => new Date(tx.transaction_date).getMonth()));
      const years = new Set(cluster.map(tx => new Date(tx.transaction_date).getFullYear()));
      const hasMultipleMonths = months.size > 1 || years.size > 1;
      const baseAmt = Math.abs(cluster[0].amount);
      const consistentAmount = cluster.every(tx => Math.abs(Math.abs(tx.amount) - baseAmt) / baseAmt < 0.05);

      const category = inferCategory(vendor);
      const isSubscriptionKeyword = vendor.includes('subscription') || 
                                    vendor.includes('monthly') || 
                                    vendor.includes('software') ||
                                    ['slack', 'zoho', 'canva'].includes(vendor.toLowerCase()) ||
                                    cluster.some((tx: any) => 
                                      tx.description.toLowerCase().includes('subscription') ||
                                      tx.description.toLowerCase().includes('monthly') ||
                                      tx.description.toLowerCase().includes('software') ||
                                      tx.description.toLowerCase().includes('sub')
                                    );

      const excludeRecurring = ['Payroll', 'Vendor / Services', 'Marketing', 'Office'].includes(category);
      
      const isRecurring = hasMultipleMonths && consistentAmount && (!excludeRecurring || isSubscriptionKeyword);

      if (isRecurring) {
        risks.push({
          organization_id: orgId,
          client_id: clientId,
          title: `Recurring Subscription: ${cluster[0].description.split(' ')[0]}`,
          severity: 'low',
          risk_type: 'recurring_subscription_detected',
          amount_at_risk: baseAmt,
          description: `Detected ${cluster.length} recurring payments for ${vendor}.`,
          evidence_json: {
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
      description: `${unknownTxs.length} transactions could not be automatically classified.`,
      evidence_json: {
        count: unknownTxs.length,
        samples: unknownTxs.slice(0, 3).map(tx => tx.description)
      },
      suggested_action: 'Perform manual classification to refine financial intelligence and reports.',
      status: 'open',
      related_transaction_ids: unknownTxs.map(tx => tx.id)
    });
  }

  // --- 4. Unusual Vendor Payment (MVP) ---
  const expenses = txs.filter(tx => tx.amount < 0).map(tx => Math.abs(tx.amount));
  if (expenses.length > 5) {
    const sorted = [...expenses].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    txs.filter(tx => tx.type === 'vendor_payment' || tx.type === 'expense').forEach(tx => {
      const amt = Math.abs(tx.amount);
      if (amt > median * 10 && amt > 100000) {
        risks.push({
          organization_id: orgId,
          client_id: clientId,
          title: `Unusual High-Value Payment: ${tx.description.split(' ')[0]}`,
          severity: 'high',
          risk_type: 'unusual_vendor_payment',
          amount_at_risk: amt,
          description: `Payment of ${formatCurrency(amt)} is 10x higher than your median expense.`,
          evidence_json: {
            median_expense: formatCurrency(median),
            actual_expense: formatCurrency(amt),
            transaction_id: tx.id
          },
          suggested_action: 'Confirm this large outflow was planned and has proper authorization.',
          status: 'open',
          related_transaction_ids: [tx.id]
        });
      }
    });
  }

  // 2. Sync to database
  // Delete existing open risks to prevent accumulation
  await supabase
    .from('risk_events')
    .delete()
    .eq('client_id', clientId)
    .eq('status', 'open');

  if (risks.length > 0) {
    try {
      const { error: insertErr } = await supabase
        .from('risk_events')
        .insert(risks);
      
      if (insertErr) {
        if (insertErr.message?.includes('column') && insertErr.message?.includes('does not exist')) {
          throw new Error('Database schema is out of date. Run latest Phase 5 repair migration (0007).');
        }
        throw insertErr;
      }
    } catch (err: any) {
      console.error('[Risk Engine] Sync error:', err);
      throw err;
    }
  }

  return risks;
};

const formatCurrency = (val: number) => {
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(absVal);
  return isNegative ? `-${formatted}` : formatted;
};
