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
  Clock,
  Download,
  Info,
  Calendar,
  X
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAuth } from '../components/auth/AuthProvider';
import { useToast } from '../hooks/useToast';
import EmptyState from '../components/ui/EmptyState';
import MetricCard from '../components/ui/MetricCard';
import { supabase } from '../lib/supabase';
import aeLogo from '../assets/kaeo-ae-logo.png';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

interface ChartDataPoint {
  date: string;
  inflow: number;
  outflow: number;
  rawDate: string;
}

const Dashboard: React.FC = () => {
  const { activeClient } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
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
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    if (activeClient) {
      fetchDashboardData();
    }
  }, [activeClient]);

  const fetchDashboardData = async () => {
    if (!activeClient) return;
    setLoading(true);
    try {
      // Fetch transactions with transaction_date for charting
      const { data: allTransactions, error: metricsErr } = await supabase
        .from('transactions')
        .select('amount, type, description, transaction_date')
        .eq('client_id', activeClient.id);

      if (metricsErr) throw metricsErr;

      const vendors: Record<string, number> = {};
      const dailyMap: Record<string, { inflow: number; outflow: number; rawDate: string }> = {};

      const stats = (allTransactions || []).reduce((acc, tx) => {
        const amt = Math.abs(Number(tx.amount));
        
        // Date-series aggregation for Cash Flow chart
        if (tx.transaction_date) {
          const rawDateStr = tx.transaction_date.split('T')[0];
          const displayDate = new Date(tx.transaction_date).toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric' 
          });
          
          if (!dailyMap[displayDate]) {
            dailyMap[displayDate] = { inflow: 0, outflow: 0, rawDate: rawDateStr };
          }
          
          if (tx.type === 'income' || tx.type === 'refund') {
            dailyMap[displayDate].inflow += amt;
          } else if (['expense', 'vendor_payment', 'subscription'].includes(tx.type)) {
            dailyMap[displayDate].outflow += amt;
          }
        }
        
        if (tx.type === 'income') {
          acc.income += amt;
          acc.incomeCount++;
        } 
        else if (['expense', 'vendor_payment', 'subscription'].includes(tx.type)) {
          acc.expenses += amt;
          acc.expenseCount++;
          if (tx.type === 'vendor_payment') acc.vendorPaymentCount++;
          
          // Track vendor - prioritized heuristic for expenses only
          const name = tx.description
            .replace(/vendor payment|payment to|paid to|google ads|meta ads|facebook ads/gi, '')
            .trim()
            .split(' ')
            .filter((w: string) => w.length > 2 && !/\d/.test(w))[0] || tx.description.split(' ')[0];
          
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

      // Compute Top Vendor
      let topVendor = { name: '', amount: 0 };
      Object.entries(vendors).forEach(([name, amount]) => {
        if (amount > topVendor.amount) topVendor = { name, amount };
      });

      setMetrics({
        ...stats,
        net: stats.income + stats.refunds - stats.expenses,
        topVendor
      });

      // Prepare Recharts sorted daily series data
      const sortedDailySeries = Object.entries(dailyMap)
        .map(([date, data]) => ({
          date,
          inflow: data.inflow,
          outflow: data.outflow,
          rawDate: data.rawDate
        }))
        .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())
        .slice(-15); // Show last 15 days of activity

      setChartData(sortedDailySeries);

      // Fetch recent 5 ledger entries
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
      toast(err.message || 'Failed to load dashboard metrics', 'error');
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

  const handleDownloadReport = () => {
    toast('Navigating to reports folder', 'info');
    window.location.href = '/reports';
  };

  const handleAddTransactionClick = () => {
    setIsAddTxOpen(true);
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
        <Loader2 className="w-8 h-8 animate-spin text-primary animate-pulse" />
        <p className="text-sm text-muted-foreground animate-pulse font-medium">Aggregating ledger data...</p>
      </div>
    );
  }

  const hasTransactions = metrics.count > 0;
  const isExpenseOnly = hasTransactions && metrics.incomeCount === 0;
  const isMixed = hasTransactions && metrics.incomeCount > 0 && metrics.expenseCount > 0;

  // Compute decorative ring percentage
  const totalReportedRows = metrics.incomeCount + metrics.expenseCount + metrics.unknownCount + metrics.refundCount;
  const incomePercentage = totalReportedRows > 0 ? Math.round((metrics.incomeCount / totalReportedRows) * 100) : 0;

  // Custom tooltips for Recharts
  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="premium-glass p-3 rounded-xl border border-teal-500/20 text-xs shadow-2xl">
          <p className="font-bold text-muted-foreground mb-1">{payload[0].payload.date}</p>
          <p className="text-emerald-400 font-semibold">Inflow: {formatCurrency(payload[0].value)}</p>
          {payload[1] && <p className="text-rose-400 font-semibold">Outflow: {formatCurrency(payload[1].value)}</p>}
        </div>
      );
    }
    return null;
  };

  const firstName = user?.user_metadata?.full_name 
    ? user.user_metadata.full_name.split(' ')[0] 
    : user?.email?.split('@')[0] || 'Guest';

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Good morning, {firstName}
            </h1>
            <div className="px-2 py-0.5 bg-teal-500/10 text-teal-400 text-[10px] font-black rounded border border-teal-500/20 uppercase tracking-widest shadow-sm shadow-teal-500/5">Live OS</div>
          </div>
          <p className="text-xs text-muted-foreground">Strategic workspace overview for <span className="text-foreground font-semibold">{activeClient.name}</span></p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleDownloadReport}
            className="px-4 py-2.5 bg-muted/40 text-foreground hover:bg-muted/80 rounded-xl text-xs font-semibold flex items-center gap-2 border border-border/50 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Download Report
          </button>
          <button 
            onClick={handleAddTransactionClick}
            className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-primary/10"
          >
            <Plus className="w-3.5 h-3.5" /> Add Transaction
          </button>
        </div>
      </div>

      {/* Metric Cards Layout */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${metrics.refunds > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
        <MetricCard 
          title="Total Revenue" 
          value={hasTransactions ? formatCurrency(metrics.income) : '—'} 
          description={hasTransactions ? (metrics.incomeCount > 0 ? "From customer payments" : "No income rows detected") : "No data yet"}
          icon={<TrendingUp className={`w-4 h-4 ${metrics.incomeCount > 0 ? 'text-teal-400' : 'text-muted-foreground'}`} />} 
          className="premium-glass premium-glass-hover"
        />
        {metrics.refunds > 0 && (
          <MetricCard 
            title="Refunds & Recoveries" 
            value={hasTransactions ? formatCurrency(metrics.refunds) : '—'} 
            description={hasTransactions ? `From ${metrics.refundCount} refund/reversal entries` : ""}
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} 
            className="premium-glass premium-glass-hover"
          />
        )}
        <MetricCard 
          title="Total Expenses" 
          value={hasTransactions ? formatCurrency(metrics.expenses) : '—'} 
          description={hasTransactions ? "From imported expense rows" : ""}
          icon={<TrendingDown className={`w-4 h-4 ${metrics.expenseCount > 0 ? 'text-rose-400/80' : 'text-muted-foreground'}`} />} 
          className="premium-glass premium-glass-hover"
        />
        <MetricCard 
          title="Net Cash Movement" 
          value={hasTransactions ? formatCurrency(metrics.net) : '—'} 
          description={hasTransactions ? (metrics.net > 0 ? "Net cash positive" : metrics.net < 0 ? "Net cash negative" : "Balanced") : "No data yet"}
          icon={<DollarSign className={`w-4 h-4 ${hasTransactions ? (metrics.net >= 0 ? 'text-teal-400' : 'text-rose-400/85') : 'text-muted-foreground'}`} />} 
          className="premium-glass premium-glass-hover"
        />
        <MetricCard 
          title="Transactions" 
          value={hasTransactions ? metrics.count.toString() : '—'} 
          description={hasTransactions ? "Imported transactions" : ""} 
          icon={<FileText className="w-4 h-4 text-teal-400" />} 
          className="premium-glass premium-glass-hover"
        />
      </div>

      {!hasTransactions ? (
        <div className="premium-glass border border-dashed border-border/40 rounded-3xl p-20 flex flex-col items-center justify-center text-center space-y-5 shadow-xl">
          <div className="w-16 h-16 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20 shadow-inner">
            <FileText className="w-8 h-8 text-teal-400/40" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold tracking-tight">No financial ledger uploaded</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Upload and import a transaction sheet to activate AI CFO insights.
            </p>
          </div>
          <button 
            onClick={() => window.location.href = '/files'}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-all shadow-xl shadow-primary/20 cursor-pointer"
          >
            Upload Finance File
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (Wide) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Real-data Cash Flow Overview Chart */}
            {chartData.length > 0 && (
              <div className="premium-glass rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-4">
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cash Flow Timeline</h3>
                    <h4 className="text-sm font-semibold text-foreground mt-0.5">Inflow vs Outflow analysis</h4>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold">
                    <span className="flex items-center gap-1.5 text-teal-400">
                      <span className="w-2 h-2 rounded-full bg-teal-400" /> Revenue Inflow
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <span className="w-2 h-2 rounded-full bg-rose-400" /> Expense Outflow
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-stop-inflow)" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="var(--chart-stop-inflow)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-stop-outflow)" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="var(--chart-stop-outflow)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis 
                        dataKey="date" 
                        stroke="var(--chart-label)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis 
                        stroke="var(--chart-label)" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => `${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                      />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="inflow" 
                        stroke="var(--chart-stroke-inflow)" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#inflowGrad)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="outflow" 
                        stroke="var(--chart-stroke-outflow)" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#outflowGrad)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* File Interpretation Card */}
            <div className="premium-glass rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl shrink-0 shadow-sm shadow-teal-500/5">
                <img src={aeLogo} alt="Ligature logo" className="w-7 h-7 object-contain" />
              </div>
              <div className="space-y-4 flex-1">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-teal-400">File Interpretation</h4>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {isExpenseOnly ? (
                      <>Kaeo detected this as an <span className="text-foreground font-bold">expense-only ledger</span>. To run cash flow comparisons, ingest an invoice register or a bank statement containing deposit logs.</>
                    ) : isMixed ? (
                      <>Kaeo detected a <span className="text-foreground font-bold">mixed income & expense register</span>. Multi-dimensional workspace categorizations are fully synchronized.</>
                    ) : (
                      <>Kaeo categorized your ledger. You can inspect composition details and make adjustments below.</>
                    )}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-border/20 pt-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Income rows</span>
                    <span className="text-sm font-bold text-teal-400 mt-0.5">{metrics.incomeCount}</span>
                  </div>
                  {metrics.refundCount > 0 && (
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Refund rows</span>
                      <span className="text-sm font-bold text-teal-400 mt-0.5">{metrics.refundCount}</span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Expense rows</span>
                    <span className="text-sm font-bold text-foreground mt-0.5">{metrics.expenseCount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Unknown rows</span>
                    <span className="text-sm font-bold text-muted-foreground mt-0.5">{metrics.unknownCount}</span>
                  </div>
                </div>
              </div>

              {/* Decorative SVG Composition Ring */}
              <div className="hidden sm:flex items-center justify-center shrink-0 p-1 bg-white/5 border border-border/20 rounded-full">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-white/5"
                      strokeWidth="2.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-teal-400"
                      strokeWidth="2.5"
                      strokeDasharray={`${incomePercentage}, 100`}
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-bold">{incomePercentage}%</span>
                    <span className="text-[7px] font-bold text-muted-foreground uppercase leading-none">Inflow</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Transactions List */}
            <div className="premium-glass rounded-2xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-teal-400" />
                  Recent Ledger Entries
                </h3>
                <button 
                  onClick={() => window.location.href = '/transactions'}
                  className="text-[10px] font-black text-teal-400 hover:text-teal-300 uppercase tracking-widest cursor-pointer"
                >
                  View Full Ledger
                </button>
              </div>
              <div className="divide-y divide-border/20">
                {recentTransactions.map((tx) => {
                  const isExpense = ['expense', 'vendor_payment', 'subscription'].includes(tx.type);
                  const isIncome = tx.type === 'income';
                  
                  return (
                    <div key={tx.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-border/40 ${isExpense ? 'bg-muted/30 text-muted-foreground' : isIncome ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-muted/10 text-muted-foreground'}`}>
                          {isExpense ? <ArrowUpRight className="w-3.5 h-3.5" /> : isIncome ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate text-foreground group-hover:text-primary transition-colors">{tx.description}</div>
                          <div className="text-[8px] font-black tracking-widest uppercase text-muted-foreground/60 mt-0.5">
                            {tx.type.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-xs font-extrabold ${isExpense ? 'text-foreground' : isIncome ? 'text-teal-400' : 'text-foreground'}`}>
                          {isExpense ? '-' : isIncome ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                        </div>
                        <div className="text-[9px] text-muted-foreground mt-0.5">{new Date(tx.transaction_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (Sidebar Insights) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="premium-glass rounded-2xl p-6 shadow-xl space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-teal-400" />
                Strategic Insights
              </h3>
              
              <div className="space-y-4">
                {metrics.topVendor.amount > 0 && (
                  <div className="p-4 bg-white/5 rounded-2xl border border-border/30">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">Primary Expense Destination</p>
                    <p className="text-base font-bold text-foreground leading-tight mb-1 truncate">{metrics.topVendor.name}</p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      Cumulative spend: <span className="font-extrabold text-foreground">{formatCurrency(metrics.topVendor.amount)}</span>
                    </p>
                  </div>
                )}

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-border/20">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      <span className="text-[11px] font-bold">Import Composition</span>
                    </div>
                    <span className="text-[10px] font-black text-muted-foreground">{metrics.count} Rows</span>
                  </div>

                  {isExpenseOnly ? (
                    <div className="flex items-center gap-2 p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-[11px] font-bold text-rose-300">Expense-only file detected</span>
                    </div>
                  ) : isMixed ? (
                    <div className="flex items-center gap-2 p-3 bg-teal-500/5 rounded-xl border border-teal-500/10">
                      <TrendingUp className="w-3.5 h-3.5 text-teal-400" />
                      <span className="text-[11px] font-bold text-teal-300">Mixed income and expenses</span>
                    </div>
                  ) : null}

                  {metrics.unknownCount > 0 && (
                    <div className="flex items-center justify-between p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[11px] font-bold text-amber-300">{metrics.unknownCount} Unknown entries</span>
                      </div>
                      <button 
                        onClick={() => window.location.href = '/transactions'}
                        className="text-[9px] font-black text-amber-400 hover:underline uppercase cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Legend Card */}
            <div className="px-6 py-5 bg-white/5 rounded-2xl border border-border/20">
              <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-3">Intelligence Legend</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  Income: Verified revenue entries
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Expenses: Direct outflow entries
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                  Unknown: Uncategorized context
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Manual Transaction Modal */}
      {isAddTxOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsAddTxOpen(false)}
        >
          <div 
            className="w-full max-w-md premium-floating-panel rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsAddTxOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="w-10 h-10 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20 mb-4">
              <Plus className="w-5 h-5 text-teal-400" />
            </div>
            
            <h3 className="text-sm font-bold text-foreground mb-1.5">Add Manual Transaction</h3>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Manual ledger entries are coming in Phase 13B. Currently, you can ingest financial datasets by uploading statement files directly in the Files Ingestion layer.
            </p>
            
            <div className="flex gap-2.5">
              <button 
                onClick={() => setIsAddTxOpen(false)} 
                className="flex-1 py-2.5 bg-muted/40 hover:bg-muted/60 text-foreground font-semibold rounded-xl text-xs transition-all cursor-pointer border border-border/40"
              >
                Dismiss
              </button>
              <button 
                onClick={() => { setIsAddTxOpen(false); window.location.href = '/files'; }}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:opacity-95 transition-all cursor-pointer shadow-lg shadow-primary/10"
              >
                Go to File Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
