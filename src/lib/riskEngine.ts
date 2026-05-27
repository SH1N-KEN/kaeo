import { supabase } from './supabase';
import { normalizeVendorName, inferCategory } from './vendorEngine';
import { getSpendRules } from './spendRulesEngine';
import { getDisplayCategory } from './categoryEngine';
import { matchInvoicesToTransactions } from './invoice/invoiceMatcher';
import { formatINR } from './formatters';
import { getCleanTransactions } from './transactionFilters';

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
  const { data: rawTxs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('client_id', clientId)
    .order('transaction_date', { ascending: false });

  if (error) throw error;
  if (!rawTxs || rawTxs.length === 0) return [];

  const txs = getCleanTransactions(rawTxs);

  const baseCurrency = 'INR';

  const fmtCurrency = (val: number) => {
    return formatINR(val);
  };

  const getTxAmount = (t: any) => {
    return t.amount_in_base_currency !== null && t.amount_in_base_currency !== undefined
      ? Number(t.amount_in_base_currency)
      : Number(t.amount);
  };

  // Fetch invoices for matching
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', clientId);

  const { matches: invoiceMatches, risks: invoiceRisks } = matchInvoicesToTransactions(invoices || [], txs, baseCurrency);

  // Sync matches to the database
  if (invoices && invoices.length > 0) {
    const invoiceIds = invoices.map(i => i.id);
    // Delete old matches for these invoices
    await supabase
      .from('invoice_matches')
      .delete()
      .in('invoice_id', invoiceIds);

    const matchesToInsert = invoiceMatches
      .filter(m => m.transaction_id !== null)
      .map(m => ({
        invoice_id: m.invoice_id,
        transaction_id: m.transaction_id,
        match_status: m.match_status,
        confidence: m.confidence,
        reason: m.reason
      }));

    if (matchesToInsert.length > 0) {
      await supabase
        .from('invoice_matches')
        .insert(matchesToInsert);
    }
  }

  // 2. Fetch spend rules
  const rules = await getSpendRules(orgId);
  const getRule = (type: string) => rules.find(r => r.rule_type === type && r.enabled);

  const duplicateRule = getRule('duplicate_payment');
  const highValueRule = getRule('high_value_payment');
  const subRule = getRule('subscription_threshold');
  const unknownVendorRule = getRule('unknown_vendor');
  const uncategorizedRule = getRule('uncategorized_transaction');

  const risks: any[] = [];

  // --- 1. Duplicate Detection (Multi-Tier) ---
  if (duplicateRule) {
    const thresholdDays = duplicateRule.threshold_days || 7;
    const processedIndices = new Set<number>();

    for (let i = 0; i < txs.length; i++) {
      if (processedIndices.has(i)) continue;
      
      const current = txs[i];
      const currentAmt = Math.abs(getTxAmount(current));
      const currentDate = new Date(current.transaction_date);
      const currentNorm = normalizeForDuplicateCheck(current.description);
      const currentIsGeneric = isGenericVendorPaymentDescription(current.description);
      
      const group = [current];
      let tier: 'high' | 'medium' = 'high';
      
      for (let j = i + 1; j < txs.length; j++) {
        if (processedIndices.has(j)) continue;
        
        const other = txs[j];
        const otherAmt = Math.abs(getTxAmount(other));
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
                          daysDiff <= thresholdDays;

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
          risk_type: 'duplicate_payment',
          amount_at_risk: currentAmt * group.length,
          description: isPossible 
            ? 'Multiple generic vendor payments with identical amounts found on the same date.'
            : `Multiple entries with identical amounts and similar descriptions within a ${thresholdDays}-day window.`,
            evidence_json: {
              transaction_ids: group.map(d => d.id),
              descriptions: group.map(d => d.description),
              dates: group.map(d => d.transaction_date),
              original_currency: group[0].original_currency || group[0].currency || baseCurrency,
              exchange_rate: group[0].exchange_rate || 1,
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
      const baseAmt = Math.abs(getTxAmount(cluster[0]));
      const consistentAmount = cluster.every(tx => Math.abs(Math.abs(getTxAmount(tx)) - baseAmt) / baseAmt < 0.05);

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
        // Only flag as risk if it exceeds subscription_threshold rule (if active)
        const subThreshold = subRule?.threshold_amount || 0;
        if (!subRule || baseAmt >= subThreshold) {
          risks.push({
            organization_id: orgId,
            client_id: clientId,
            title: `Recurring Subscription: ${cluster[0].description.split(' ')[0]}`,
            severity: 'low',
            risk_type: 'recurring_subscription',
            amount_at_risk: baseAmt,
            description: `Detected ${cluster.length} recurring payments for ${vendor}.`,
            evidence_json: {
              frequency: 'Monthly (estimated)',
              transaction_count: cluster.length,
              vendor_name: vendor,
              consistent_amount: fmtCurrency(baseAmt),
              original_currency: cluster[0].original_currency || cluster[0].currency || baseCurrency,
              exchange_rate: cluster[0].exchange_rate || 1
            },
            suggested_action: 'Audit this subscription to ensure continued utility and ROI.',
            status: 'open',
            related_transaction_ids: cluster.map(c => c.id)
          });
        }
      }
    }
  });

  // --- 3. Missing Data / Unknown Transaction Type ---
  // Only create this risk if there are materially significant unknowns
  // (count > 5 AND total value > ₹25,000) — prevents one-risk-per-row spam
  const unknownTxs = txs.filter(tx => tx.type === 'unknown');
  const unknownTotal = unknownTxs.reduce((acc, tx) => acc + Math.abs(getTxAmount(tx)), 0);
  const UNKNOWN_COUNT_THRESHOLD = 5;
  const UNKNOWN_VALUE_THRESHOLD = 25000;
  if (unknownTxs.length > UNKNOWN_COUNT_THRESHOLD && unknownTotal > UNKNOWN_VALUE_THRESHOLD) {
    risks.push({
      organization_id: orgId,
      client_id: clientId,
      title: `Missing Data: ${unknownTxs.length} Unclassified Transactions`,
      severity: 'medium',
      risk_type: 'missing_data',
      amount_at_risk: unknownTotal,
      description: `${unknownTxs.length} transactions (totalling ${fmtCurrency(unknownTotal)}) could not be automatically classified. Review and categorize to improve accuracy.`,
      evidence_json: {
        count: unknownTxs.length,
        total_value: unknownTotal,
        samples: unknownTxs.slice(0, 5).map(tx => tx.description)
      },
      suggested_action: 'Review these transactions and assign categories to refine financial intelligence.',
      status: 'open',
      related_transaction_ids: unknownTxs.map(tx => tx.id)
    });
  }

  // --- 4. High-Value Payment (using Rule) ---
  if (highValueRule && highValueRule.threshold_amount != null) {
    txs.filter(tx => {
      const val = getTxAmount(tx);
      return val < 0 && Math.abs(val) >= (highValueRule.threshold_amount ?? 50000);
    }).forEach(tx => {
      const amt = Math.abs(getTxAmount(tx));
      risks.push({
        organization_id: orgId,
        client_id: clientId,
        title: `High-Value Payment: ${tx.description.split(' ')[0]}`,
        severity: 'high',
        risk_type: 'high_value_payment',
        amount_at_risk: amt,
        description: `Payment of ${fmtCurrency(amt)} exceeds rule threshold of ${fmtCurrency(highValueRule.threshold_amount!)}.`,
        evidence_json: {
          threshold: fmtCurrency(highValueRule.threshold_amount!),
          actual_expense: fmtCurrency(amt),
          transaction_id: tx.id,
          original_currency: tx.original_currency || tx.currency || baseCurrency,
          exchange_rate: tx.exchange_rate || 1
        },
        suggested_action: 'Confirm this large outflow was planned and has proper authorization.',
        status: 'open',
        related_transaction_ids: [tx.id]
      });
    });
  } else {
    // Fallback: Unusual Spend relative to median
    const expenses = txs.filter(tx => getTxAmount(tx) < 0).map(tx => Math.abs(getTxAmount(tx)));
    if (expenses.length > 5) {
      const sorted = [...expenses].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      
      txs.filter(tx => tx.type === 'vendor_payment' || tx.type === 'expense').forEach(tx => {
        const amt = Math.abs(getTxAmount(tx));
        if (amt > median * 10 && amt > 100000) {
          risks.push({
            organization_id: orgId,
            client_id: clientId,
            title: `Unusual High-Value Payment: ${tx.description.split(' ')[0]}`,
            severity: 'high',
            risk_type: 'unusual_spend',
            amount_at_risk: amt,
            description: `Payment of ${fmtCurrency(amt)} is 10x higher than your median expense.`,
            evidence_json: {
              median_expense: fmtCurrency(median),
              actual_expense: fmtCurrency(amt),
              transaction_id: tx.id,
              original_currency: tx.original_currency || tx.currency || baseCurrency,
              exchange_rate: tx.exchange_rate || 1
            },
            suggested_action: 'Confirm this large outflow was planned and has proper authorization.',
            status: 'open',
            related_transaction_ids: [tx.id]
          });
        }
      });
    }
  }

  // --- Balance Mismatch Detection ---
  const balanceMismatchTxs = txs.filter(tx => tx.raw_row_json?.metadata?.balance_mismatch === true);
  balanceMismatchTxs.forEach(tx => {
    const amt = Math.abs(getTxAmount(tx));
    risks.push({
      organization_id: orgId,
      client_id: clientId,
      title: `Balance Mismatch: ${tx.description.split(' ')[0]}`,
      severity: 'high',
      risk_type: 'balance_mismatch',
      amount_at_risk: amt,
      description: `Balance movement does not match debit/credit amount for transaction on ${tx.transaction_date}.`,
      evidence_json: {
        transaction_id: tx.id,
        amount: getTxAmount(tx),
        description: tx.description,
        date: tx.transaction_date,
        original_currency: tx.original_currency || tx.currency || baseCurrency,
        exchange_rate: tx.exchange_rate || 1
      },
      suggested_action: 'Verify transaction amounts and reconcile against physical bank statement.',
      status: 'open',
      related_transaction_ids: [tx.id]
    });
  });

  // --- Unknown Counterparty High-Value Payments ---
  // Use absolute amount + outflow direction (not just amount < 0, which can fail on wrongly-signed rows)
  const cpHighValueThreshold = highValueRule?.threshold_amount || 50000;
  const unknownCpHighValueTxs = txs.filter(tx => {
    const amt = Math.abs(getTxAmount(tx));
    const isHighValue = amt >= cpHighValueThreshold;
    const hasNoCp = !tx.counterparty_name || tx.counterparty_name === 'No counterparty' || tx.counterparty_name.trim() === '';
    // Use direction_derived if available, fall back to amount sign
    const isOutflow = tx.raw_row_json?.direction_derived === 'outflow' || getTxAmount(tx) < 0;
    const isNotTransfer = tx.type !== 'transfer';
    return isOutflow && hasNoCp && isHighValue && isNotTransfer;
  });
  unknownCpHighValueTxs.forEach(tx => {
    const amt = Math.abs(getTxAmount(tx));
    risks.push({
      organization_id: orgId,
      client_id: clientId,
      title: `Unknown Counterparty: High-Value Outflow`,
      severity: 'high',
      risk_type: 'unknown_counterparty_high_value',
      amount_at_risk: amt,
      description: `A large outflow of ${fmtCurrency(amt)} was made to an unidentified counterparty. Verify the recipient.`,
      evidence_json: {
        transaction_id: tx.id,
        amount: amt,
        description: tx.description,
        date: tx.transaction_date,
        original_currency: tx.original_currency || tx.currency || baseCurrency,
        exchange_rate: tx.exchange_rate || 1
      },
      suggested_action: 'Identify the payee and document the transaction details.',
      status: 'open',
      related_transaction_ids: [tx.id]
    });
  });

  // --- 5. Uncategorized Transactions Rule ---
  // Only create this risk if there are at least 3 uncategorized expense transactions
  // (prevents one risk per row for new imports)
  const MIN_UNCATEGORIZED_COUNT = 3;
  if (uncategorizedRule) {
    const uncategorizedTxs = txs.filter(tx => {
      const cat = getDisplayCategory(tx);
      const isOutflow = tx.raw_row_json?.direction_derived === 'outflow' || getTxAmount(tx) < 0;
      return (cat === 'Uncategorized' || cat === 'Uncategorized Expense') && isOutflow;
    });

    if (uncategorizedTxs.length >= MIN_UNCATEGORIZED_COUNT) {
      const totalUncategorizedAmt = uncategorizedTxs.reduce((acc, tx) => acc + Math.abs(getTxAmount(tx)), 0);
      risks.push({
        organization_id: orgId,
        client_id: clientId,
        title: `Uncategorized Spend: ${uncategorizedTxs.length} Transactions`,
        severity: 'low',
        risk_type: 'uncategorized_transaction',
        amount_at_risk: totalUncategorizedAmt,
        description: `${uncategorizedTxs.length} outflow transactions (${fmtCurrency(totalUncategorizedAmt)} total) have no category assigned.`,
        evidence_json: {
          count: uncategorizedTxs.length,
          total_amount: totalUncategorizedAmt,
          samples: uncategorizedTxs.slice(0, 5).map(tx => tx.description)
        },
        suggested_action: 'Review and categorize these transactions for accurate reporting.',
        status: 'open',
        related_transaction_ids: uncategorizedTxs.map(tx => tx.id)
      });
    }
  }

  // --- 6. Unknown Vendor Rule ---
  if (unknownVendorRule) {
    const unknownVendorTxs = txs.filter(tx => 
      tx.amount < 0 && 
      (tx.type === 'vendor_payment' || tx.type === 'expense') && 
      !tx.counterparty_name && 
      isGenericVendorPaymentDescription(tx.description)
    );

    if (unknownVendorTxs.length > 0) {
      risks.push({
        organization_id: orgId,
        client_id: clientId,
        title: 'Unknown Vendors Detected',
        severity: 'medium',
        risk_type: 'unknown_vendor',
        amount_at_risk: unknownVendorTxs.reduce((acc, tx) => acc + Math.abs(getTxAmount(tx)), 0),
        description: `${unknownVendorTxs.length} payments have generic descriptions with no vendor specified.`,
        evidence_json: {
          count: unknownVendorTxs.length,
          samples: unknownVendorTxs.slice(0, 3).map(tx => tx.description)
        },
        suggested_action: 'Identify vendors for these payments to prevent shadow IT or unauthorized spend.',
        status: 'open',
        related_transaction_ids: unknownVendorTxs.map(tx => tx.id)
      });
    }
  }

  // Sync to database
  // Delete existing open risks to prevent accumulation
  await supabase
    .from('risk_events')
    .delete()
    .eq('client_id', clientId)
    .eq('status', 'open');

  const allRisks = [...risks, ...invoiceRisks];

  if (allRisks.length > 0) {
    try {
      const { error: insertErr } = await supabase
        .from('risk_events')
        .insert(allRisks);
      
      if (insertErr) {
        if (insertErr.message?.includes('column') && insertErr.message?.includes('does not exist')) {
          throw new Error('Database schema is out of date.');
        }
        throw insertErr;
      }
    } catch (err: any) {
      console.error('[Risk Engine] Sync error:', err);
      throw err;
    }
  }

  return allRisks;
};

export type RiskEvent = {
  id: string;
  organization_id: string;
  client_id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  risk_type: string;
  amount_at_risk: number;
  description: string;
  evidence_json: any;
  suggested_action: string;
  status: 'open' | 'resolved' | 'ignored' | 'reviewed';
  related_transaction_ids: string[];
  created_at: string;
};

export const formatCurrency = (val: number, _currency: string = 'INR') => {
  return formatINR(val);
};
