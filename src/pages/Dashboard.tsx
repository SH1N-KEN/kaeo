import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertCircle,
  FileText,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Zap,
  Clock,
  Download,
  Info,
  Calendar
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import EmptyState from '../components/ui/EmptyState';
import MetricCard from '../components/ui/MetricCard';
import { supabase } from '../lib/supabase';

const Dashboard: React.FC = () => {
  const { activeClient } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    income: 0,
    expenses: 0,
    refunds: 0,
    net: 0,
    count: 0,
    incomeCount: 0,
    expenseCount: 0,
    unknownCount: 0,
    vendorPaymentCount: 0,
    refundCount: 0,
    failedCount: 0,
    topVendor: { name: '', amount: 0 }
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (activeClient) fetchDashboardData();
  }, [activeClient]);

  const fetchDashboardData = async () => {
    if (!activeClient) return;
    setLoading(true);
    try {
      const { data: allTransactions, error: metricsErr } = await supabase
        .from('transactions')
        .select('amount, type, description')
        .eq('client_id', activeClient.id);

      if (metricsErr) throw metricsErr;

      const vendors: Record<string, number> = {};

      const stats = (allTransactions || []).reduce((acc, tx) => {
        const amt = Math.abs(Number(tx.amount));
        
        if (tx.type === 'income') {
          acc.income += amt;
          acc.incomeCount++;
        } 
        else if (['expense', 'vendor_payment', 'subscription'].includes(tx.type)) {
          acc.expenses += amt;
          acc.expenseCount++;
          if (tx.type === 'vendor_payment') acc.vendorPaymentCount++;
          
          // Track vendor - prioritized heuristic for expenses only
          const name = tx.description.replace(/vendor payment|payment to|paid to|google ads|meta ads|facebook ads/gi, '').trim().split(' ').filter((w: string) => w.length > 2 && !/\d/.test(w))[0] || tx.description.split(' ')[0];
          vendors[name] = (vendors[name] || 0) + amt;
        }
        else if (tx.type === 'refund') {
          acc.refunds += amt;
          acc.refundCount++;
        }
        else if (tx.type === 'unknown') {
          acc.unknownCount++;
        }
        else if (tx.type === 'failed' || tx.type === 'failed_payment') {
          acc.failedCount++;
        }
        
        acc.count++;
        return acc;
      }, { 
        income: 0, 
        expenses: 0, 
        refunds: 0, 
        count: 0, 
        incomeCount: 0, 
        expenseCount: 0, 
        unknownCount: 0,
        vendorPaymentCount: 0,
        refundCount: 0,
        failedCount: 0
      });

      let topVendor = { name: '', amount: 0 };
      Object.entries(vendors).forEach(([name, amount]) => {
        if (amount > topVendor.amount) topVendor = { name, amount };
      });

      setMetrics({
        ...stats,
        net: stats.income + stats.refunds - stats.expenses,
        topVendor
      });

      const { data: recent, error: recentErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('transaction_date', { ascending: false })
        .limit(5);

      if (recentErr) throw recentErr;
      setRecentTransactions(recent || []);

    } catch (err: any) {
      console.error('[Dashboard] Fetch error:', err);
    } finally {
      setLoading(false);
    }
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

  if (!activeClient) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <EmptyState 
          title="No client workspace selected"
          description="Create or select a client workspace to view financial insights."
        />
      </div>
    );
  }

  if (loading && metrics.count === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse font-medium">Aggregating ledger data...</p>
      </div>
    );
  }

  const hasTransactions = metrics.count > 0;
  const isExpenseOnly = hasTransactions && metrics.incomeCount === 0;
  const isMixed = hasTransactions && metrics.incomeCount > 0 && metrics.expenseCount > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">CFO Workspace</h1>
            <div className="px-1.5 py-0.5 bg-success/10 text-success text-[10px] font-black rounded border border-success/20 uppercase tracking-tighter">Live</div>
          </div>
          <p className="text-sm text-muted-foreground">Strategic overview for <span className="text-foreground font-semibold">{activeClient.name}</span></p>
        </div>
        
        <div className="flex gap-2">
          <div className="group relative">
            <button 
              disabled 
              className="px-3 py-2 bg-muted/40 text-muted-foreground/50 rounded-lg text-xs font-bold flex items-center gap-2 cursor-not-allowed border border-border/50 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Download Report
            </button>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              Coming in Phase 5
            </div>
          </div>
          <button 
            disabled
            className="px-3 py-2 bg-muted/40 text-muted-foreground/50 rounded-lg text-xs font-bold flex items-center gap-2 cursor-not-allowed border border-border/50"
          >
            <Plus className="w-3.5 h-3.5" /> Add Transaction
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${metrics.refunds > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
        <MetricCard 
          title="Total Revenue" 
          value={hasTransactions ? formatCurrency(metrics.income) : '—'} 
          description={hasTransactions ? (metrics.incomeCount > 0 ? "From customer payments" : "No income rows detected in this import") : "No data yet"}
          icon={<TrendingUp className={`w-4 h-4 ${metrics.incomeCount > 0 ? 'text-success' : 'text-muted-foreground'}`} />} 
        />
        {metrics.refunds > 0 && (
          <MetricCard 
            title="Refunds & Recoveries" 
            value={hasTransactions ? formatCurrency(metrics.refunds) : '—'} 
            description={hasTransactions ? `From ${metrics.refundCount} refund/reversal entries` : ""}
            icon={<TrendingUp className="w-4 h-4 text-success" />} 
          />
        )}
        <MetricCard 
          title="Total Expenses" 
          value={hasTransactions ? formatCurrency(metrics.expenses) : '—'} 
          description={hasTransactions ? "From imported expense rows" : ""}
          icon={<TrendingDown className={`w-4 h-4 ${metrics.expenseCount > 0 ? 'text-risk/70' : 'text-muted-foreground'}`} />} 
        />
        <MetricCard 
          title="Net Cash Movement" 
          value={hasTransactions ? formatCurrency(metrics.net) : '—'} 
          description={hasTransactions ? (metrics.net > 0 ? "Net cash positive" : metrics.net < 0 ? "Net cash negative" : "Balanced") : "No data yet"}
          icon={<DollarSign className={`w-4 h-4 ${hasTransactions ? (metrics.net >= 0 ? 'text-success' : 'text-risk/70') : 'text-muted-foreground'}`} />} 
        />
        <MetricCard 
          title="Transactions" 
          value={hasTransactions ? metrics.count.toString() : '—'} 
          description={hasTransactions ? "Imported transactions" : ""} 
          icon={<FileText className="w-4 h-4 text-primary" />} 
        />
      </div>

      {!hasTransactions ? (
        <div className="bg-card/30 border border-dashed border-border/60 rounded-3xl p-20 flex flex-col items-center justify-center text-center space-y-5">
          <div className="w-16 h-16 bg-muted/30 rounded-2xl flex items-center justify-center border border-border/50">
            <FileText className="w-8 h-8 text-muted-foreground/30" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">No financial data yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Upload and import a finance file to activate your dashboard.
            </p>
          </div>
          <button 
            onClick={() => window.location.href = '/files'}
            className="px-8 py-3 bg-foreground text-background rounded-xl font-bold hover:opacity-90 transition-all shadow-xl shadow-foreground/10"
          >
            Upload Finance File
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-6">
            {/* File Interpretation Card */}
            {hasTransactions && (
              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex gap-4 items-start animate-in slide-in-from-bottom-2 duration-500">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-3 flex-1">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">File Interpretation</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {isExpenseOnly ? (
                        <>Kaeo detected this as an <span className="text-foreground font-semibold">expense-only file</span>. To calculate revenue, upload a file containing sales, payouts, client payments, deposits, or credit entries.</>
                      ) : isMixed ? (
                        <>Kaeo detected a <span className="text-foreground font-semibold">mixed income and expense file</span>. Strategic breakdown of revenue and costs is now active.</>
                      ) : (
                        <>Kaeo has categorized your ledger entries. You can view the full breakdown in the ledger below.</>
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Composition:</p>
                    <div className="flex gap-4">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Income rows</span>
                        <span className="text-sm font-bold">{metrics.incomeCount}</span>
                      </div>
                      {metrics.refundCount > 0 && (
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">Refund rows</span>
                          <span className="text-sm font-bold">{metrics.refundCount}</span>
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Expense rows</span>
                        <span className="text-sm font-bold">{metrics.expenseCount}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Unknown rows</span>
                        <span className="text-sm font-bold">{metrics.unknownCount}</span>
                      </div>
                      {metrics.failedCount > 0 && (
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">Failed rows</span>
                          <span className="text-sm font-bold">{metrics.failedCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Recent Ledger Entries
                </h3>
                <button 
                  onClick={() => window.location.href = '/transactions'}
                  className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest"
                >
                  View Full Ledger
                </button>
              </div>
              <div className="divide-y divide-border/30">
                {recentTransactions.map((tx) => {
                  const isExpense = ['expense', 'vendor_payment', 'subscription'].includes(tx.type);
                  const isIncome = tx.type === 'income';
                  
                  return (
                    <div key={tx.id} className="px-6 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isExpense ? 'bg-muted/50 text-muted-foreground' : isIncome ? 'bg-success/10 text-success' : 'bg-muted/30 text-muted-foreground'}`}>
                          {isExpense ? <ArrowUpRight className="w-4 h-4" /> : isIncome ? <ArrowDownLeft className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate text-foreground group-hover:text-primary transition-colors">{tx.description}</div>
                          <div className={`text-[9px] font-black tracking-widest uppercase ${isExpense ? 'text-muted-foreground/60' : isIncome ? 'text-success' : 'text-muted-foreground/60'}`}>
                            {tx.type.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-bold ${isExpense ? 'text-foreground' : isIncome ? 'text-success' : 'text-foreground'}`}>
                          {isExpense ? '-' : isIncome ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                        </div>
                        <div className="text-[9px] text-muted-foreground font-medium">{new Date(tx.transaction_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar Insights */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-sm space-y-6">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Strategic Insights
              </h3>
              
              <div className="space-y-4">
                {metrics.topVendor.amount > 0 && (
                  <div className="p-4 bg-muted/40 rounded-xl border border-border/50">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Primary Expense Destination</p>
                    <p className="text-lg font-bold text-foreground leading-tight mb-1">{metrics.topVendor.name}</p>
                    <p className="text-xs font-medium text-muted-foreground">
                      Cumulative spend: <span className="font-bold text-foreground">{formatCurrency(metrics.topVendor.amount)}</span>
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/30">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary/40" />
                      <span className="text-[11px] font-bold">Import Composition</span>
                    </div>
                    <span className="text-[10px] font-black text-muted-foreground">{metrics.count} Rows</span>
                  </div>

                  {isExpenseOnly ? (
                    <div className="flex items-center gap-2 p-3 bg-risk/5 rounded-xl border border-risk/10">
                      <AlertCircle className="w-3.5 h-3.5 text-risk/60" />
                      <span className="text-[11px] font-bold text-risk/80">Expense-only file detected</span>
                    </div>
                  ) : isMixed ? (
                    <div className="flex items-center gap-2 p-3 bg-success/5 rounded-xl border border-success/10">
                      <TrendingUp className="w-3.5 h-3.5 text-success/60" />
                      <span className="text-[11px] font-bold text-success/80">Mixed income and expense file</span>
                    </div>
                  ) : null}

                  {metrics.unknownCount > 0 && (
                    <div className="flex items-center justify-between p-3 bg-warning/5 rounded-xl border border-warning/10">
                      <div className="flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-warning/60" />
                        <span className="text-[11px] font-bold text-warning/80">{metrics.unknownCount} Unknown entries</span>
                      </div>
                      <button 
                        onClick={() => window.location.href = '/transactions'}
                        className="text-[9px] font-black text-warning hover:underline uppercase"
                      >
                        Review
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Legend / Quick Help */}
            <div className="px-6 py-4 bg-muted/20 rounded-2xl border border-border/30">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">Intelligence Legend</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  Income: Verified revenue entries
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-risk/50" />
                  Expenses: Direct outflow entries
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                  Unknown: Uncategorized context
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
