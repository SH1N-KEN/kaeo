import { supabase } from './supabase';

/**
 * Vendor Detection & Analysis Engine
 * Extracts and normalizes vendor intelligence from raw transactions.
 */

export interface VendorAnalysis {
  name: string;
  display_name: string;
  total_spend: number;
  transaction_count: number;
  first_seen: string;
  last_seen: string;
  monthly_average: number;
  recurrence_pattern: 'monthly' | 'weekly' | 'irregular';
  trend: 'increasing' | 'decreasing' | 'stable';
  category: string;
  recommendation: string;
}

export const normalizeVendorName = (description: string): { normalized: string; display: string } => {
  // 1. Lowercase and basic cleanup
  let name = description.toLowerCase().trim();

  // 2. Remove common noise prefixes/suffixes
  name = name.replace(/vendor payment|payment to|paid to|invoice|bill|payout|subscription|software|service/gi, '');
  
  // 3. Remove invoice numbers, payment IDs, dates, and other numeric noise
  name = name.replace(/#\d+/g, ''); // #123
  name = name.replace(/\d{4,}/g, ''); // Long numbers like 20260501
  name = name.replace(/\b\d{2,}-\d{2,}-\d{4,}\b/g, ''); // Dates
  
  // 4. Remove duplicate markers
  name = name.replace(/duplicate|copy|re-run/gi, '');

  // 5. Cleanup punctuation and extra spaces
  name = name.replace(/[^\w\s]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();

  // 6. Heuristic: Take first 2-3 words if long (most vendors are 1-3 words)
  const words = name.split(' ');
  const normalized = words.slice(0, 3).join(' ');

  // 7. Display name: Title Case
  const display = normalized.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return { normalized, display };
};

export const analyzeVendorsForClient = async (orgId: string, clientId: string) => {
  // 1. Fetch all expense-like transactions
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('client_id', clientId)
    .in('type', ['expense', 'vendor_payment', 'subscription']);

  if (error) throw error;
  if (!txs || txs.length === 0) return [];

  const vendorMap: Record<string, any> = {};

  txs.forEach(tx => {
    const { normalized, display } = normalizeVendorName(tx.description);
    if (!normalized) return;

    if (!vendorMap[normalized]) {
      vendorMap[normalized] = {
        name: normalized,
        display_name: display,
        total_spend: 0,
        transaction_count: 0,
        first_seen: tx.transaction_date,
        last_seen: tx.transaction_date,
        transactions: []
      };
    }

    const v = vendorMap[normalized];
    v.total_spend += Math.abs(tx.amount);
    v.transaction_count += 1;
    v.transactions.push(tx);
    
    if (new Date(tx.transaction_date) < new Date(v.first_seen)) v.first_seen = tx.transaction_date;
    if (new Date(tx.transaction_date) > new Date(v.last_seen)) v.last_seen = tx.transaction_date;
  });

  const results: any[] = Object.values(vendorMap).map(v => {
    // Basic analysis logic
    const first = new Date(v.first_seen);
    const last = new Date(v.last_seen);
    const monthsDiff = Math.max(1, (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1);
    
    const monthly_average = v.total_spend / monthsDiff;
    
    // Recurrence heuristic
    let recurrence_pattern = 'irregular';
    if (v.transaction_count >= 2) {
      if (v.transaction_count >= monthsDiff * 0.8) recurrence_pattern = 'monthly';
    }

    // Recommendation logic (CFO-style)
    let recommendation = 'Keep: Essential vendor with stable history.';
    if (recurrence_pattern === 'monthly' && v.total_spend > 50000) {
      recommendation = 'Review: High-value recurring spend. Check for volume discounts.';
    } else if (v.transaction_count === 1 && monthsDiff > 3) {
      recommendation = 'Replace: One-off engagement detected. Consider long-term contract if service is still needed.';
    } else if (v.name.includes('aws') || v.name.includes('cloud') || v.name.includes('software')) {
      recommendation = 'Downgrade: Review usage tiers to optimize cost.';
    }

    return {
      organization_id: orgId,
      client_id: clientId,
      name: v.name,
      display_name: v.display_name,
      total_spend: v.total_spend,
      transaction_count: v.transaction_count,
      first_seen: v.first_seen,
      last_seen: v.last_seen,
      monthly_average: Math.round(monthly_average),
      recurrence_pattern,
      trend: 'stable', // Placeholder for more complex trend analysis
      category: 'Uncategorized',
      recommendation,
      metadata: { analyzed_at: new Date().toISOString() }
    };
  });

  // 2. Sync to database (Upsert)
  if (results.length > 0) {
    const { error: upsertErr } = await supabase
      .from('vendors')
      .upsert(results, { onConflict: 'client_id, name' });
    
    if (upsertErr) console.error('[Vendor Engine] Sync error:', upsertErr);
  }

  return results;
};
