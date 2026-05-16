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
  Lock,
  Download
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
    net: 0,
    count: 0,
    unknownCount: 0,
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
        } 
        else if (['expense', 'vendor_payment', 'subscription'].includes(tx.type)) {
          acc.expenses += amt;
          
          // Better vendor heuristic: ignore common short words or numbers
          const name = tx.description.split(' ').filter((w: string) => w.length > 2 && !/\d/.test(w))[0] || tx.description.split(' ')[0];
          vendors[name] = (vendors[name] || 0) + amt;
        }
        else if (tx.type === 'refund') {
          acc.expenses -= amt; 
        }
        
        if (tx.type === 'unknown') acc.unknownCount++;
        acc.count++;
        return acc;
      }, { income: 0, expenses: 0, count: 0, unknownCount: 0 });

      let topVendor = { name: '', amount: 0 };
      Object.entries(vendors).forEach(([name, amount]) => {
        if (amount > topVendor.amount) topVendor = { name, amount };
      });

      setMetrics({
        ...stats,
        net: stats.income - stats.expenses,
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
      console.error('[Phase 4] Dashboard fetch error:', err);
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
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Calculating financial metrics...</p>
      </div>
    );
  }

  const hasTransactions = metrics.count > 0;
  const hasIncome = metrics.income > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Financial Overview</h1>
          <p className="text-muted-foreground">Real-time intelligence for <span className="text-foreground font-semibold">{activeClient.name}</span>.</p>
        </div>
        <div className="flex gap-3">
          <button 
            disabled 
            className="px-4 py-2 bg-muted text-muted-foreground rounded-xl text-sm font-semibold flex items-center gap-2 cursor-not-allowed opacity-60"
          >
            <Download className="w-4 h-4" /> Download Report
            <span className="text-[10px] font-black uppercase tracking-tighter bg-background px-1.5 py-0.5 rounded ml-1">Soon</span>
          </button>
          <button 
            disabled
            className="px-4 py-2 bg-primary/20 text-primary-foreground/50 rounded-xl text-sm font-bold flex items-center gap-2 cursor-not-allowed border border-primary/10"
          >
            <Plus className="w-4 h-4" /> Add Transaction
            <Lock className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Revenue" 
          value={hasTransactions ? formatCurrency(metrics.income) : '—'} 
          description={hasTransactions ? (hasIncome ? "From customer payments" : "No income detected") : ""}
          icon={<TrendingUp className={`w-5 h-5 ${hasIncome ? 'text-success' : 'text-muted-foreground'}`} />} 
        />
        <MetricCard 
          title="Total Expenses" 
          value={hasTransactions ? formatCurrency(metrics.expenses) : '—'} 
          description={hasTransactions ? "From imported transactions" : ""}
          icon={<TrendingDown className={`w-5 h-5 ${metrics.expenses > 0 ? 'text-risk' : 'text-muted-foreground'}`} />} 
        />
        <MetricCard 
          title="Net Cash Movement" 
          value={hasTransactions ? formatCurrency(metrics.net) : '—'} 
          description={hasTransactions ? (metrics.net >= 0 ? "Income exceeds expenses" : "Expenses exceed income") : "No data yet"}
          icon={<DollarSign className={`w-5 h-5 ${hasTransactions ? (metrics.net >= 0 ? 'text-success' : 'text-risk') : 'text-muted-foreground'}`} />} 
        />
        <MetricCard 
          title="Transactions" 
          value={hasTransactions ? metrics.count.toString() : '—'} 
          description={hasTransactions ? "Imported transactions" : ""} 
          icon={<FileText className="w-5 h-5 text-primary" />} 
        />
      </div>

      {!hasTransactions ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-card border rounded-2xl p-12 flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-2">
              <FileText className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold">No financial data yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Upload and import a finance file to activate your dashboard.
            </p>
            <button 
              onClick={() => window.location.href = '/files'}
              className="mt-4 px-6 py-2.5 bg-foreground text-background rounded-xl font-bold hover:opacity-90 transition-all"
            >
              Upload & Import File
            </button>
          </div>

          <div className="bg-card border rounded-2xl p-6 space-y-6">
            <h3 className="font-bold text-lg">Transaction Insights</h3>
            <div className="p-8 text-center bg-muted/20 rounded-xl border border-dashed">
              <Zap className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Insights will appear after more transactions are imported.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="font-bold">Recent Transactions</h3>
                <button 
                  onClick={() => window.location.href = '/transactions'}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="divide-y divide-border/50">
                {recentTransactions.map((tx) => {
                  const isExpense = ['expense', 'vendor_payment', 'subscription'].includes(tx.type);
                  const isIncome = tx.type === 'income';
                  
                  return (
                    <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isExpense ? 'bg-risk/10 text-risk' : isIncome ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                          {isExpense ? <ArrowUpRight className="w-5 h-5" /> : isIncome ? <ArrowDownLeft className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold truncate max-w-[200px] md:max-w-md">{tx.description}</div>
                          <div className={`text-[10px] font-black tracking-widest uppercase ${isExpense ? 'text-risk' : isIncome ? 'text-success' : 'text-muted-foreground'}`}>
                            {tx.type.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-black ${isExpense ? 'text-risk' : isIncome ? 'text-success' : 'text-foreground'}`}>
                          {isExpense ? '-' : isIncome ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{new Date(tx.transaction_date).toLocaleDateString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-6 space-y-6">
            <h3 className="font-bold text-lg">Transaction Insights</h3>
            
            {metrics.topVendor.amount > 0 ? (
              <div className="space-y-6">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Top Expense Source</p>
                  <p className="text-lg font-black text-foreground">{metrics.topVendor.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total spend: <span className="font-bold text-foreground">{formatCurrency(metrics.topVendor.amount)}</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Health Metrics</p>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{metrics.unknownCount} Unknown types</span>
                        <button 
                          onClick={() => window.location.href = '/transactions'}
                          className="text-[10px] font-black text-primary hover:underline"
                        >
                          FIX
                        </button>
                      </div>
                      {!hasIncome && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-warning">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Expense-only file detected
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-muted/20 rounded-xl border border-dashed">
                <Zap className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Insights will appear after more transactions are imported.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
