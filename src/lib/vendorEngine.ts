import { supabase } from './supabase';

/**
 * Vendor Detection & Analysis Engine
 * Extracts and normalizes vendor intelligence from raw transactions.
 */

export const normalizeVendorName = (description: string): { normalized: string; display: string } => {
  // 1. Lowercase and basic cleanup
  let name = description.toLowerCase().trim();

  // 2. Remove common transaction noise prefixes/suffixes
  // We remove generic payment labels but NOT "service" or "software" yet as they are core to names like "Acme Services"
  name = name.replace(/vendor payment|payment to|paid to|payout|monthly|annual|weekly|daily/gi, '');
  
  // 3. Remove "Invoice", "Reference", "UTR" and following numeric/text noise
  name = name.replace(/invoice.*$/gi, '');
  name = name.replace(/ref.*$/gi, '');
  name = name.replace(/#\d+/g, ''); 
  
  // 4. Remove duplicate markers and following text
  name = name.replace(/duplicate.*$/gi, '');
  name = name.replace(/copy.*$/gi, '');
  name = name.replace(/re-run.*$/gi, '');

  // 5. Remove long numeric IDs, Dates, and UTRs
  name = name.replace(/\b\d{4,}\b/g, ''); 
  name = name.replace(/\b\d{2,}-\d{2,}-\d{4,}\b/g, ''); 
  name = name.replace(/\butr\d+\b/gi, ''); 
  
  // 6. Cleanup punctuation and extra spaces
  name = name.replace(/[^\w\s]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();

  // 7. Intelligent pruning: Keep first 2-3 meaningful words
  const words = name.split(' ').filter(w => w.length > 1 || !['a', 'b', 'i', 'to', 'of'].includes(w));
  
  const pruned = words.length > 0 ? words.slice(0, 3).join(' ') : description.split(' ')[0];

  // 8. Display name: Title Case
  const display = pruned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  return { normalized: pruned.toLowerCase(), display };
};

export const inferCategory = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('google ads') || n.includes('meta ads') || n.includes('facebook') || n.includes('linkedin') || n.includes('twitter')) return 'Marketing';
  if (n.includes('google workspace') || n.includes('slack') || n.includes('notion') || n.includes('figma') || n.includes('canva') || n.includes('zoho') || n.includes('microsoft')) return 'SaaS / Software';
  if (n.includes('salary') || n.includes('payroll') || n.includes('bonus')) return 'Payroll';
  if (n.includes('aws') || n.includes('amazon web') || n.includes('gcp') || n.includes('azure') || n.includes('vercel') || n.includes('supabase') || n.includes('digitalocean')) return 'Cloud / Infrastructure';
  if (n.includes('office') || n.includes('stationery') || n.includes('pantry') || n.includes('supplies')) return 'Office';
  if (n.includes('rent') || n.includes('electricity') || n.includes('water')) return 'Utilities';
  if (n.includes('travel') || n.includes('uber') || n.includes('ola') || n.includes('flight') || n.includes('hotel')) return 'Travel';
  
  return 'Vendor / Services';
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
    if (!normalized || normalized.length < 2) return;

    if (!vendorMap[normalized]) {
      vendorMap[normalized] = {
        name: display,
        normalized_name: normalized,
        total_spend: 0,
        transaction_count: 0,
        first_seen: tx.transaction_date,
        last_seen: tx.transaction_date,
        unique_months: new Set<string>(),
        transactions: []
      };
    }

    const v = vendorMap[normalized];
    const txDate = new Date(tx.transaction_date);
    const monthKey = `${txDate.getFullYear()}-${txDate.getMonth()}`;
    
    v.total_spend += Math.abs(tx.amount);
    v.transaction_count += 1;
    v.unique_months.add(monthKey);
    v.transactions.push(tx);
    
    if (txDate < new Date(v.first_seen)) v.first_seen = tx.transaction_date;
    if (txDate > new Date(v.last_seen)) v.last_seen = tx.transaction_date;
  });

  const results: any[] = Object.values(vendorMap).map(v => {
    const first = new Date(v.first_seen);
    const last = new Date(v.last_seen);
    const monthsDiff = Math.max(1, (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1);
    const uniqueMonthCount = v.unique_months.size;
    
    // Recurrence Pattern
    // A vendor is monthly ONLY if it appears in multiple months and has consistent frequency
    let recurrence_pattern = 'irregular';
    const isSubscriptionKeyword = v.normalized_name.includes('subscription') || 
                                  v.normalized_name.includes('monthly') || 
                                  v.normalized_name.includes('software') ||
                                  ['slack', 'zoho', 'canva'].includes(v.normalized_name.toLowerCase()) ||
                                  v.transactions.some((tx: any) => 
                                    tx.description.toLowerCase().includes('subscription') ||
                                    tx.description.toLowerCase().includes('monthly') ||
                                    tx.description.toLowerCase().includes('software') ||
                                    tx.description.toLowerCase().includes('sub')
                                  );

    if (uniqueMonthCount >= 2) {
      if (v.transaction_count >= monthsDiff * 0.8 || isSubscriptionKeyword) recurrence_pattern = 'monthly';
      else if (v.transaction_count >= monthsDiff * 0.2) recurrence_pattern = 'quarterly';
    } else if (uniqueMonthCount === 1 && isSubscriptionKeyword) {
      recurrence_pattern = 'monthly';
    }

    // Calculate monthly average: use median transaction amount for recurring subscriptions
    let monthly_average = 0;
    if (recurrence_pattern === 'monthly') {
      const amounts = v.transactions.map((tx: any) => Math.abs(tx.amount));
      const sortedAmts = [...amounts].sort((a, b) => a - b);
      monthly_average = sortedAmts[Math.floor(sortedAmts.length / 2)] || 0;
    }

    // Category
    const category = inferCategory(v.normalized_name);

    // Recommendation & Reason (CFO-style)
    let recommendation = 'keep';
    let recommendation_reason = 'Stable vendor with consistent history.';
    
    if (recurrence_pattern === 'monthly' && category === 'SaaS / Software') {
      recommendation = 'review';
      recommendation_reason = 'Recurring SaaS spend. Audit user licenses and usage tiers.';
    } else if (v.total_spend > 100000) {
      recommendation = 'review';
      recommendation_reason = 'High-value vendor. Negotiate volume discounts or better credit terms.';
    } else if (v.transaction_count === 1 && monthsDiff > 6) {
      recommendation = 'replace';
      recommendation_reason = 'Stale vendor relationship. Check if services are still active or needed.';
    } else if (v.normalized_name.includes('ads') || v.normalized_name.includes('marketing')) {
      recommendation = 'review';
      recommendation_reason = 'Marketing spend. Verify conversion metrics against this outflow.';
    }

    return {
      organization_id: orgId,
      client_id: clientId,
      name: v.name,
      display_name: v.name, // Compatibility for older schemas
      normalized_name: v.normalized_name,
      category,
      total_spend: v.total_spend,
      monthly_average: Math.round(monthly_average),
      transaction_count: v.transaction_count,
      first_seen: v.first_seen,
      last_seen: v.last_seen,
      recurrence_pattern,
      trend: 'unknown',
      recommendation,
      recommendation_reason,
      alternatives_json: [],
      metadata_json: { analyzed_at: new Date().toISOString() }
    };
  });

  // 2. Sync to database
  if (results.length > 0) {
    try {
      const { error: upsertErr } = await supabase
        .from('vendors')
        .upsert(results, { onConflict: 'client_id, normalized_name' });
      
      if (upsertErr) {
        if (upsertErr.message?.includes('column') && upsertErr.message?.includes('does not exist')) {
          throw new Error('Database schema is out of date. Run latest Phase 5 repair migration (0007).');
        }
        throw upsertErr;
      }
    } catch (err: any) {
      console.error('[Vendor Engine] Sync error:', err);
      throw err;
    }
  }

  return results;
};
