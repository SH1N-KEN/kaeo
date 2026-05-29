import React, { useState, useEffect } from 'react';
import { Loader2, Settings2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { getSpendRules, saveSpendRule, type SpendRule } from '../lib/spendRulesEngine';
import { useToast } from '../hooks/useToast';
import EmptyState from '../components/ui/EmptyState';

const SpendRules: React.FC = () => {
  const { activeOrg, activeClient } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<SpendRule[]>([]);

  useEffect(() => {
    if (activeOrg) {
      fetchRules();
    }
  }, [activeOrg]);

  const fetchRules = async () => {
    if (!activeOrg) return;
    setLoading(true);
    try {
      const data = await getSpendRules(activeOrg.id);
      setRules(data);
    } catch (err: any) {
      toast('Failed to load spend rules: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (rule: SpendRule, enabled: boolean) => {
    if (!activeOrg) return;
    
    // Optimistic update
    setRules(prev => prev.map(r => r.rule_type === rule.rule_type ? { ...r, enabled } : r));
    
    try {
      const updatedRule = { ...rule, enabled };
      await saveSpendRule(activeOrg.id, updatedRule);
      toast('Rule updated successfully', 'success');
    } catch (err: any) {
      toast('Failed to update rule: ' + err.message, 'error');
      // Revert on error
      fetchRules();
    }
  };

  const handleUpdateValue = async (rule: SpendRule, updates: Partial<SpendRule>) => {
    if (!activeOrg) return;
    try {
      const updatedRule = { ...rule, ...updates };
      await saveSpendRule(activeOrg.id, updatedRule);
      setRules(prev => prev.map(r => r.rule_type === rule.rule_type ? updatedRule : r));
      toast('Rule saved successfully', 'success');
    } catch (err: any) {
      toast('Failed to save rule: ' + err.message, 'error');
    }
  };

  if (!activeClient || !activeOrg) {
    return (
      <div className="h-[70vh] flex items-center justify-center animate-in fade-in duration-500">
        <EmptyState 
          title="No workspace selected" 
          description="Select a client workspace to manage spend control rules." 
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading rules framework...
      </div>
    );
  }

  const getRuleDetails = (type: string) => {
    switch (type) {
      case 'duplicate_payment':
        return {
          title: 'Duplicate Payment Detection',
          desc: 'Flag identical payments made within a specific timeframe.',
          hasDays: true,
          hasAmount: false
        };
      case 'high_value_payment':
        return {
          title: 'High Value Outflow',
          desc: 'Flag any single transaction exceeding the defined limit.',
          hasDays: false,
          hasAmount: true
        };
      case 'subscription_threshold':
        return {
          title: 'Large Subscriptions',
          desc: 'Monitor recurring payments that exceed the monthly limit.',
          hasDays: false,
          hasAmount: true
        };
      case 'unknown_vendor':
        return {
          title: 'Unknown Vendor Protection',
          desc: 'Flag generic outgoing payments with no clear vendor assigned.',
          hasDays: false,
          hasAmount: false
        };
      case 'uncategorized_transaction':
        return {
          title: 'Enforce Categorization',
          desc: 'Flag any expense that has not been assigned a category.',
          hasDays: false,
          hasAmount: false
        };
      default:
        return {
          title: type.replace(/_/g, ' '),
          desc: 'Custom rule definition.',
          hasDays: false,
          hasAmount: false
        };
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Spend Rules</h1>
            <div className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded border border-primary/20 uppercase tracking-tighter">
              Active Control
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Define risk thresholds and automation limits for <span className="text-foreground font-semibold">{activeOrg.name}</span></p>
        </div>
      </div>

      <div className="frosted-panel p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-center">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">Rule Engine Active</h3>
          <p className="text-sm text-muted-foreground mt-1">
            These rules automatically evaluate new transactions during ingestion. Triggered rules create open Risk Events that require CFO or Accountant review.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {rules.map(rule => {
          const details = getRuleDetails(rule.rule_type);
          
          return (
            <div key={rule.id} className={`frosted-card rounded-2xl transition-all duration-300 ${rule.enabled ? 'border-primary/30 shadow-md shadow-primary/5' : 'border-border/40 opacity-75'}`}>
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-foreground">{details.title}</h3>
                      {!rule.enabled && (
                        <span className="px-2 py-0.5 bg-muted rounded text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Disabled</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{details.desc}</p>
                  </div>
                  
                  <button
                    onClick={() => handleToggle(rule, !rule.enabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${rule.enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className="sr-only">Toggle rule</span>
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${rule.enabled ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>
                </div>

                {rule.enabled && (details.hasAmount || details.hasDays) && (
                  <div className="mt-6 pt-6 border-t border-border/30 flex flex-wrap gap-4 items-end">
                    {details.hasAmount && (
                      <div className="space-y-2 flex-1 min-w-[200px]">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                          <Settings2 className="w-3 h-3" /> Amount Threshold (₹)
                        </label>
                        <input
                          type="number"
                          className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                          defaultValue={rule.threshold_amount || 0}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val !== rule.threshold_amount) {
                              handleUpdateValue(rule, { threshold_amount: val });
                            }
                          }}
                        />
                      </div>
                    )}
                    
                    {details.hasDays && (
                      <div className="space-y-2 flex-1 min-w-[200px]">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                          <Settings2 className="w-3 h-3" /> Time Window (Days)
                        </label>
                        <input
                          type="number"
                          className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                          defaultValue={rule.threshold_days || 0}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val !== rule.threshold_days) {
                              handleUpdateValue(rule, { threshold_days: val });
                            }
                          }}
                        />
                      </div>
                    )}

                    <div className="px-4 py-2 bg-success/10 text-success rounded-lg text-xs font-bold border border-success/20 flex items-center gap-2 h-[42px]">
                      <CheckCircle2 className="w-4 h-4" /> Auto-saved
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SpendRules;
