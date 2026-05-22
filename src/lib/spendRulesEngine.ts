import { supabase } from './supabase';

export interface SpendRule {
  id?: string;
  organization_id?: string;
  rule_type: string;
  name: string;
  enabled: boolean;
  threshold_amount: number | null;
  threshold_days: number | null;
}

export const DEFAULT_RULES: SpendRule[] = [
  {
    rule_type: 'duplicate_payment',
    name: 'Duplicate Vendor Payment',
    enabled: true,
    threshold_amount: null,
    threshold_days: 7,
  },
  {
    rule_type: 'high_value_payment',
    name: 'High-Value Payment Threshold',
    enabled: true,
    threshold_amount: 100000, // 1 Lakh INR default
    threshold_days: null,
  },
  {
    rule_type: 'subscription_threshold',
    name: 'Subscription Review Threshold',
    enabled: true,
    threshold_amount: 5000,
    threshold_days: null,
  },
  {
    rule_type: 'unknown_vendor',
    name: 'Flag Unknown Vendors',
    enabled: true,
    threshold_amount: null,
    threshold_days: null,
  },
  {
    rule_type: 'uncategorized_transaction',
    name: 'Flag Uncategorized Transactions',
    enabled: true,
    threshold_amount: null,
    threshold_days: null,
  }
];

export const getSpendRules = async (organizationId: string): Promise<SpendRule[]> => {
  if (!organizationId) return DEFAULT_RULES;

  try {
    const { data, error } = await supabase
      .from('spend_rules')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) {
      console.error('[Spend Rules] Error fetching rules:', error);
      return DEFAULT_RULES;
    }

    if (!data || data.length === 0) {
      return DEFAULT_RULES;
    }

    // Merge DB rules with defaults to ensure all required rule types exist in memory
    const activeRules = [...DEFAULT_RULES];
    
    data.forEach(dbRule => {
      const idx = activeRules.findIndex(r => r.rule_type === dbRule.rule_type);
      if (idx >= 0) {
        activeRules[idx] = {
          ...activeRules[idx],
          id: dbRule.id,
          enabled: dbRule.enabled,
          threshold_amount: dbRule.threshold_amount,
          threshold_days: dbRule.threshold_days,
        };
      } else {
        // It's a custom rule or a new type
        activeRules.push({
          id: dbRule.id,
          rule_type: dbRule.rule_type,
          name: dbRule.name,
          enabled: dbRule.enabled,
          threshold_amount: dbRule.threshold_amount,
          threshold_days: dbRule.threshold_days,
        });
      }
    });

    return activeRules;
  } catch (err) {
    console.error('[Spend Rules] Exception fetching rules:', err);
    return DEFAULT_RULES;
  }
};

export const saveSpendRule = async (organizationId: string, rule: SpendRule): Promise<SpendRule | null> => {
  try {
    if (rule.id) {
      // Update
      const { data, error } = await supabase
        .from('spend_rules')
        .update({
          enabled: rule.enabled,
          threshold_amount: rule.threshold_amount,
          threshold_days: rule.threshold_days,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rule.id)
        .eq('organization_id', organizationId)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('spend_rules')
        .insert({
          organization_id: organizationId,
          rule_type: rule.rule_type,
          name: rule.name,
          enabled: rule.enabled,
          threshold_amount: rule.threshold_amount,
          threshold_days: rule.threshold_days,
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    }
  } catch (err) {
    console.error('[Spend Rules] Failed to save rule:', err);
    return null;
  }
};
