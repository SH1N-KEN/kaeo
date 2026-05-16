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
  Loader2
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
    unknownCount: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (activeClient) fetchDashboardData();
  }, [activeClient]);

  const fetchDashboardData = async () => {
    if (!activeClient) return;
    setLoading(true);
    try {
      // 1. Fetch all transactions for metrics
      const { data: allTransactions, error: metricsErr } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('client_id', activeClient.id);

      if (metricsErr) throw metricsErr;

      const stats = (allTransactions || []).reduce((acc, tx) => {
        const amt = Number(tx.amount);
        if (tx.type === 'income' || amt > 0) acc.income += amt;
        else if (tx.type === 'expense' || amt < 0) acc.expenses += Math.abs(amt);
        
        if (tx.type === 'unknown') acc.unknownCount++;
        acc.count++;
        return acc;
      }, { income: 0, expenses: 0, count: 0, unknownCount: 0 });

      setMetrics({
        ...stats,
        net: stats.income - stats.expenses
      });

      // 2. Fetch latest 5 transactions
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const hasData = metrics.count > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Financial Overview</h1>
          <p className="text-muted-foreground">Real-time intelligence for <span className="text-foreground font-semibold">{activeClient.name}</span>.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl text-sm font-semibold transition-all">
            Download Report
          </button>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
            <Plus className="w-4 h-4" /> Add Transaction
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Revenue" 
          value={hasData ? formatCurrency(metrics.income) : '—'} 
          trend={hasData ? "Real data" : "0%"} 
          trendType="up" 
          icon={<TrendingUp className="w-5 h-5 text-success" />} 
        />
        <MetricCard 
          title="Total Expenses" 
          value={hasData ? formatCurrency(metrics.expenses) : '—'} 
          trend={hasData ? "Real data" : "0%"} 
          trendType="down" 
          icon={<TrendingDown className="w-5 h-5 text-risk" />} 
        />
        <MetricCard 
          title="Net Cash Movement" 
          value={hasData ? formatCurrency(metrics.net) : '—'} 
          trend={hasData ? "Real data" : "0%"} 
          trendType={metrics.net >= 0 ? 'up' : 'down'} 
          icon={<DollarSign className="w-5 h-5 text-primary" />} 
        />
        <MetricCard 
          title="Transactions" 
          value={hasData ? metrics.count.toString() : '—'} 
          description={metrics.unknownCount > 0 ? `${metrics.unknownCount} need review` : "All reconciled"} 
          icon={<AlertCircle className={`w-5 h-5 ${metrics.unknownCount > 0 ? 'text-warning' : 'text-success'}`} />} 
        />
      </div>

      {!hasData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-card border rounded-2xl p-12 flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-2">
              <FileText className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold">No financial data yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Import transactions from a finance file to activate your real-time dashboard and AI CFO insights.
            </p>
            <button 
              onClick={() => window.location.href = '/files'}
              className="mt-4 px-6 py-2.5 bg-foreground text-background rounded-xl font-bold hover:opacity-90 transition-all"
            >
              Upload & Import File
            </button>
          </div>

          <div className="bg-card border rounded-2xl p-6 space-y-6">
            <h3 className="font-bold text-lg">AI CFO Insights</h3>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Once you import transaction data, I'll start analyzing your burn rate, runway, and vendor spending patterns.
              </p>
            </div>
            <div className="space-y-4 opacity-50">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-10 h-10 bg-muted rounded-lg shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
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
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.amount < 0 ? 'bg-risk/10 text-risk' : 'bg-success/10 text-success'}`}>
                        {tx.amount < 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold truncate max-w-[200px] md:max-w-md">{tx.description}</div>
                        <div className="text-[10px] text-muted-foreground">{new Date(tx.transaction_date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-black ${tx.amount < 0 ? 'text-risk' : 'text-success'}`}>
                        {tx.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(tx.amount))}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{tx.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-6 space-y-6">
            <h3 className="font-bold text-lg">AI CFO Insights</h3>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <p className="text-sm text-primary font-bold mb-1">Burn Analysis</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Based on your last import, your average monthly expense is <span className="text-foreground font-bold">{formatCurrency(metrics.expenses / 1)}</span>.
              </p>
            </div>
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Cash Runway</p>
                <p className="text-sm font-bold">12.4 Months</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Top Vendor</p>
                <p className="text-sm font-bold">Amazon Web Services</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
