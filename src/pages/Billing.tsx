import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Sparkles, 
  ShieldAlert, 
  AlertTriangle, 
  Layers, 
  Users, 
  FileSpreadsheet, 
  UploadCloud, 
  Bot, 
  FileText, 
  Check, 
  Loader2, 
  CreditCard,
  Info,
  ExternalLink,
  Plus
} from 'lucide-react';
import { useBilling } from '../hooks/useBilling';
import { useWorkspace } from '../hooks/useWorkspace';
import { getPlanLimit, startRazorpayCheckout, syncRazorpayPaymentStatus } from '../lib/billing';
import type { Plan, BillingUsageEventType } from '../lib/billing';
import CreateWorkspaceModal from '../components/ui/CreateWorkspaceModal';

const Billing: React.FC = () => {
  const { activeOrg, createOrganization } = useWorkspace();
  const { 
    plans, 
    subscription, 
    currentPlan, 
    usage, 
    loading, 
    error, 
    schemaMissing, 
    isOverLimit, 
    getUsagePercent,
    refreshBilling
  } = useBilling();

  const [isYearly, setIsYearly] = useState(false);
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const handleSync = async (silent = false) => {
    if (!activeOrg) return;
    if (!silent) {
      setSyncing(true);
      setSyncMessage(null);
    }
    try {
      const res = await syncRazorpayPaymentStatus({
        organizationId: activeOrg.id,
        subscriptionId: subscription?.id || undefined,
        paymentLinkId: subscription?.razorpay_payment_link_id || undefined
      });

      if (res.synced) {
        setSyncMessage({ text: "Payment confirmed. Your plan is active.", type: 'success' });
        await refreshBilling();
      } else {
        if (!silent) {
          setSyncMessage({ 
            text: "Payment may take a few seconds to sync.", 
            type: 'info' 
          });
        }
      }
    } catch (err: any) {
      console.error("[Sync error]", err);
      if (!silent) {
        setSyncMessage({ 
          text: err.message || "Failed to verify status. Please retry.", 
          type: 'error' 
        });
      }
    } finally {
      if (!silent) {
        setSyncing(false);
      }
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'razorpay_return') {
      handleSync(true);
      
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [activeOrg?.id, subscription?.id]);

  const handleUpgrade = async (planId: string) => {
    if (!activeOrg) return;
    setUpgradingPlanId(planId);
    setCheckoutError(null);
    try {
      const billingCycle = isYearly ? 'yearly' : 'monthly';
      const result = await startRazorpayCheckout({
        organizationId: activeOrg.id,
        planId,
        billingCycle
      });
      
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        throw new Error("No payment checkout URL returned from gateway.");
      }
    } catch (err: any) {
      console.error("[Upgrade checkout failed]", err);
      setCheckoutError(err.message || "Razorpay setup missing. Add Razorpay secrets and retry.");
    } finally {
      setUpgradingPlanId(null);
    }
  };

  const getStatusCopy = (status?: string) => {
    if (!status) return "Your plan is active.";
    switch (status) {
      case 'pending_payment':
        return "Payment may take a few seconds to sync.";
      case 'active':
        return "Your plan is active.";
      case 'trialing':
        return "You are in the free trial period.";
      case 'cancelled':
        return "Plan cancelled.";
      case 'failed':
        return "Payment failed. Retry upgrade.";
      default:
        return `Status: ${status.replace('_', ' ').toUpperCase()}`;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">Loading your billing configurations...</p>
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="max-w-xl mx-auto my-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-card border border-border rounded-sm p-8 shadow-sm space-y-6 text-center relative overflow-hidden group">
          <div className="w-16 h-16 bg-muted rounded-sm flex items-center justify-center text-muted-foreground mx-auto border border-border">
            <Building2 className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Create a workspace first</h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
              Billing is managed at the workspace level. Create a workspace to choose a plan, track usage, and connect Razorpay billing.
            </p>
          </div>
          
          <div className="pt-4 max-w-xs mx-auto">
            <button 
              onClick={() => setIsOrgModalOpen(true)}
              className="w-full py-3 px-6 bg-foreground text-background font-semibold rounded-sm text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Workspace</span>
            </button>
          </div>
        </div>

        <CreateWorkspaceModal 
          isOpen={isOrgModalOpen}
          onClose={() => setIsOrgModalOpen(false)}
          onCreate={createOrganization}
        />
      </div>
    );
  }

  if (schemaMissing) {
    return (
      <div className="max-w-xl mx-auto my-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-card border border-border rounded-sm p-8 shadow-sm space-y-6 text-center">
          <div className="w-16 h-16 bg-muted rounded-sm flex items-center justify-center text-muted-foreground mx-auto border border-border">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Billing schema required</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The billing plan tables and subscription triggers have not been deployed to your database.
            </p>
          </div>
          
          <div className="p-4 bg-muted border border-border rounded-sm text-left space-y-2">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-muted-foreground" /> How to resolve:
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Execute the latest migration file in your Supabase SQL editor or console:
            </p>
            <code className="block text-[10px] bg-card p-3 rounded-sm border border-border text-foreground font-mono select-all">
              supabase/migrations/0012_billing_plans_subscriptions.sql
            </code>
          </div>

          <p className="text-[11px] text-muted-foreground/80 italic">
            This dashboard will fully load as soon as the tables are created.
          </p>
        </div>
      </div>
    );
  }

  const startDate = subscription ? new Date(subscription.current_period_start).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  }) : 'N/A';
  const endDate = subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  }) : 'N/A';

  const getTrialDaysLeft = () => {
    if (!subscription?.trial_ends_at || subscription.status !== 'trialing') return null;
    const ends = new Date(subscription.trial_ends_at);
    const now = new Date();
    const diff = ends.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const trialDaysLeft = getTrialDaysLeft();

  const usageCards: {
    type: BillingUsageEventType;
    title: string;
    icon: React.ComponentType<any>;
    limitKey: keyof Plan;
    description: string;
  }[] = [
    { 
      type: 'client_created', 
      title: 'Active Clients', 
      icon: Users, 
      limitKey: 'max_clients',
      description: 'Total active businesses under this workspace.' 
    },
    { 
      type: 'transaction_imported', 
      title: 'Imported Transactions', 
      icon: FileSpreadsheet, 
      limitKey: 'max_transactions_per_month',
      description: 'Ledger rows processed in the current period.' 
    },
    { 
      type: 'file_uploaded', 
      title: 'Uploaded Files', 
      icon: UploadCloud, 
      limitKey: 'max_file_uploads_per_month',
      description: 'Raw bank statements or Excel statements ingested.' 
    },
    { 
      type: 'ai_message_sent', 
      title: 'AI Advisor Messages', 
      icon: Bot, 
      limitKey: 'max_ai_messages_per_month',
      description: 'Ask Kaeo conversations and strategies run.' 
    },
    { 
      type: 'report_generated', 
      title: 'Reports Exported', 
      icon: FileText, 
      limitKey: 'max_reports_per_month',
      description: 'PDF/CSV sheets exported for your clients.' 
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Billing & Plans</h1>
          <p className="text-muted-foreground text-xs font-medium">Manage your workspace tier, usage allowances, and invoice preparations.</p>
        </div>
        <div className="flex items-center gap-2 bg-muted p-1 rounded-sm border border-border shrink-0 w-fit">
          <button 
            onClick={() => setIsYearly(false)}
            className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all ${
              !isYearly ? 'bg-card text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly
          </button>
          <button 
            onClick={() => setIsYearly(true)}
            className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all flex items-center gap-1.5 ${
              isYearly ? 'bg-card text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Yearly
            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-muted border border-border text-foreground font-black uppercase">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {(error || checkoutError) && (
        <div className="p-4 bg-muted border border-border rounded-sm flex gap-3 items-center">
          <AlertTriangle className="w-5 h-5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground font-semibold">{error || checkoutError}</p>
        </div>
      )}

      {syncMessage && (
        <div className="p-4 border rounded-sm flex gap-3 items-center bg-muted text-foreground border-border">
          {syncMessage.type === 'success' ? (
            <Check className="w-5 h-5 shrink-0" />
          ) : syncMessage.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          ) : (
            <Info className="w-5 h-5 shrink-0" />
          )}
          <p className="text-xs font-bold">{syncMessage.text}</p>
        </div>
      )}

      {/* A. CURRENT SUBSCRIPTION CARD */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted rounded-sm border border-border flex items-center justify-center text-muted-foreground">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Active Workspace Plan</span>
                <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                  {currentPlan?.name || 'Free'} Plan
                  <span className="text-[10px] px-2 py-0.5 rounded-sm font-black uppercase border bg-muted text-foreground border-border">
                    {subscription?.status || 'active'}
                  </span>
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-2">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Billing Cycle</p>
                <p className="text-xs font-bold text-foreground capitalize mt-0.5">{subscription?.billing_cycle || 'monthly'}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Current Period</p>
                <p className="text-xs font-bold text-foreground mt-0.5">{startDate} — {endDate}</p>
              </div>
              {trialDaysLeft !== null && (
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Trial Period</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">{trialDaysLeft} days remaining</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-muted border border-border p-5 rounded-sm space-y-2 shrink-0 md:max-w-sm w-full">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <span className="inline-block w-2 h-2 rounded-sm bg-foreground"></span>
              Status: {subscription?.status ? subscription.status.replace('_', ' ').toUpperCase() : 'ACTIVE'}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">
              {getStatusCopy(subscription?.status)}
            </p>
            {subscription?.status === 'pending_payment' && (
              <div className="pt-2">
                <button
                  disabled={syncing}
                  onClick={() => handleSync(false)}
                  className="w-full py-2.5 px-4 bg-foreground text-background font-semibold rounded-sm text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  {syncing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Bot className="w-3.5 h-3.5" />
                  )}
                  <span>{syncing ? 'Verifying...' : 'Refresh payment status'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* B. USAGE THIS PERIOD */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-black tracking-tight">Usage This Period</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {usageCards.map(card => {
            if (!usage || !currentPlan) return null;
            const used = usage[card.type] || 0;
            const limit = getPlanLimit(currentPlan, card.type);
            const isUnlimited = limit === null || limit <= 0;
            const percent = isUnlimited ? 0 : getUsagePercent(card.type);
            const overLimit = isUnlimited ? false : isOverLimit(card.type);
            const nearLimit = isUnlimited ? false : (percent >= 80 && !overLimit);

            return (
              <div key={card.type} className="bg-card border border-border rounded-sm p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-muted rounded-sm text-muted-foreground border border-border/40">
                      <card.icon className="w-5 h-5" />
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-sm font-black uppercase bg-muted text-foreground border border-border">
                      {isUnlimited ? 'Unlimited' : overLimit ? 'Exceeded' : nearLimit ? 'Near Limit' : 'Optimal'}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{card.title}</h4>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{card.description}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-baseline text-xs font-bold">
                    <span className="text-foreground text-sm">{used.toLocaleString()}</span>
                    <span className="text-muted-foreground font-medium text-[10px]">
                      / {isUnlimited ? 'Unlimited' : limit.toLocaleString()}
                    </span>
                  </div>
                  
                  {!isUnlimited && (
                    <div className="space-y-1">
                      <div className="w-full bg-muted h-1.5 rounded-sm overflow-hidden">
                        <div 
                          className="h-full bg-foreground rounded-sm transition-all duration-500" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] text-muted-foreground font-semibold">
                        <span>{percent}% Used</span>
                        {nearLimit && <span>Warning: 80% Threshold reached</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* C. SUBSCRIPTION PLANS */}
      <div className="space-y-6 pt-6 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-black tracking-tight">Available Subscription Tiers</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isCurrent = subscription?.plan_id === plan.id;
            const price = isYearly 
              ? (plan.price_yearly_inr ?? (plan.price_monthly_inr * 10)) 
              : plan.price_monthly_inr;
            
            const formattedPrice = price === 0 
              ? 'Free' 
              : `₹${price.toLocaleString('en-IN')}`;

            const features: string[] = Array.isArray(plan.features_json) 
              ? plan.features_json 
              : JSON.parse(plan.features_json as any || '[]');

            return (
              <div 
                key={plan.id} 
                className={`relative bg-card border rounded-sm p-6 flex flex-col justify-between transition-all duration-300 ${
                  isCurrent 
                    ? 'border-foreground border-2 shadow-none' 
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] px-3 py-1 rounded-sm font-black uppercase tracking-wider">
                    Current Active Tier
                  </span>
                )}

                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-black text-lg text-foreground mt-2">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground leading-normal min-h-[32px]">{plan.description}</p>
                  </div>

                  <div className="space-y-1 py-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-foreground">{formattedPrice}</span>
                      {price > 0 && (
                        <span className="text-xs text-muted-foreground font-semibold">
                          /{isYearly ? 'yr' : 'mo'}
                        </span>
                      )}
                    </div>
                    {isYearly && price > 0 && (
                      <p className="text-[9px] text-foreground font-bold">Includes 2 months free discount</p>
                    )}
                  </div>

                  <div className="border-t border-border pt-4 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">What's Included:</p>
                    <ul className="space-y-2">
                      {features.map((feature, idx) => (
                        <li key={idx} className="flex gap-2 items-start text-xs text-muted-foreground">
                          <Check className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="leading-normal">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-6">
                  {isCurrent ? (
                    <div className="w-full text-center py-2.5 bg-muted rounded-sm text-xs font-bold text-muted-foreground border border-border">
                      Active Plan
                    </div>
                  ) : plan.id === 'free' ? (
                    <button 
                      disabled
                      className="w-full text-center py-2.5 bg-muted text-muted-foreground/60 border border-border rounded-sm text-xs font-semibold cursor-not-allowed"
                    >
                      Free Plan
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={upgradingPlanId !== null}
                      className="w-full text-center py-2.5 bg-foreground text-background font-semibold rounded-sm text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                    >
                      {upgradingPlanId === plan.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <span>Upgrade to {plan.name}</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* D. RAZORPAY PLATFORM NOTE */}
      <div className="bg-muted border border-border rounded-sm p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <h4 className="font-bold text-base text-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            Razorpay Billing Gateway Architecture
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl font-medium">
            Kaeo is fully Razorpay-first. This setup maps essential Razorpay payment metadata (`razorpay_customer_id`, `razorpay_payment_link_id`, `razorpay_plan_id`) directly to organizations. Your active billing accounts will sync automatically to capture payments and dispatch webhooks via Razorpay Payment Links.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            Razorpay Active Account Configured <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
};

export default Billing;
