import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Database,
  ShieldCheck,
  Users,
  RotateCcw,
  CheckCircle2,
  X,
  Loader2,
  Settings2,
  Info,
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { getSpendRules, saveSpendRule, type SpendRule } from '../lib/spendRulesEngine';
import { useToast } from '../hooks/useToast';
import ResetClientModal from '../components/ui/ResetClientModal';
import Clients from './Clients';
import { Link as LinkIcon } from 'lucide-react';

type Tab = 'workspace' | 'clients' | 'spend-rules' | 'data' | 'integrations';

const Settings: React.FC = () => {
  const { activeClient, activeOrg, accountMode } = useWorkspace();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam && ['workspace', 'clients', 'spend-rules', 'data', 'integrations'].includes(tabParam)
      ? (tabParam as Tab)
      : 'workspace'
  );

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Spend Rules state
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rules, setRules] = useState<SpendRule[]>([]);

  // Sync tab to URL param
  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  // Load rules when switching to that tab
  useEffect(() => {
    if (activeTab === 'spend-rules' && activeOrg && rules.length === 0 && !rulesLoading) {
      fetchRules();
    }
  }, [activeTab, activeOrg]);

  const fetchRules = async () => {
    if (!activeOrg) return;
    setRulesLoading(true);
    try {
      const data = await getSpendRules(activeOrg.id);
      setRules(data);
    } catch (err: any) {
      toast('Failed to load spend rules: ' + err.message, 'error');
    } finally {
      setRulesLoading(false);
    }
  };

  const handleToggle = async (rule: SpendRule, enabled: boolean) => {
    if (!activeOrg) return;
    setRules(prev => prev.map(r => r.rule_type === rule.rule_type ? { ...r, enabled } : r));
    try {
      await saveSpendRule(activeOrg.id, { ...rule, enabled });
      toast('Rule updated', 'success');
    } catch (err: any) {
      toast('Failed to update rule: ' + err.message, 'error');
      fetchRules();
    }
  };

  const handleUpdateValue = async (rule: SpendRule, updates: Partial<SpendRule>) => {
    if (!activeOrg) return;
    try {
      const updated = { ...rule, ...updates };
      await saveSpendRule(activeOrg.id, updated);
      setRules(prev => prev.map(r => r.rule_type === rule.rule_type ? updated : r));
      toast('Rule saved', 'success');
    } catch (err: any) {
      toast('Failed to save rule: ' + err.message, 'error');
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'workspace', label: 'Workspace', icon: Building2 },
    { 
      id: 'clients', 
      label: accountMode === 'business_owner' ? 'Business Profile' : 'Clients', 
      icon: Users 
    },
    { id: 'spend-rules', label: 'Spend Rules', icon: ShieldCheck },
    { id: 'data', label: 'Data & Reset', icon: Database },
    { id: 'integrations', label: 'Integrations', icon: LinkIcon }
  ];

  const getRuleDetails = (type: string) => {
    switch (type) {
      case 'duplicate_payment':
        return { title: 'Duplicate Payment Detection', desc: 'Flag identical payments within a time window.', hasDays: true, hasAmount: false };
      case 'high_value_payment':
        return { title: 'High-Value Outflow', desc: 'Flag single transactions exceeding the defined limit.', hasDays: false, hasAmount: true };
      case 'subscription_threshold':
        return { title: 'Large Subscriptions', desc: 'Monitor recurring payments above the monthly threshold.', hasDays: false, hasAmount: true };
      case 'unknown_vendor':
        return { title: 'Unknown Vendor Protection', desc: 'Flag outgoing payments with no vendor identified.', hasDays: false, hasAmount: false };
      case 'uncategorized_transaction':
        return { title: 'Enforce Categorization', desc: 'Flag expenses with no assigned category.', hasDays: false, hasAmount: false };
      default:
        return { title: type.replace(/_/g, ' '), desc: 'Custom rule.', hasDays: false, hasAmount: false };
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workspace Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure settings for <span className="text-foreground font-semibold">{activeOrg?.name ?? 'your workspace'}</span>.
          These settings apply to the selected workspace.
        </p>
      </div>

      {/* Success toast */}
      {success && (
        <div className="p-4 bg-success/5 border border-success/20 rounded-xl flex gap-3 items-center animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          <p className="text-sm text-success font-bold flex-1">{success}</p>
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4 text-success" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl border border-border/50 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: Workspace ─── */}
      {activeTab === 'workspace' && (
        <div className="space-y-6">
          <div className="premium-glass rounded-2xl border border-border/50 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Organisation</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Workspace Name</label>
                <div className="px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold text-foreground">
                  {activeOrg?.name ?? '—'}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Client</label>
                <div className="px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold text-foreground">
                  {activeClient?.name ?? 'None selected'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 mt-2 p-3 bg-muted/20 rounded-xl border border-border/40">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Workspace name and client management can be configured from the <strong className="text-foreground">{accountMode === 'business_owner' ? 'Business Profile' : 'Clients'}</strong> tab.
                Switch between clients using the workspace switcher in the topbar.
              </p>
            </div>
          </div>

          <div className="premium-glass rounded-2xl border border-border/50 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">
                {accountMode === 'business_owner' ? 'Business Profile' : 'Client Workspaces'}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {accountMode === 'business_owner'
                ? 'Manage your business details and default workspace settings.'
                : 'Manage clients and client workspaces from the Clients tab.'}
            </p>
            <button
              onClick={() => switchTab('clients')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-xs font-bold border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              {accountMode === 'business_owner' ? 'Edit Business Profile' : 'Go to Clients'}
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB: Spend Rules ─── */}
      {activeTab === 'spend-rules' && (
        <div className="space-y-6">
          {/* Explainer */}
          <div className="flex flex-col md:flex-row gap-4 p-5 premium-glass rounded-2xl border border-primary/20 items-start">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1">Rule Engine — Active Control</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                These rules automatically evaluate transactions and generate <strong className="text-foreground">Risk Inbox</strong> events.
                They also power your <strong className="text-foreground">Month-End Readiness Score</strong>. Rules apply workspace-wide.
              </p>
            </div>
          </div>

          {!activeOrg ? (
            <p className="text-sm text-muted-foreground italic">Select a workspace to configure spend rules.</p>
          ) : rulesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading rules…</span>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => {
                const details = getRuleDetails(rule.rule_type);
                return (
                  <div
                    key={rule.rule_type}
                    className={`premium-glass rounded-2xl border transition-all duration-300 ${
                      rule.enabled ? 'border-primary/30 shadow-sm shadow-primary/5' : 'border-border/40 opacity-70'
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground">{details.title}</h3>
                            {!rule.enabled && (
                              <span className="px-2 py-0.5 bg-muted rounded text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Disabled</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{details.desc}</p>
                        </div>

                        {/* Toggle */}
                        <button
                          onClick={() => handleToggle(rule, !rule.enabled)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                            rule.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                          }`}
                          aria-label={`Toggle ${details.title}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              rule.enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {rule.enabled && (details.hasAmount || details.hasDays) && (
                        <div className="mt-5 pt-5 border-t border-border/30 flex flex-wrap gap-4 items-end">
                          {details.hasAmount && (
                            <div className="space-y-1.5 flex-1 min-w-[180px]">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                <Settings2 className="w-3 h-3" /> Amount Threshold (₹)
                              </label>
                              <input
                                type="number"
                                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                defaultValue={rule.threshold_amount || 0}
                                onBlur={e => {
                                  const val = Number(e.target.value);
                                  if (val !== rule.threshold_amount) handleUpdateValue(rule, { threshold_amount: val });
                                }}
                              />
                            </div>
                          )}
                          {details.hasDays && (
                            <div className="space-y-1.5 flex-1 min-w-[180px]">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                                <Settings2 className="w-3 h-3" /> Time Window (Days)
                              </label>
                              <input
                                type="number"
                                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                defaultValue={rule.threshold_days || 0}
                                onBlur={e => {
                                  const val = Number(e.target.value);
                                  if (val !== rule.threshold_days) handleUpdateValue(rule, { threshold_days: val });
                                }}
                              />
                            </div>
                          )}
                          <div className="px-4 py-2.5 bg-success/10 text-success rounded-lg text-xs font-bold border border-success/20 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Auto-saved on blur
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: Data & Reset ─── */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <div className="premium-glass rounded-2xl border border-border/50 overflow-hidden">
            <div className="p-6 flex items-start justify-between gap-6">
              <div className="space-y-1">
                <h4 className="font-bold text-foreground">Reset Client Data</h4>
                <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                  Permanently clear all uploaded files, imports, and transactions for the active client.
                  Useful for starting fresh or re-testing imports. <strong className="text-risk">This cannot be undone.</strong>
                </p>
              </div>
              {activeClient && activeOrg ? (
                <button
                  onClick={() => setIsResetModalOpen(true)}
                  className="shrink-0 px-4 py-2 bg-muted hover:bg-risk/10 text-muted-foreground hover:text-risk rounded-lg text-xs font-bold flex items-center gap-2 transition-colors border border-transparent hover:border-risk/20"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset {activeClient.name}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground italic">Select a client to manage data.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: Clients / Business Profile ─── */}
      {activeTab === 'clients' && (
        <div className="space-y-6">
          <Clients embedMode={true} />
        </div>
      )}

      {/* ─── TAB: Integrations ─── */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 p-5 premium-glass rounded-2xl border border-primary/20 items-start">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1">Integrations Directory</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connect your bookkeeping software and billing platforms to automate transaction imports.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tally */}
            <div className="premium-glass rounded-2xl border border-border/50 p-5 flex flex-col justify-between h-44">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-foreground text-sm">Tally Prime / ERP 9</h4>
                  <span className="text-[9px] font-black uppercase text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/20">Offline / API</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Export XML/Excel tables directly from your Tally workspace and upload them using Kaeo Ingestion.
                </p>
              </div>
              <button className="w-fit text-xs font-bold text-primary hover:underline mt-2">View export instructions →</button>
            </div>

            {/* Zoho Books */}
            <div className="premium-glass rounded-2xl border border-border/50 p-5 flex flex-col justify-between h-44">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-foreground text-sm">Zoho Books API</h4>
                  <span className="text-[9px] font-black uppercase text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/20">Coming soon</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Direct OAuth interface to synchronize Zoho invoices, debit notes, and bank reconciliations automatically.
                </p>
              </div>
              <button className="w-fit text-xs font-bold text-muted-foreground hover:text-foreground mt-2 disabled:opacity-50" disabled>Setup sync (Phase 16) →</button>
            </div>

            {/* Razorpay */}
            <div className="premium-glass rounded-2xl border border-border/50 p-5 flex flex-col justify-between h-44">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-foreground text-sm">Razorpay Payouts</h4>
                  <span className="text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">Developer Link</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Real-time webhook connectivity to evaluate outgoing vendor payment risk immediately upon processing.
                </p>
              </div>
              <button className="w-fit text-xs font-bold text-primary hover:underline mt-2">Configure Webhooks →</button>
            </div>

            {/* Excel / Google Sheets */}
            <div className="premium-glass border border-primary/30 shadow-sm shadow-primary/5 rounded-2xl p-5 flex flex-col justify-between h-44">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-foreground text-sm">Excel / Google Sheets</h4>
                  <span className="text-[9px] font-black uppercase text-success bg-success/15 px-2 py-0.5 rounded border border-success/20">Active</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Direct client-side file ingestion, schema column-mapping, and duplicate ledger entries protection.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-success font-semibold mt-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ready to ingest files
              </div>
            </div>
          </div>
        </div>
      )}

      {activeClient && activeOrg && (
        <ResetClientModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          onSuccess={() => setSuccess('Client finance data reset successfully.')}
          clientName={activeClient.name}
          clientId={activeClient.id}
          orgId={activeOrg.id}
        />
      )}
    </div>
  );
};

export default Settings;
