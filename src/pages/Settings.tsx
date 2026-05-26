import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Building2,
  Database,
  ShieldCheck,
  Users,
  RotateCcw,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { getSpendRules, saveSpendRule, type SpendRule } from '../lib/spendRulesEngine';
import { useToast } from '../hooks/useToast';
import ResetClientModal from '../components/ui/ResetClientModal';
import Clients from './Clients';
import { Link as LinkIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Tab = 'workspace' | 'clients' | 'spend-rules' | 'data' | 'integrations';

const Settings: React.FC = () => {
  const { activeClient, activeOrg, accountMode, clients, profile, refresh } = useWorkspace();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab | 'overview'>(
    tabParam && ['workspace', 'clients', 'spend-rules', 'data', 'integrations'].includes(tabParam)
      ? (tabParam as Tab)
      : 'overview'
  );

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Spend rules states
  const [rulesSchemaMissing, setRulesSchemaMissing] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [duplicateDays, setDuplicateDays] = useState<number>(7);
  const [duplicateEnabled, setDuplicateEnabled] = useState(true);
  const [highValueAmount, setHighValueAmount] = useState<number>(100000);
  const [highValueEnabled, setHighValueEnabled] = useState(true);
  const [subscriptionAmount, setSubscriptionAmount] = useState<number>(5000);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(true);
  const [unknownVendorEnabled, setUnknownVendorEnabled] = useState(true);
  const [uncategorizedEnabled, setUncategorizedEnabled] = useState(true);

  // Accountant Firm Profile editing states
  const [isEditingFirm, setIsEditingFirm] = useState(false);
  const [editFirmName, setEditFirmName] = useState('');
  const [editClientsManaged, setEditClientsManaged] = useState('1-5');
  const [editTypicalSize, setEditTypicalSize] = useState('Small (10-50 employees)');
  const [editIndustriesServed, setEditIndustriesServed] = useState('');
  const [editFirmTool, setEditFirmTool] = useState('Tally');
  const [editFirmNotes, setEditFirmNotes] = useState('');
  const [savingFirm, setSavingFirm] = useState(false);

  useEffect(() => {
    if (activeOrg) {
      setEditFirmName(activeOrg.name || '');
    }
    if (profile?.onboarding_answers) {
      const ans = profile.onboarding_answers;
      setEditClientsManaged(ans.clients_managed || '1-5');
      setEditTypicalSize(ans.typical_client_size || 'Small (10-50 employees)');
      setEditIndustriesServed(ans.industries_served || '');
      setEditFirmTool(ans.accounting_tools?.[0] || 'Tally');
      setEditFirmNotes(ans.notes || '');
    }
  }, [activeOrg, profile, isEditingFirm]);

  const handleSaveFirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFirmName.trim()) {
      toast('Firm name cannot be empty', 'error');
      return;
    }
    setSavingFirm(true);
    try {
      if (activeOrg) {
        const { error: orgErr } = await supabase
          .from('organizations')
          .update({ name: editFirmName })
          .eq('id', activeOrg.id);
        if (orgErr) throw orgErr;
      }

      if (profile) {
        const updatedAnswers = {
          ...(profile.onboarding_answers || {}),
          clients_managed: editClientsManaged,
          typical_client_size: editTypicalSize,
          industries_served: editIndustriesServed,
          accounting_tools: [editFirmTool],
          notes: editFirmNotes
        };
        const { error: profErr } = await supabase
          .from('profiles')
          .update({ onboarding_answers: updatedAnswers })
          .eq('id', profile.id);
        if (profErr) throw profErr;
      }

      toast('Workspace Firm Profile updated successfully', 'success');
      setIsEditingFirm(false);
      refresh();
    } catch (err: any) {
      toast(err.message || 'Failed to save firm profile', 'error');
    } finally {
      setSavingFirm(false);
    }
  };

  // Spend Rules state
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rules, setRules] = useState<SpendRule[]>([]);

  // Sync tab to URL param
  const switchTab = (tab: Tab | 'overview') => {
    setActiveTab(tab);
    if (tab === 'overview') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
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
    setRulesSchemaMissing(false);
    try {
      const { error: testErr } = await supabase.from('spend_rules').select('id').limit(1);
      if (testErr && testErr.message?.includes('does not exist')) {
        setRulesSchemaMissing(true);
        return;
      }

      const data = await getSpendRules(activeOrg.id);
      setRules(data);

      const dup = data.find(r => r.rule_type === 'duplicate_payment');
      if (dup) {
        setDuplicateDays(dup.threshold_days || 7);
        setDuplicateEnabled(dup.enabled);
      }
      const hv = data.find(r => r.rule_type === 'high_value_payment');
      if (hv) {
        setHighValueAmount(hv.threshold_amount || 100000);
        setHighValueEnabled(hv.enabled);
      }
      const sub = data.find(r => r.rule_type === 'subscription_threshold');
      if (sub) {
        setSubscriptionAmount(sub.threshold_amount || 5000);
        setSubscriptionEnabled(sub.enabled);
      }
      const uk = data.find(r => r.rule_type === 'unknown_vendor');
      if (uk) setUnknownVendorEnabled(uk.enabled);
      const uc = data.find(r => r.rule_type === 'uncategorized_transaction');
      if (uc) setUncategorizedEnabled(uc.enabled);
    } catch (err: any) {
      toast('Failed to load spend rules: ' + err.message, 'error');
    } finally {
      setRulesLoading(false);
    }
  };

  const handleSaveAllRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;

    if (duplicateDays < 0 || highValueAmount < 0 || subscriptionAmount < 0) {
      toast('Rule threshold limits or days cannot be negative', 'error');
      return;
    }

    setSavingRules(true);
    try {
      const rulesToSave = [
        {
          rule_type: 'duplicate_payment',
          name: 'Duplicate Vendor Payment',
          enabled: duplicateEnabled,
          threshold_amount: null,
          threshold_days: duplicateDays,
          id: rules.find(r => r.rule_type === 'duplicate_payment')?.id
        },
        {
          rule_type: 'high_value_payment',
          name: 'High-Value Payment Threshold',
          enabled: highValueEnabled,
          threshold_amount: highValueAmount,
          threshold_days: null,
          id: rules.find(r => r.rule_type === 'high_value_payment')?.id
        },
        {
          rule_type: 'subscription_threshold',
          name: 'Subscription Review Threshold',
          enabled: subscriptionEnabled,
          threshold_amount: subscriptionAmount,
          threshold_days: null,
          id: rules.find(r => r.rule_type === 'subscription_threshold')?.id
        },
        {
          rule_type: 'unknown_vendor',
          name: 'Flag Unknown Vendors',
          enabled: unknownVendorEnabled,
          threshold_amount: null,
          threshold_days: null,
          id: rules.find(r => r.rule_type === 'unknown_vendor')?.id
        },
        {
          rule_type: 'uncategorized_transaction',
          name: 'Flag Uncategorized Transactions',
          enabled: uncategorizedEnabled,
          threshold_amount: null,
          threshold_days: null,
          id: rules.find(r => r.rule_type === 'uncategorized_transaction')?.id
        }
      ];

      await Promise.all(
        rulesToSave.map(rule => saveSpendRule(activeOrg.id, rule))
      );

      toast('Compliance rules updated successfully', 'success');
      fetchRules();
    } catch (err: any) {
      toast('Failed to save rules: ' + err.message, 'error');
    } finally {
      setSavingRules(false);
    }
  };

  const handleResetRulesToDefault = async () => {
    if (!activeOrg) return;
    if (!confirm('Are you sure you want to reset compliance rules to platform defaults?')) return;

    setSavingRules(true);
    try {
      const { DEFAULT_RULES } = await import('../lib/spendRulesEngine');
      const rulesToSave = DEFAULT_RULES.map(rule => ({
        ...rule,
        id: rules.find(r => r.rule_type === rule.rule_type)?.id
      }));

      await Promise.all(
        rulesToSave.map(rule => saveSpendRule(activeOrg.id, rule))
      );

      toast('Rules reset to defaults successfully', 'success');
      fetchRules();
    } catch (err: any) {
      toast('Reset failed: ' + err.message, 'error');
    } finally {
      setSavingRules(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    ...(accountMode === 'accountant' ? [{ id: 'workspace' as Tab, label: 'Workspace', icon: Building2 }] : []),
    { 
      id: 'clients', 
      label: accountMode === 'business_owner' ? 'Business Profile' : 'Client Businesses', 
      icon: Users 
    },
    { id: 'spend-rules', label: 'Spend Rules', icon: ShieldCheck },
    { id: 'data', label: 'Data & Reset', icon: Database },
    { id: 'integrations', label: 'Integrations', icon: LinkIcon }
  ];


  const getSpendDisplay = (range: string) => {
    switch (range) {
      case 'under_10k': return 'Under ₹10k';
      case '10k_50k': return '₹10k - ₹50k';
      case '50k_2l': return '₹50k - ₹2L';
      case 'above_2l': return 'Above ₹2L';
      default: return 'Not specified';
    }
  };

  const getPainLabel = (id: string) => {
    switch (id) {
      case 'duplicate_payments': return 'Duplicate Payments & Overdrafts';
      case 'messy_statements': return 'Messy Bank Statements';
      case 'vendor_overspend': return 'Software / Vendor Overspend';
      case 'month_end_reports': return 'Month-End Readiness Reports';
      case 'cashflow_visibility': return 'Real-time Cashflow Visibility';
      case 'accountant_handoff': return 'Accountant Collaboration';
      default: return id;
    }
  };

  const isBusinessOwner = accountMode === 'business_owner';

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Back button if inside a tab */}
      {activeTab !== 'overview' && (
        <button
          onClick={() => switchTab('overview')}
          className="flex items-center gap-2 text-xs font-bold text-teal-400 hover:text-teal-300 hover:underline transition-all cursor-pointer bg-transparent border-0 p-0"
        >
          &larr; Back to Settings Overview
        </button>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {activeTab === 'overview' 
            ? (isBusinessOwner ? 'Business Settings' : 'Workspace Settings')
            : tabs.find(t => t.id === activeTab)?.label
          }
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {activeTab === 'overview'
            ? (isBusinessOwner 
                ? 'Configure settings for your business, spend compliance, and book-keeping integrations.' 
                : 'Configure settings for your firm, client workspaces, spend rules, and data integrations.')
            : `Configure settings details for ${activeOrg?.name ?? 'your workspace'}.`
          }
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

      {/* Tabs list (hidden in Overview page, displayed inside tab views for secondary navigation) */}
      {activeTab !== 'overview' && (
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
      )}

      {/* ─── TAB: Overview ─── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Business Profile / Firm Profile */}
          <div className="premium-glass rounded-2xl border border-border/40 p-6 flex flex-col justify-between h-[300px] shadow-md hover:border-border/60 transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border/10 pb-2">
                <Building2 className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-foreground">
                  {isBusinessOwner ? 'Business Profile' : 'Firm Profile'}
                </h3>
              </div>
              
              {isBusinessOwner ? (
                activeClient ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Business Name:</span> <span className="font-bold text-foreground truncate max-w-[180px]">{activeClient.name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Industry:</span> <span className="font-semibold text-foreground">{activeClient.industry || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Accounting Tool:</span> <span className="font-semibold text-foreground">{activeClient.metadata?.accounting_tools?.[0] || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Monthly Spend Range:</span> <span className="font-semibold text-foreground">{getSpendDisplay(activeClient.metadata?.monthly_spend_range)}</span></div>
                    {activeClient.metadata?.pain_points && activeClient.metadata.pain_points.length > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">Main Pain:</span> <span className="font-semibold text-foreground truncate max-w-[180px]">{getPainLabel(activeClient.metadata.pain_points[0])}</span></div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Complete your business details profile.</p>
                )
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Firm Name:</span> <span className="font-bold text-foreground">{activeOrg?.name}</span></div>
                  <p className="text-[11px] text-muted-foreground leading-normal mt-2">
                    Manage workspace configuration, default currencies, and metadata tags for your bookkeeping firm.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border/10 flex flex-col space-y-2 mt-auto">
              <span className="text-[9.5px] text-muted-foreground leading-snug">
                {isBusinessOwner
                  ? 'Kaeo uses this context to categorize transactions, detect risks, and make Ask Kaeo more specific.'
                  : 'Manage accounting practice name, defaults, and details.'
                }
              </span>
              <button
                onClick={() => switchTab(isBusinessOwner ? 'clients' : 'workspace')}
                className="px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all w-full cursor-pointer mt-2"
              >
                {isBusinessOwner ? 'Edit Business Profile' : 'Edit Firm Profile'}
              </button>
            </div>
          </div>

          {/* Card 2: Client Businesses (Only for Accountant) */}
          {!isBusinessOwner && (
            <div className="premium-glass rounded-2xl border border-border/40 p-6 flex flex-col justify-between h-[300px] shadow-md hover:border-border/60 transition-all duration-300">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-400" />
                    <h3 className="text-sm font-bold text-foreground">Client Businesses</h3>
                  </div>
                  <span className="text-[10px] bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded border border-teal-500/20 font-bold">
                    {clients.length} Active
                  </span>
                </div>

                <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                  {clients.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">No client businesses added yet.</p>
                  ) : (
                    clients.slice(0, 3).map((c: any) => (
                      <div key={c.id} className="flex justify-between items-center text-xs p-1.5 bg-white/5 rounded-lg border border-border/10">
                        <span className="font-semibold text-foreground truncate max-w-[150px]">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">{c.industry || 'General'}</span>
                      </div>
                    ))
                  )}
                  {clients.length > 3 && (
                    <div className="text-[10px] text-muted-foreground font-semibold text-right">+ {clients.length - 3} more</div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-border/10 flex flex-col space-y-2 mt-auto">
                <span className="text-[9.5px] text-muted-foreground leading-snug">
                  Each client has separate uploads, transactions, risks, and reports.
                </span>
                <button
                  onClick={() => switchTab('clients')}
                  className="px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all w-full cursor-pointer mt-2"
                >
                  Manage Client Businesses
                </button>
              </div>
            </div>
          )}

          {/* Card 3: Spend Rules */}
          <div className="premium-glass rounded-2xl border border-border/40 p-6 flex flex-col justify-between h-[300px] shadow-md hover:border-border/60 transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border/10 pb-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-foreground">Spend Rules</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Configure evaluation parameters for compliance risk detection. Toggle duplicate checks, high-value alerts, subscription limits, and required mapping categories.
              </p>
            </div>

            <div className="pt-4 border-t border-border/10 flex flex-col space-y-2 mt-auto">
              <span className="text-[9.5px] text-muted-foreground leading-snug">
                These rules decide what Kaeo flags as risky or review-worthy.
              </span>
              <button
                onClick={() => switchTab('spend-rules')}
                className="px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all w-full cursor-pointer mt-2"
              >
                Configure Compliance Rules
              </button>
            </div>
          </div>

          {/* Card 4: Integrations */}
          <div className="premium-glass rounded-2xl border border-border/40 p-6 flex flex-col justify-between h-[300px] shadow-md hover:border-border/60 transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border/10 pb-2">
                <LinkIcon className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-foreground">Integrations</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Sync with book-keeping applications (Tally, Zoho Books) or connect payout systems (Razorpay Webhooks) to automate invoice matching and flow imports.
              </p>
            </div>

            <div className="pt-4 border-t border-border/10 flex flex-col space-y-2 mt-auto">
              <span className="text-[9.5px] text-muted-foreground leading-snug">
                Connect external accounts to streamline monthly file synchronization.
              </span>
              <button
                onClick={() => switchTab('integrations')}
                className="px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all w-full cursor-pointer mt-2"
              >
                Manage Integrations
              </button>
            </div>
          </div>

          {/* Card 5: Data & Reset */}
          <div className="premium-glass rounded-2xl border border-border/40 p-6 flex flex-col justify-between h-[300px] shadow-md hover:border-border/60 transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border/10 pb-2">
                <Database className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-foreground">Data & Reset</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Reset database tables and delete parsed transactions or uploaded sheets. Start clean with fresh CSV, Excel, or PDF imports.
              </p>
            </div>

            <div className="pt-4 border-t border-border/10 flex flex-col space-y-2 mt-auto">
              <span className="text-[9.5px] text-muted-foreground leading-snug">
                Clear transaction records and delete statement sheets.
              </span>
              <button
                onClick={() => switchTab('data')}
                className="px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all w-full cursor-pointer mt-2"
              >
                Reset Data Options
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: Workspace (Firm Settings) ─── */}
      {activeTab === 'workspace' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveFirm} className="premium-glass rounded-2xl border border-border/50 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/20 pb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Firm Profile</h2>
              </div>
              {!isEditingFirm && (
                <button
                  type="button"
                  onClick={() => setIsEditingFirm(true)}
                  className="px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                >
                  Edit Profile
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Firm Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Firm / Workspace Name</label>
                {isEditingFirm ? (
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    value={editFirmName}
                    onChange={(e) => setEditFirmName(e.target.value)}
                  />
                ) : (
                  <div className="px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold text-foreground">
                    {activeOrg?.name ?? '—'}
                  </div>
                )}
              </div>

              {/* Number of Clients */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Clients Managed</label>
                {isEditingFirm ? (
                  <select
                    className="w-full px-4 py-2.5 bg-[#161a18] border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                    value={editClientsManaged}
                    onChange={(e) => setEditClientsManaged(e.target.value)}
                  >
                    <option value="1-5">1 - 5 clients</option>
                    <option value="6-15">6 - 15 clients</option>
                    <option value="16-50">16 - 50 clients</option>
                    <option value="50+">50+ clients</option>
                  </select>
                ) : (
                  <div className="px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold text-foreground">
                    {profile?.onboarding_answers?.clients_managed ?? '1-5'}
                  </div>
                )}
              </div>

              {/* Typical Client Size */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Typical Client Size</label>
                {isEditingFirm ? (
                  <select
                    className="w-full px-4 py-2.5 bg-[#161a18] border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                    value={editTypicalSize}
                    onChange={(e) => setEditTypicalSize(e.target.value)}
                  >
                    <option value="Micro (< 10 employees)">Micro (&lt; 10 employees)</option>
                    <option value="Small (10-50 employees)">Small (10-50 employees)</option>
                    <option value="Medium (50-250 employees)">Medium (50-250 employees)</option>
                    <option value="Large (250+ employees)">Large (250+ employees)</option>
                  </select>
                ) : (
                  <div className="px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold text-foreground">
                    {profile?.onboarding_answers?.typical_client_size ?? 'Small (10-50 employees)'}
                  </div>
                )}
              </div>

              {/* Industries Served */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Industries Served</label>
                {isEditingFirm ? (
                  <input
                    type="text"
                    placeholder="e.g. SaaS, E-commerce, Manufacturing"
                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                    value={editIndustriesServed}
                    onChange={(e) => setEditIndustriesServed(e.target.value)}
                  />
                ) : (
                  <div className="px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold text-foreground">
                    {profile?.onboarding_answers?.industries_served || 'Not specified'}
                  </div>
                )}
              </div>

              {/* Accounting Tool */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Accounting Tools Used</label>
                {isEditingFirm ? (
                  <select
                    className="w-full px-4 py-2.5 bg-[#161a18] border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                    value={editFirmTool}
                    onChange={(e) => setEditFirmTool(e.target.value)}
                  >
                    <option value="Tally">Tally</option>
                    <option value="Zoho Books">Zoho Books</option>
                    <option value="Excel/Sheets">Excel / Google Sheets</option>
                    <option value="Razorpay">Razorpay</option>
                    <option value="Other">Other</option>
                  </select>
                ) : (
                  <div className="px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold text-foreground">
                    {profile?.onboarding_answers?.accounting_tools?.[0] || 'Tally'}
                  </div>
                )}
              </div>

              {/* Custom Notes / Ask Kaeo Context */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes & custom context for Ask Kaeo</label>
                {isEditingFirm ? (
                  <textarea
                    placeholder="Enter context, special rules, or instructions for the AI advisor..."
                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background h-24 resize-none transition-all"
                    value={editFirmNotes}
                    onChange={(e) => setEditFirmNotes(e.target.value)}
                  />
                ) : (
                  <div className="px-4 py-2.5 bg-muted/30 border border-border rounded-xl text-xs font-semibold text-muted-foreground leading-relaxed">
                    {profile?.onboarding_answers?.notes || 'No special context or firm notes provided. Edit profile to supply workspace instructions for Ask Kaeo.'}
                  </div>
                )}
              </div>
            </div>

            {isEditingFirm && (
              <div className="flex gap-3 border-t border-border/20 pt-5">
                <button
                  type="button"
                  onClick={() => setIsEditingFirm(false)}
                  disabled={savingFirm}
                  className="flex-1 py-3 px-4 bg-card border rounded-xl font-semibold hover:bg-muted transition-colors text-xs text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFirm}
                  className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 text-xs"
                >
                  {savingFirm ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Save Profile</>}
                </button>
              </div>
            )}
          </form>

          <div className="premium-glass rounded-2xl border border-border/50 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">
                Client Workspaces
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage client businesses and client workspaces from the Client Businesses tab.
            </p>
            <button
              onClick={() => switchTab('clients')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-xs font-bold border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Go to Client Businesses
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB: Spend Rules ─── */}
      {activeTab === 'spend-rules' && (
        <div className="space-y-6 animate-in fade-in duration-300">
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
            <p className="text-sm text-muted-foreground italic">Select a business/workspace to configure spend rules.</p>
          ) : rulesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading rules…</span>
            </div>
          ) : rulesSchemaMissing ? (
            <div className="premium-glass rounded-2xl border border-border/40 p-6 text-center space-y-4">
              <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
              <div className="space-y-1">
                <h4 className="font-bold text-foreground">Spend Rules Setup Required</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Spend Rules is not fully configured yet. Deploy database migrations to begin.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveAllRules} className="space-y-6">
              <div className="space-y-4">
                {/* 1. Duplicate Window */}
                <div className={`premium-glass rounded-2xl border p-5 transition-all duration-300 ${duplicateEnabled ? 'border-primary/30 shadow-sm shadow-primary/5' : 'border-border/40 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground">Duplicate Payment Detection</h3>
                        {!duplicateEnabled && (
                          <span className="px-2 py-0.5 bg-muted rounded text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Disabled</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">Flag repeated payments to the same vendor within this window.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDuplicateEnabled(!duplicateEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${duplicateEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${duplicateEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {duplicateEnabled && (
                    <div className="mt-4 pt-4 border-t border-border/30 max-w-xs space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">Time Window (Days)</label>
                      <input
                        type="number"
                        min="0"
                        required
                        className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
                        value={duplicateDays}
                        onChange={e => setDuplicateDays(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                  )}
                </div>

                {/* 2. High Value Outflow */}
                <div className={`premium-glass rounded-2xl border p-5 transition-all duration-300 ${highValueEnabled ? 'border-primary/30 shadow-sm shadow-primary/5' : 'border-border/40 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground">High-Value Outflow</h3>
                        {!highValueEnabled && (
                          <span className="px-2 py-0.5 bg-muted rounded text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Disabled</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">Payments above this amount will be marked for review.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHighValueEnabled(!highValueEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${highValueEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${highValueEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {highValueEnabled && (
                    <div className="mt-4 pt-4 border-t border-border/30 max-w-xs space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">Amount Threshold (₹)</label>
                      <input
                        type="number"
                        min="0"
                        required
                        className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
                        value={highValueAmount}
                        onChange={e => setHighValueAmount(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                  )}
                </div>

                {/* 3. Large Subscriptions */}
                <div className={`premium-glass rounded-2xl border p-5 transition-all duration-300 ${subscriptionEnabled ? 'border-primary/30 shadow-sm shadow-primary/5' : 'border-border/40 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground">Large Subscriptions</h3>
                        {!subscriptionEnabled && (
                          <span className="px-2 py-0.5 bg-muted rounded text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Disabled</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">Recurring tool or subscription charges above this amount need review.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSubscriptionEnabled(!subscriptionEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${subscriptionEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${subscriptionEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {subscriptionEnabled && (
                    <div className="mt-4 pt-4 border-t border-border/30 max-w-xs space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">Amount Threshold (₹)</label>
                      <input
                        type="number"
                        min="0"
                        required
                        className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
                        value={subscriptionAmount}
                        onChange={e => setSubscriptionAmount(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                  )}
                </div>

                {/* 4. Unknown Vendor Protection */}
                <div className={`premium-glass rounded-2xl border p-5 transition-all duration-300 ${unknownVendorEnabled ? 'border-primary/30 shadow-sm shadow-primary/5' : 'border-border/40 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground">Unknown Vendor Protection</h3>
                        {!unknownVendorEnabled && (
                          <span className="px-2 py-0.5 bg-muted rounded text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Disabled</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">Mark payments to vendors Kaeo has not seen before.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUnknownVendorEnabled(!unknownVendorEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${unknownVendorEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${unknownVendorEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                {/* 5. Enforce Categorization */}
                <div className={`premium-glass rounded-2xl border p-5 transition-all duration-300 ${uncategorizedEnabled ? 'border-primary/30 shadow-sm shadow-primary/5' : 'border-border/40 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground">Enforce Categorization</h3>
                        {!uncategorizedEnabled && (
                          <span className="px-2 py-0.5 bg-muted rounded text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Disabled</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">Keep uncategorized rows in the review queue.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUncategorizedEnabled(!uncategorizedEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${uncategorizedEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${uncategorizedEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/20">
                <button
                  type="submit"
                  disabled={savingRules}
                  className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 text-xs cursor-pointer"
                >
                  {savingRules ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Save Compliance Rules</>}
                </button>
                <button
                  type="button"
                  onClick={handleResetRulesToDefault}
                  disabled={savingRules}
                  className="flex-1 py-3 px-4 bg-card border border-border rounded-xl font-semibold hover:bg-muted transition-colors text-xs text-center text-foreground cursor-pointer"
                >
                  Reset to Defaults
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ─── TAB: Data & Reset ─── */}
      {activeTab === 'data' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header Copy */}
          <div className="flex flex-col md:flex-row gap-4 p-5 premium-glass rounded-2xl border border-primary/20 items-start">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1">Data & Reset Management</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Use this only when you want to clear imported finance data.
              </p>
            </div>
          </div>

          {/* Safe Data Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="premium-glass rounded-2xl border border-border/50 p-5 flex flex-col justify-between h-40">
              <div>
                <h4 className="font-bold text-foreground text-sm mb-1">Uploaded Files</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  View and manage uploaded statements, invoices, and ledger sheets.
                </p>
              </div>
              <Link to="/files" className="w-fit px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl transition-all">
                Go to Files
              </Link>
            </div>

            <div className="premium-glass rounded-2xl border border-border/50 p-5 flex flex-col justify-between h-40">
              <div>
                <h4 className="font-bold text-foreground text-sm mb-1">Imported Transactions</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  View normal and clean transactions parsed into the system database.
                </p>
              </div>
              <Link to="/transactions" className="w-fit px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl transition-all">
                View Transactions
              </Link>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="premium-glass rounded-2xl border border-risk/30 overflow-hidden shadow-lg shadow-risk/5">
            <div className="p-6 bg-risk/5 border-b border-risk/10">
              <h4 className="font-bold text-risk flex items-center gap-2 text-sm uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-risk" /> Danger Zone
              </h4>
            </div>
            <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h5 className="font-bold text-foreground">Reset Current Business Data</h5>
                <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                  Permanently clear all financial ledger statements, invoices, and parsed transactions for the current business. <strong className="text-risk font-semibold">This operation cannot be undone.</strong>
                </p>
              </div>
              {activeClient && activeOrg ? (
                <button
                  onClick={() => setIsResetModalOpen(true)}
                  className="shrink-0 px-4 py-2 bg-risk text-white hover:opacity-90 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-risk/20 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset {activeClient.name}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground italic">Select a business to manage data.</p>
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
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row gap-4 p-5 premium-glass rounded-2xl border border-primary/20 items-start">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-1">Integrations Directory</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connect tools later. Uploads work today.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Excel / Google Sheets */}
            <div className="premium-glass border border-success/30 shadow-sm shadow-success/5 rounded-2xl p-5 flex flex-col justify-between h-44">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-foreground text-sm">Excel / Google Sheets</h4>
                  <span className="text-[9px] font-black uppercase text-success bg-success/15 px-2 py-0.5 rounded border border-success/20">Connected</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Direct client-side file ingestion, schema column-mapping, and duplicate ledger entries protection.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-success font-semibold mt-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active — Ready to ingest files
              </div>
            </div>

            {/* Razorpay */}
            <div className="premium-glass rounded-2xl border border-border/50 p-5 flex flex-col justify-between h-44">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-foreground text-sm">Razorpay</h4>
                  <span className="text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">Available</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Real-time webhook connectivity to evaluate outgoing vendor payment risk immediately upon processing. Connect later. Manage subscription and check integration options.
                </p>
              </div>
              <Link to="/billing" className="w-fit text-xs font-bold text-primary hover:underline mt-2">
                Manage billing / Connect later →
              </Link>
            </div>

            {/* Tally */}
            <div className="premium-glass rounded-2xl border border-border/50 p-5 flex flex-col justify-between h-44 opacity-70">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-foreground text-sm">Tally Prime / ERP 9</h4>
                  <span className="text-[9px] font-black uppercase text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/20">Coming soon</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Planned for accountant-ready sync. Export files offline today. Direct sync coming soon.
                </p>
              </div>
              <button disabled className="w-fit text-xs font-bold text-muted-foreground mt-2 text-left cursor-not-allowed">
                Direct sync coming soon
              </button>
            </div>

            {/* Zoho Books */}
            <div className="premium-glass rounded-2xl border border-border/50 p-5 flex flex-col justify-between h-44 opacity-70">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-foreground text-sm">Zoho Books</h4>
                  <span className="text-[9px] font-black uppercase text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/20">Coming soon</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Direct OAuth interface to synchronize Zoho invoices, debit notes, and bank reconciliations automatically.
                </p>
              </div>
              <button disabled className="w-fit text-xs font-bold text-muted-foreground mt-2 text-left cursor-not-allowed">
                Zoho OAuth coming soon
              </button>
            </div>

            {/* Bank Feeds */}
            <div className="premium-glass rounded-2xl border border-border/50 p-5 flex flex-col justify-between h-44 opacity-70">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-foreground text-sm">Bank Feeds</h4>
                  <span className="text-[9px] font-black uppercase text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/20">Planned</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Synchronize bank statement line entries in real-time from supported corporate bank accounts.
                </p>
              </div>
              <button disabled className="w-fit text-xs font-bold text-muted-foreground mt-2 text-left cursor-not-allowed">
                Bank feed sync planned
              </button>
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
