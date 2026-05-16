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
  Clock
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
      // 1. Fetch all transactions for metrics
      const { data: allTransactions, error: metricsErr } = await supabase
        .from('transactions')
        .select('amount, type, description')
        .eq('client_id', activeClient.id);

      if (metricsErr) throw metricsErr;

      const vendors: Record<string, number> = {};

      const stats = (allTransactions || []).reduce((acc, tx) => {
        const amt = Math.abs(Number(tx.amount));
        
        // Income total = sum amount where type = income
        if (tx.type === 'income') {
          acc.income += amt;
        } 
        // Expenses total = sum amount where type in expense/vendor_payment/subscription
        else if (['expense', 'vendor_payment', 'subscription'].includes(tx.type)) {
          acc.expenses += amt;
          
          // Track vendor
          const vendorName = tx.description.split(' ')[0]; // Basic heuristic
          vendors[vendorName] = (vendors[vendorName] || 0) + amt;
        }
        // Refunds (assuming outgoing for now, or handle based on context)
        else if (tx.type === 'refund') {
          acc.expenses -= amt; // Refund reduces expense if it's a refund received
        }
        
        if (tx.type === 'unknown') acc.unknownCount++;
        acc.count++;
        return acc;
      }, { income: 0, expenses: 0, count: 0, unknownCount: 0 });

      // Find top vendor
      let topVendor = { name: '', amount: 0 };
      Object.entries(vendors).forEach(([name, amount]) => {
        if (amount > topVendor.amount) topVendor = { name, amount };
      });

      setMetrics({
        ...stats,
        net: stats.income - stats.expenses,
        topVendor
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
          value={hasData && metrics.income > 0 ? formatCurrency(metrics.income) : '—'} 
          trend={hasData ? "Real data" : "0%"} 
          trendType="up" 
          icon={<TrendingUp className="w-5 h-5 text-success" />} 
        />
        <MetricCard 
          title="Total Expenses" 
          value={hasData && metrics.expenses > 0 ? formatCurrency(metrics.expenses) : '—'} 
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
            <h3 className="font-bold text-lg">Kaeo Insights</h3>
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
                {recentTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${['expense', 'vendor_payment', 'subscription'].includes(tx.type) ? 'bg-risk/10 text-risk' : tx.type === 'income' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {['expense', 'vendor_payment', 'subscription'].includes(tx.type) ? <ArrowUpRight className="w-5 h-5" /> : tx.type === 'income' ? <ArrowDownLeft className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold truncate max-w-[200px] md:max-w-md">{tx.description}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{tx.type.replace('_', ' ')}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-black ${['expense', 'vendor_payment', 'subscription'].includes(tx.type) ? 'text-risk' : tx.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                        {['expense', 'vendor_payment', 'subscription'].includes(tx.type) ? '-' : tx.type === 'income' ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{new Date(tx.transaction_date).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-6 space-y-6">
            <h3 className="font-bold text-lg">Kaeo Insights</h3>
            
            {metrics.topVendor.amount > 0 ? (
              <div className="space-y-6">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Top Vendor</p>
                  <p className="text-lg font-black text-foreground">{metrics.topVendor.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total spend: <span className="font-bold">{formatCurrency(metrics.topVendor.amount)}</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Data Quality</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{metrics.unknownCount} Unknown types</span>
                      <button 
                        onClick={() => window.location.href = '/transactions'}
                        className="text-[10px] font-black text-primary hover:underline"
                      >
                        RECONCILE
                      </button>
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
