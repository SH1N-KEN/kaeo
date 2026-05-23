import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
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
  X,
  ShieldAlert, 
  CheckCircle2, 
  Layers,
  Sparkles
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAuth } from '../components/auth/AuthProvider';
import { useToast } from '../hooks/useToast';
import EmptyState from '../components/ui/EmptyState';
import { supabase } from '../lib/supabase';
import aeLogo from '../assets/kaeo-ae-logo.png';
import { calculateMonthEndReadiness, type ReadinessResult } from '../lib/readinessEngine';
import { getDisplayCategory, inferTransactionCategory, ALL_CATEGORIES } from '../lib/categoryEngine';
import { analyzeRisksForClient } from '../lib/riskEngine';
import { getSpendRules } from '../lib/spendRulesEngine';
import { getTimeBasedGreeting } from '../lib/greeting';
import { AIReviewQueueModal } from '../components/ai/AIReviewQueueModal';
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
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [manualTxDate, setManualTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTxDesc, setManualTxDesc] = useState('');
  const [manualTxAmt, setManualTxAmt] = useState('');
  const [manualTxType, setManualTxType] = useState<'income' | 'refund' | 'expense' | 'unknown'>('expense');
  const [manualTxCat, setManualTxCat] = useState('Uncategorized');
  const [manualTxVendor, setManualTxVendor] = useState('');
  const [manualTxNote, setManualTxNote] = useState('');
  const [manualTxSaving, setManualTxSaving] = useState(false);
  const [isAIQueueOpen, setIsAIQueueOpen] = useState(false);
  const [sugMetrics, setSugMetrics] = useState({
    pending: 0,
    safe: 0,
    high: 0
  });

  // Smart category suggestion hook
  useEffect(() => {
    if (manualTxDesc) {
      const suggested = inferTransactionCategory(manualTxDesc, manualTxVendor, manualTxType);
      if (suggested && suggested !== 'Uncategorized') {
        setManualTxCat(suggested);
      }
    }
  }, [manualTxDesc, manualTxVendor, manualTxType]);

  const handleSaveManualTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient) return;
    setManualTxSaving(true);
    try {
      const { data: userResponse } = await supabase.auth.getUser();
      const user = userResponse?.user;

      const amt = parseFloat(manualTxAmt);
      if (isNaN(amt) || amt <= 0) {
        throw new Error('Please enter a valid positive number for the amount.');
      }
      
      const finalAmt = (manualTxType === 'expense' || manualTxType === 'unknown') ? -Math.abs(amt) : Math.abs(amt);

      const { error } = await supabase
        .from('transactions')
        .insert({
          organization_id: activeClient.organization_id,
          client_id: activeClient.id,
          transaction_date: manualTxDate || new Date().toISOString().split('T')[0],
          description: manualTxDesc,
          amount: finalAmt,
          type: manualTxType,
          category: manualTxCat,
          counterparty_name: manualTxVendor || null,
          source: 'manual',
          review_status: 'reviewed',
          review_note: manualTxNote || null,
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString()
        });

      if (error) throw error;

      toast('Manual transaction added successfully', 'success');
      setIsAddTxOpen(false);
      
      setManualTxDate(new Date().toISOString().split('T')[0]);
      setManualTxDesc('');
      setManualTxAmt('');
      setManualTxType('expense');
      setManualTxCat('Uncategorized');
      setManualTxVendor('');
      setManualTxNote('');

      fetchDashboardData();

      await analyzeRisksForClient(activeClient.organization_id, activeClient.id);
    } catch (err: any) {
      toast(err.message || 'Failed to add transaction', 'error');
    } finally {
      setManualTxSaving(false);
    }
  };
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
    topVendor: { name: '', amount: 0 },
    uncategorizedCount: 0,
    unreviewedCount: 0,
    openRisksCount: 0,
    duplicateExposure: 0,
    uniqueVendorsCount: 0,
    matchedInvoicesCount: 0,
    totalInvoicesCount: 0,
    overdueInvoicesCount: 0,
    highValueCount: 0,
    recurringCount: 0,
    rulesActiveCount: 0,
    uploadsCount: 0,
    suggestionsCount: 0
  });
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
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
      // Fetch transactions
      const { data: allTransactions, error: metricsErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('client_id', activeClient.id);

      if (metricsErr) throw metricsErr;
      
      // Fetch open risks
      const { data: openRisksData } = await supabase
        .from('risk_events')
        .select('*')
        .eq('client_id', activeClient.id)
        .eq('status', 'open');
        
      const readinessResult = calculateMonthEndReadiness(allTransactions || [], openRisksData || []);
      setReadiness(readinessResult);

      const vendors: Record<string, number> = {};
      const dailyMap: Record<string, { inflow: number; outflow: number; rawDate: string }> = {};

      const stats = (allTransactions || []).reduce((acc, tx) => {
        const amt = Math.abs(Number(tx.amount));
        
        const cat = getDisplayCategory(tx);
        if (cat === 'Uncategorized') acc.uncategorizedCount++;
        
        if (!tx.review_status || tx.review_status === 'new' || tx.review_status === 'needs_review') {
          acc.unreviewedCount++;
        }
        
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
        failedCount: 0,
        uncategorizedCount: 0,
        unreviewedCount: 0
      });

      let duplicateExposure = 0;
      (openRisksData || []).forEach(r => {
        if (r.risk_type.includes('duplicate')) {
          duplicateExposure += Number(r.amount_at_risk);
        }
      });

      // Compute Top Vendor
      let topVendor = { name: '', amount: 0 };
      Object.entries(vendors).forEach(([name, amount]) => {
        if (amount > topVendor.amount) topVendor = { name, amount };
      });

      // Extra data for secondary grid
      let totalInvoicesCount = 0;
      let matchedInvoicesCount = 0;
      let overdueInvoicesCount = 0;
      try {
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('id, status, due_date')
          .eq('client_id', activeClient.id);
        if (invoicesData) {
          totalInvoicesCount = invoicesData.length;
          matchedInvoicesCount = invoicesData.filter(inv => inv.status === 'paid').length;
          
          const today = new Date();
          overdueInvoicesCount = invoicesData.filter(inv => {
            if (inv.status === 'overdue') return true;
            if (inv.status === 'unpaid' && inv.due_date && new Date(inv.due_date) < today) return true;
            return false;
          }).length;
        }
      } catch (e) {
        console.error('Error fetching invoices for dashboard:', e);
      }

      let uploadsCount = 0;
      try {
        const { data: uploadsData } = await supabase
          .from('uploaded_files')
          .select('id')
          .eq('client_id', activeClient.id);
        if (uploadsData) {
          uploadsCount = uploadsData.length;
        }
      } catch (e) {
        console.error('Error fetching uploaded files count:', e);
      }

      let rulesActiveCount = 0;
      try {
        const activeRules = await getSpendRules(activeClient.organization_id);
        rulesActiveCount = activeRules.filter(r => r.enabled).length;
      } catch (e) {
        console.error('Error fetching active rules count:', e);
      }

      const highValueCount = (allTransactions || []).filter(tx => 
        ['expense', 'vendor_payment', 'subscription'].includes(tx.type) && Math.abs(Number(tx.amount)) >= 50000
      ).length;

      const recurringCount = (allTransactions || []).filter(tx => tx.type === 'subscription').length;

      let pendingSugsCount = 0;
      let safeSugsCount = 0;
      let highSugsCount = 0;
      try {
        const { data: sugs } = await supabase
          .from('ai_review_suggestions')
          .select('priority, requires_approval')
          .eq('client_id', activeClient.id)
          .eq('status', 'pending');
        
        if (sugs) {
          pendingSugsCount = sugs.length;
          safeSugsCount = sugs.filter(s => !s.requires_approval).length;
          highSugsCount = sugs.filter(s => s.priority === 'high').length;
        }
      } catch (e) {
        console.error('Error fetching suggestions for dashboard:', e);
      }

      setSugMetrics({
        pending: pendingSugsCount,
        safe: safeSugsCount,
        high: highSugsCount
      });

      const suggestionsCount = pendingSugsCount;

      setMetrics({
        ...stats,
        net: stats.income + stats.refunds - stats.expenses,
        topVendor,
        openRisksCount: openRisksData?.length || 0,
        duplicateExposure,
        uniqueVendorsCount: Object.keys(vendors).length,
        matchedInvoicesCount,
        totalInvoicesCount,
        overdueInvoicesCount,
        highValueCount,
        recurringCount,
        rulesActiveCount,
        uploadsCount,
        suggestionsCount
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
    navigate('/reports');
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
        <div className="premium-glass p-3 rounded-xl border border-border/30 text-xs shadow-2xl">
          <p className="font-bold text-muted-foreground mb-1">{payload[0].payload.date}</p>
          <p className="text-success font-semibold">Inflow: {formatCurrency(payload[0].value)}</p>
          {payload[1] && <p className="text-risk font-semibold">Outflow: {formatCurrency(payload[1].value)}</p>}
        </div>
      );
    }
    return null;
  };

  const firstName = user?.user_metadata?.full_name 
    ? user.user_metadata.full_name.split(' ')[0] 
    : user?.email?.split('@')[0] || 'Guest';

  const topReasonText = (() => {
    if (metrics.unreviewedCount > 0) {
      return `${metrics.unreviewedCount} transactions still need review`;
    }
    if (metrics.uncategorizedCount > 0) {
      return `${metrics.uncategorizedCount} transactions are uncategorized`;
    }
    if (metrics.openRisksCount > 0) {
      return `${metrics.openRisksCount} unresolved risks require attention`;
    }
    if (readiness?.deductions && readiness.deductions.length > 0) {
      const topDeduction = [...readiness.deductions].sort((a, b) => b.amount - a.amount)[0];
      return topDeduction.reason;
    }
    return "All close preparation checks passed";
  })();

  const MiniCard = ({ 
    title, 
    value, 
    subValue,
    ctaText, 
    onClick, 
    accentColor 
  }: { 
    title: string; 
    value: string | number; 
    subValue?: string;
    ctaText?: string; 
    onClick?: () => void; 
    accentColor?: 'green' | 'red' | 'amber' | 'teal' | 'neutral';
  }) => {
    let valueClass = 'text-foreground';
    let subValueClass = 'text-muted-foreground';
    
    if (accentColor === 'green') {
      valueClass = 'text-success';
    } else if (accentColor === 'red') {
      valueClass = 'text-risk';
    } else if (accentColor === 'amber') {
      valueClass = 'text-amber-500';
    } else if (accentColor === 'teal') {
      valueClass = 'text-teal-400';
    }

    return (
      <div 
        onClick={onClick}
        className="premium-glass rounded-xl p-4 border border-border/20 hover:border-border/35 hover:bg-white/5 transition-all duration-200 select-none cursor-pointer flex flex-col justify-between h-[110px] group"
      >
        <div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
            {title}
          </span>
          <div className={`text-xl font-extrabold truncate ${valueClass}`}>
            {value}
          </div>
          {subValue && (
            <div className={`text-[10px] truncate font-medium mt-0.5 ${subValueClass}`}>
              {subValue}
            </div>
          )}
        </div>
        {ctaText && (
          <span className="text-[9px] text-muted-foreground font-black group-hover:text-primary transition-colors uppercase tracking-widest block mt-1">
            {ctaText}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {getTimeBasedGreeting(firstName)}
            </h1>
            <div className="px-2 py-0.5 bg-teal-500/10 text-teal-400 text-[10px] font-black rounded border border-teal-500/20 uppercase tracking-widest shadow-sm shadow-teal-500/5">Live OS</div>
          </div>
          <p className="text-xs text-muted-foreground">Spend-control summary for <span className="text-foreground font-semibold">{activeClient.name}</span></p>
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

      {/* Primary Top Row Metrics (Main KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {/* Revenue */}
        <div 
          onClick={() => navigate('/transactions')}
          className="premium-glass p-5 rounded-2xl border border-border/20 hover:border-border/35 flex flex-col justify-between cursor-pointer group transition-all duration-200 h-[140px]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-success/5 flex items-center justify-center text-success transition-all duration-200">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-success">
              {hasTransactions ? formatCurrency(metrics.income) : '—'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-semibold leading-none">
              {hasTransactions ? `${metrics.incomeCount} inflows` : "No revenue data"}
            </p>
          </div>
        </div>

        {/* Refunds */}
        <div 
          onClick={() => navigate('/transactions')}
          className="premium-glass p-5 rounded-2xl border border-border/20 hover:border-border/35 flex flex-col justify-between cursor-pointer group transition-all duration-200 h-[140px]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Refunds</span>
            <div className="w-7 h-7 rounded-lg bg-teal-500/5 flex items-center justify-center text-teal-400 transition-all duration-200">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-teal-400">
              {hasTransactions && metrics.refunds > 0 ? formatCurrency(metrics.refunds) : '—'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-semibold leading-none">
              {hasTransactions && metrics.refunds > 0 ? `${metrics.refundCount} items` : "No refunds recorded"}
            </p>
          </div>
        </div>

        {/* Transactions */}
        <div 
          onClick={() => navigate('/transactions')}
          className="premium-glass p-5 rounded-2xl border border-border/20 hover:border-border/35 flex flex-col justify-between cursor-pointer group transition-all duration-200 h-[140px]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transactions</span>
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-foreground transition-all duration-200">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-foreground">
              {metrics.count}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-semibold leading-none">
              {hasTransactions ? "Total ledger rows" : "No transactions"}
            </p>
          </div>
        </div>

        {/* Uncategorized */}
        <div 
          onClick={() => navigate('/transactions?category=uncategorized')}
          className="premium-glass p-5 rounded-2xl border border-border/20 hover:border-border/35 flex flex-col justify-between cursor-pointer group transition-all duration-200 h-[140px]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Uncategorized</span>
            <div className="w-7 h-7 rounded-lg bg-warning/5 flex items-center justify-center text-warning transition-all duration-200">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${metrics.uncategorizedCount > 0 ? 'text-warning' : 'text-foreground'}`}>
              {metrics.uncategorizedCount}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-semibold leading-none">
              {metrics.uncategorizedCount > 0 ? "Pending categorization" : "All categorized"}
            </p>
          </div>
        </div>

        {/* Duplicate Exposure */}
        <div 
          onClick={() => navigate('/risk-inbox?type=duplicate_payment')}
          className="premium-glass p-5 rounded-2xl border border-border/20 hover:border-border/35 flex flex-col justify-between cursor-pointer group transition-all duration-200 h-[140px]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Duplicate Exposure</span>
            <div className="w-7 h-7 rounded-lg bg-risk/5 flex items-center justify-center text-risk transition-all duration-200">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${metrics.duplicateExposure > 0 ? 'text-risk' : 'text-foreground'}`}>
              {formatCurrency(metrics.duplicateExposure)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-semibold leading-none">
              {metrics.duplicateExposure > 0 ? "Duplicate spend exposure" : "No duplicates flagged"}
            </p>
          </div>
        </div>
      </div>

      {/* Control Row (Row B) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <MiniCard 
          title="Open Risks"
          value={metrics.openRisksCount}
          subValue={metrics.openRisksCount > 0 ? `${metrics.openRisksCount} risks flagged` : "No issues"}
          ctaText={metrics.openRisksCount > 0 ? "Resolve →" : "View →"}
          onClick={() => navigate('/risk-inbox')}
          accentColor={metrics.openRisksCount > 0 ? 'red' : 'green'}
        />
        <MiniCard 
          title="Needs Review"
          value={metrics.unreviewedCount}
          subValue={metrics.unreviewedCount > 0 ? "Pending transactions" : "No issues"}
          ctaText={metrics.unreviewedCount > 0 ? "Review →" : "View →"}
          onClick={() => navigate('/transactions?review=pending')}
          accentColor={metrics.unreviewedCount > 0 ? 'amber' : 'green'}
        />
        <MiniCard 
          title="Month-End Readiness"
          value={readiness?.score !== undefined ? `${readiness.score}%` : "Coming online"}
          subValue={
            !hasTransactions ? "Not ready" :
            metrics.unreviewedCount > 0 ? `Not ready · ${metrics.unreviewedCount} transactions still need review` :
            metrics.uncategorizedCount > 0 ? `Not ready · ${metrics.uncategorizedCount} transactions are uncategorized` :
            metrics.openRisksCount > 0 ? `Not ready · ${metrics.openRisksCount} unresolved risks require attention` :
            readiness?.status || "Ready"
          }
          ctaText="Start Review →"
          onClick={() => navigate('/reports')}
          accentColor={!hasTransactions ? 'neutral' : readiness?.score && readiness.score >= 90 ? 'green' : readiness?.score && readiness.score >= 70 ? 'amber' : 'red'}
        />
        <MiniCard 
          title="Accountant Pack"
          value={hasTransactions ? (readiness?.score && readiness.score >= 90 ? "Ready" : "Draft") : "Coming online"}
          subValue={hasTransactions ? (readiness?.score && readiness.score >= 90 ? "Book close ready" : "Preparation draft") : "Closed pack"}
          ctaText={hasTransactions ? "Export →" : undefined}
          onClick={() => navigate('/reports')}
          accentColor={hasTransactions ? (readiness?.score && readiness.score >= 90 ? 'green' : 'amber') : 'neutral'}
        />
      </div>

      {hasTransactions && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Priority Review - Left Column */}
          <div className="lg:col-span-4">
            <div className="premium-glass rounded-2xl p-6 border border-border/20 hover:border-border/30 shadow-xl flex flex-col justify-between h-full min-h-[340px]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-warning">Priority Review</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/20 text-[9px] font-black uppercase tracking-wider">Action Required</span>
                </div>
                
                <p className="text-xs text-muted-foreground leading-relaxed font-medium mb-5">
                  Verify open risk events and categorize transactions to lock client books for close.
                </p>

                <div className="space-y-3">
                  {/* Open Risks */}
                  <div 
                    onClick={() => navigate('/risk-inbox')}
                    className="p-3 bg-white/5 border border-border/20 rounded-xl hover:bg-white/10 hover:border-border/30 transition-all duration-150 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-risk" />
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">Open Risks</span>
                    </div>
                    <span className="text-xs font-bold text-risk group-hover:underline">{metrics.openRisksCount} open risks</span>
                  </div>

                  {/* Duplicate Spend Exposure */}
                  <div 
                    onClick={() => navigate('/risk-inbox?type=duplicate_payment')}
                    className="p-3 bg-white/5 border border-border/20 rounded-xl hover:bg-white/10 hover:border-border/30 transition-all duration-150 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-risk" />
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">Duplicate Spend Exposure</span>
                    </div>
                    <span className="text-xs font-bold text-risk group-hover:underline">{formatCurrency(metrics.duplicateExposure)} duplicate exposure</span>
                  </div>

                  {/* Transactions Needing Review */}
                  <div 
                    onClick={() => navigate('/transactions?review=pending')}
                    className="p-3 bg-white/5 border border-border/20 rounded-xl hover:bg-white/10 hover:border-border/30 transition-all duration-150 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">Pending Review</span>
                    </div>
                    <span className="text-xs font-bold text-amber-500 group-hover:underline">{metrics.unreviewedCount} transactions pending review</span>
                  </div>

                  {/* Uncategorized Count */}
                  <div 
                    onClick={() => navigate('/transactions?category=uncategorized')}
                    className="p-3 bg-white/5 border border-border/20 rounded-xl hover:bg-white/10 hover:border-border/30 transition-all duration-150 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">Uncategorized Ledger Rows</span>
                    </div>
                    <span className="text-xs font-bold text-amber-500 group-hover:underline">{metrics.uncategorizedCount} uncategorized rows</span>
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-border/20 mt-5 flex flex-col gap-2">
                <button
                  onClick={() => navigate('/risk-inbox')}
                  className="w-full py-2.5 bg-teal-500 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-teal-400 transition-all cursor-pointer shadow-lg shadow-teal-500/10"
                >
                  Open Risk Inbox <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate('/transactions?review=pending')}
                    className="py-2.5 bg-white/5 hover:bg-white/10 text-foreground font-semibold rounded-xl text-xs transition-colors border border-border/30 cursor-pointer text-center"
                  >
                    Review Txns
                  </button>
                  <button
                    onClick={() => navigate('/transactions?category=uncategorized')}
                    className="py-2.5 bg-white/5 hover:bg-white/10 text-foreground font-semibold rounded-xl text-xs transition-colors border border-border/30 cursor-pointer text-center"
                  >
                    Map Categories
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* AI Review - Middle Column */}
          <div className="lg:col-span-4">
            <div className="premium-glass rounded-2xl p-6 border border-border/20 hover:border-border/30 shadow-xl flex flex-col justify-between h-full min-h-[340px]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-teal-400">AI Review</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[9px] font-black uppercase tracking-wider">Kaeo Assistant</span>
                </div>
                
                <p className="text-xs text-muted-foreground leading-relaxed font-medium mb-5">
                  Kaeo has audited your financial statements and prepared review suggestions to automate your books.
                </p>

                <div className="space-y-3">
                  {/* Suggestions Pending */}
                  <div 
                    onClick={() => setIsAIQueueOpen(true)}
                    className="p-3 bg-white/5 border border-border/20 rounded-xl hover:bg-white/10 hover:border-border/30 transition-all duration-150 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">Suggestions Pending</span>
                    </div>
                    <span className="text-xs font-bold text-teal-400 group-hover:underline">{sugMetrics.pending} suggestions</span>
                  </div>

                  {/* High Priority Suggestions */}
                  <div 
                    onClick={() => setIsAIQueueOpen(true)}
                    className="p-3 bg-white/5 border border-border/20 rounded-xl hover:bg-white/10 hover:border-border/30 transition-all duration-150 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-risk" />
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">High Priority</span>
                    </div>
                    <span className="text-xs font-bold text-risk group-hover:underline">{sugMetrics.high} high priority</span>
                  </div>

                  {/* Safe Auto-Categorization Count */}
                  <div 
                    onClick={() => setIsAIQueueOpen(true)}
                    className="p-3 bg-white/5 border border-border/20 rounded-xl hover:bg-white/10 hover:border-border/30 transition-all duration-150 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">Safe Auto-Categorization</span>
                    </div>
                    <span className="text-xs font-bold text-success group-hover:underline">{sugMetrics.safe} safe items</span>
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-border/20 mt-5">
                <button
                  onClick={() => setIsAIQueueOpen(true)}
                  className="w-full py-2.5 bg-teal-500 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-teal-400 transition-all cursor-pointer shadow-lg shadow-teal-500/10"
                >
                  Review AI Suggestions <Sparkles className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Cash Flow Timeline - Right Column */}
          <div className="lg:col-span-4">
            {chartData.length > 0 && (
              <div className="premium-glass rounded-2xl p-5 border border-border/20 shadow-xl space-y-3 h-full min-h-[340px] flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-border/20 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cash Flow Timeline</h3>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold">
                    <span className="flex items-center gap-1.5 text-success">
                      <span className="w-1.5 h-1.5 rounded-full bg-success" /> Revenue Inflow
                    </span>
                    <span className="flex items-center gap-1.5 text-risk">
                      <span className="w-1.5 h-1.5 rounded-full bg-risk" /> Expense Outflow
                    </span>
                  </div>
                </div>

                <div className="h-44 w-full flex-1 mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-stop-inflow)" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="var(--chart-stop-inflow)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-stop-outflow)" stopOpacity={0.15}/>
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
                        strokeWidth={1.5}
                        fillOpacity={1} 
                        fill="url(#inflowGrad)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="outflow" 
                        stroke="var(--chart-stroke-outflow)" 
                        strokeWidth={1.5}
                        fillOpacity={1} 
                        fill="url(#outflowGrad)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {!hasTransactions ? (
        <div className="premium-glass border border-dashed border-border/40 rounded-3xl p-20 flex flex-col items-center justify-center text-center space-y-5 shadow-xl">
          <div className="w-16 h-16 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20 shadow-inner">
            <FileText className="w-8 h-8 text-teal-400/40" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold tracking-tight">No financial ledger uploaded</h3>
            <p className="text-xs text-muted-foreground max-w-sm font-medium">
              Upload and import a transaction sheet to activate AI CFO insights.
            </p>
          </div>
          <button 
            onClick={() => navigate('/files')}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-all shadow-xl shadow-primary/20 cursor-pointer"
          >
            Upload Finance File
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (Wide) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Month-End Readiness Detailed Card */}
            <div className="premium-glass rounded-2xl p-6 border border-border/20 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Month-End Readiness Close</h3>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                  readiness?.status === 'Ready' ? 'bg-success/15 text-success border border-success/20' : 
                  readiness?.status === 'Almost ready' ? 'bg-primary/15 text-primary border border-primary/20' : 
                  readiness?.status === 'Needs review' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/20' : 
                  'bg-risk/15 text-risk border border-risk/20'
                }`}>
                  {readiness?.status || 'Not ready'}
                </span>
              </div>

              <div className="flex items-center gap-5">
                {/* Large Score Circle */}
                <div className="relative w-16 h-16 shrink-0 bg-white/5 border border-border/20 rounded-full flex items-center justify-center">
                  <span className="text-lg font-black text-foreground">{readiness?.score || 0}%</span>
                </div>
                
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Top Deduction Reason</h4>
                  <p className="text-sm font-bold text-foreground mt-0.5 leading-snug">
                    {topReasonText}
                  </p>
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground leading-relaxed pt-2 border-t border-border/20 font-medium">
                {readiness?.score && readiness.score >= 90 ? (
                  <span className="text-success font-semibold">Your score is 90+. You are fully prepared to export the Accountant Pack for close.</span>
                ) : (
                  <span>To prepare the workspace for export, categorize unmapped transactions and review all pending transactions to boost your readiness.</span>
                )}
              </div>
            </div>

            {/* File Interpretation Card */}
            <div className="premium-glass rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl shrink-0 shadow-sm shadow-teal-500/5">
                <img src={aeLogo} alt="Ligature logo" className="w-7 h-7 object-contain" />
              </div>
              <div className="space-y-4 flex-1">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-teal-400">File Interpretation</h4>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed font-medium">
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
                    <span className="text-sm font-bold text-success mt-0.5">{metrics.incomeCount}</span>
                  </div>
                  {metrics.refundCount > 0 && (
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Refund rows</span>
                      <span className="text-sm font-bold text-success mt-0.5">{metrics.refundCount}</span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Expense rows</span>
                    <span className="text-sm font-bold text-risk mt-0.5">{metrics.expenseCount}</span>
                  </div>
                  {metrics.unknownCount > 0 && (
                    <div 
                      onClick={() => navigate('/transactions?type=unknown')}
                      className="flex flex-col cursor-pointer hover:opacity-80 transition-all group"
                    >
                      <span className="text-[9px] font-bold text-muted-foreground group-hover:text-primary uppercase">Unknown rows</span>
                      <span className="text-sm font-bold text-muted-foreground mt-0.5 group-hover:text-primary">{metrics.unknownCount}</span>
                    </div>
                  )}
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
                      className="text-success"
                      strokeWidth="2.5"
                      strokeDasharray={`${incomePercentage}, 100`}
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-bold">{incomePercentage}%</span>
                    <span className="text-[7px] font-bold text-muted-foreground uppercase leading-none font-semibold">Inflow</span>
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
                  onClick={() => navigate('/transactions')}
                  className="text-[10px] font-black text-teal-400 hover:text-teal-300 uppercase tracking-widest cursor-pointer"
                >
                  View Full Ledger
                </button>
              </div>
              <div className="divide-y divide-border/20">
                {recentTransactions.map((tx) => {
                  const isIncome = ['income', 'refund'].includes(tx.type);
                  const isExpense = ['expense', 'vendor_payment', 'subscription'].includes(tx.type);
                  const isFailed = ['failed', 'failed_payment'].includes(tx.type);
                  
                  let badgeClass = 'bg-muted/30 text-muted-foreground border-border/40';
                  if (isIncome) badgeClass = 'bg-success/10 text-success border-success/20';
                  else if (isExpense || isFailed) badgeClass = 'bg-risk/10 text-risk border-risk/20';

                  let textClass = 'text-muted-foreground';
                  if (isIncome) textClass = 'text-success';
                  else if (isExpense || isFailed) textClass = 'text-risk';

                  return (
                    <div key={tx.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${badgeClass}`}>
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
                        <div className={`text-xs font-extrabold ${textClass}`}>
                          {isIncome ? '+' : isExpense ? '-' : ''}{formatCurrency(Math.abs(tx.amount))}
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
            {/* Action-Oriented Strategic Insights */}
            <div className="premium-glass rounded-2xl p-6 shadow-xl space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-teal-400" />
                Strategic Insights
              </h3>
              
              <div className="space-y-4">
                <ul className="space-y-3.5 text-xs text-muted-foreground font-semibold leading-relaxed">
                  {metrics.topVendor.amount > 0 && (
                    <li className="flex gap-2.5 items-start">
                      <span className="text-primary mt-0.5">•</span>
                      <span>
                        <strong className="text-foreground">{metrics.topVendor.name}</strong> is your largest expense destination ({formatCurrency(metrics.topVendor.amount)} total).
                      </span>
                    </li>
                  )}
                  <li className="flex gap-2.5 items-start">
                    <span className="text-primary mt-0.5">•</span>
                    <span>
                      <strong className="text-foreground">{formatCurrency(metrics.duplicateExposure)}</strong> duplicate exposure needs review.
                    </span>
                  </li>
                  <li className="flex gap-2.5 items-start">
                    <span className="text-primary mt-0.5">•</span>
                    <span>
                      <strong className="text-foreground">{metrics.uncategorizedCount}</strong> transactions are uncategorized.
                    </span>
                  </li>
                  {metrics.unreviewedCount > 0 && (
                    <li className="flex gap-2.5 items-start">
                      <span className="text-primary mt-0.5">•</span>
                      <span>
                        <strong className="text-foreground">{metrics.unreviewedCount}</strong> transactions need review.
                      </span>
                    </li>
                  )}
                </ul>

                <div className="pt-3.5 border-t border-border/20">
                  <Link 
                    to="/risk-inbox"
                    className="text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1.5 group"
                  >
                    Review risks <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </Link>
                </div>
                </div>
              </div>

              {/* First Launch Checklist */}
              <div className="premium-glass rounded-2xl p-5 shadow-xl space-y-4 border border-border/20">
                <h3 className="text-xs font-black uppercase tracking-widest text-teal-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400" />
                  Launch Checklist
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Complete these setup milestones to get your workspace ready for active CFO review.
                </p>
                
                <div className="space-y-3 pt-1">
                  {/* 1. Create Workspace */}
                  <div className="flex items-start gap-2.5 text-xs text-foreground/80">
                    <div className="w-4 h-4 rounded border border-teal-500 bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-2.5 h-2.5 fill-none stroke-[3] stroke-current" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold line-through text-muted-foreground">Create workspace</span>
                      <span className="text-[9px] text-muted-foreground/60">Workspace configured</span>
                    </div>
                  </div>

                  {/* 2. Upload First Statement */}
                  <div className="flex items-start gap-2.5 text-xs text-foreground/80">
                    {metrics.count > 0 ? (
                      <div className="w-4 h-4 rounded border border-teal-500 bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-2.5 h-2.5 fill-none stroke-[3] stroke-current" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded border border-border bg-muted/20 shrink-0 mt-0.5" />
                    )}
                    <div className="flex flex-col">
                      <span className={metrics.count > 0 ? "font-bold line-through text-muted-foreground" : "font-bold text-foreground"}>Upload first statement</span>
                      {metrics.count > 0 ? (
                        <span className="text-[9px] text-muted-foreground/60">Uploaded {metrics.count} rows</span>
                      ) : (
                        <Link to="/files" className="text-[9px] text-teal-400 hover:underline">Upload bank statement →</Link>
                      )}
                    </div>
                  </div>

                  {/* 3. Review Risks */}
                  <div className="flex items-start gap-2.5 text-xs text-foreground/80">
                    {metrics.count > 0 && metrics.openRisksCount === 0 ? (
                      <div className="w-4 h-4 rounded border border-teal-500 bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-2.5 h-2.5 fill-none stroke-[3] stroke-current" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded border border-border bg-muted/20 shrink-0 mt-0.5" />
                    )}
                    <div className="flex flex-col">
                      <span className={metrics.count > 0 && metrics.openRisksCount === 0 ? "font-bold line-through text-muted-foreground" : "font-bold text-foreground"}>Review risks</span>
                      {metrics.openRisksCount > 0 ? (
                        <Link to="/risk-inbox" className="text-[9px] text-teal-400 hover:underline">Resolve {metrics.openRisksCount} active risks →</Link>
                      ) : (
                        <span className="text-[9px] text-muted-foreground/60">No pending risks</span>
                      )}
                    </div>
                  </div>

                  {/* 4. Categorize Unknown Rows */}
                  <div className="flex items-start gap-2.5 text-xs text-foreground/80">
                    {metrics.count > 0 && metrics.uncategorizedCount === 0 ? (
                      <div className="w-4 h-4 rounded border border-teal-500 bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-2.5 h-2.5 fill-none stroke-[3] stroke-current" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded border border-border bg-muted/20 shrink-0 mt-0.5" />
                    )}
                    <div className="flex flex-col">
                      <span className={metrics.count > 0 && metrics.uncategorizedCount === 0 ? "font-bold line-through text-muted-foreground" : "font-bold text-foreground"}>Categorize unknown rows</span>
                      {metrics.uncategorizedCount > 0 ? (
                        <Link to="/transactions?category=uncategorized" className="text-[9px] text-teal-400 hover:underline">Categorize {metrics.uncategorizedCount} rows →</Link>
                      ) : (
                        <span className="text-[9px] text-muted-foreground/60">All rows categorized</span>
                      )}
                    </div>
                  </div>

                  {/* 5. Generate Accountant Pack */}
                  <div className="flex items-start gap-2.5 text-xs text-foreground/80">
                    <div className="w-4 h-4 rounded border border-border bg-muted/20 shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">Generate accountant pack</span>
                      <Link to="/reports" className="text-[9px] text-teal-400 hover:underline">Generate pack →</Link>
                    </div>
                  </div>

                  {/* 6. Ask Kaeo for Next Action */}
                  <div className="flex items-start gap-2.5 text-xs text-foreground/80">
                    <div className="w-4 h-4 rounded border border-border bg-muted/20 shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">Ask Kaeo for next action</span>
                      <Link to="/ask-kaeo" className="text-[9px] text-teal-400 hover:underline">Consult Kaeo Advisor →</Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Roadmap & Future Capabilities */}
              <div className="premium-glass rounded-2xl p-5 shadow-lg border border-border/30 space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Integration Roadmap
                </h4>
                <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                  Future capabilities planned for the active Kaeo Spend Control network.
                </p>
                
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <div className="flex justify-between items-center text-[10px] px-2.5 py-1.5 bg-white/5 rounded-lg border border-border/20">
                    <span className="font-bold text-foreground/80">Bank Feed Integrations</span>
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase">Coming Soon</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] px-2.5 py-1.5 bg-white/5 rounded-lg border border-border/20">
                    <span className="font-bold text-foreground/80">Tally &amp; Zoho Sync</span>
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase">Planned</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] px-2.5 py-1.5 bg-white/5 rounded-lg border border-border/20">
                    <span className="font-bold text-foreground/80">Approval Workflows</span>
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase">Coming Soon</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] px-2.5 py-1.5 bg-white/5 rounded-lg border border-border/20">
                    <span className="font-bold text-foreground/80">UPI Payment Controls</span>
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase">Planned</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] px-2.5 py-1.5 bg-white/5 rounded-lg border border-border/20">
                    <span className="font-bold text-foreground/80">Card/Spend Policy Layer</span>
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase">Coming Soon</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] px-2.5 py-1.5 bg-white/5 rounded-lg border border-border/20">
                    <span className="font-bold text-foreground/80">Accountant Collaboration</span>
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase">Planned</span>
                  </div>
                </div>
              </div>

              {/* Workspace Signals */}
              <div className="premium-glass rounded-2xl p-5 shadow-lg border border-border/20 space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/85 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-400" />
                  Workspace Signals
                </h4>
                <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                  Operational status metrics and active integrations in your Kaeo workspace.
                </p>
                
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <div 
                    onClick={() => navigate('/vendors')}
                    className="flex justify-between items-center text-[10px] px-2.5 py-1.5 bg-white/5 rounded-lg border border-border/20 hover:border-border/30 transition-all cursor-pointer group/item"
                  >
                    <span className="font-semibold text-muted-foreground group-hover/item:text-foreground">Unique Vendors</span>
                    <span className="font-bold text-foreground group-hover/item:text-primary">{metrics.uniqueVendorsCount} active</span>
                  </div>
                  <div 
                    onClick={() => navigate('/files')}
                    className="flex justify-between items-center text-[10px] px-2.5 py-1.5 bg-white/5 rounded-lg border border-border/20 hover:border-border/30 transition-all cursor-pointer group/item"
                  >
                     <span className="font-semibold text-muted-foreground group-hover/item:text-foreground">Invoice Matching Status</span>
                     <span className="font-bold text-foreground group-hover/item:text-primary">
                       {metrics.totalInvoicesCount > 0 ? `${metrics.matchedInvoicesCount} / ${metrics.totalInvoicesCount} matched` : "0 pending"}
                     </span>
                  </div>
                  <div 
                    onClick={() => navigate('/files')}
                    className="flex justify-between items-center text-[10px] px-2.5 py-1.5 bg-white/5 rounded-lg border border-border/20 hover:border-border/30 transition-all cursor-pointer group/item"
                  >
                    <span className="font-semibold text-muted-foreground group-hover/item:text-foreground">Imported Bank Sheets</span>
                    <span className="font-bold text-foreground group-hover/item:text-primary">{metrics.uploadsCount} statement files</span>
                  </div>
                  <div 
                    onClick={() => navigate('/settings?tab=spend-rules')}
                    className="flex justify-between items-center text-[10px] px-2.5 py-1.5 bg-white/5 rounded-lg border border-border/20 hover:border-border/30 transition-all cursor-pointer group/item"
                  >
                    <span className="font-semibold text-muted-foreground group-hover/item:text-foreground">Active Compliance Rules</span>
                    <span className="font-bold text-foreground group-hover/item:text-primary">{metrics.rulesActiveCount} rules active</span>
                  </div>
                  <div 
                    onClick={() => navigate('/ask-kaeo')}
                    className="flex justify-between items-center text-[10px] px-2.5 py-1.5 bg-white/5 rounded-lg border border-border/20 hover:border-border/30 transition-all cursor-pointer group/item"
                  >
                    <span className="font-semibold text-muted-foreground group-hover/item:text-foreground">Ask Kaeo Suggestions</span>
                    <span className="font-bold text-foreground group-hover/item:text-primary">
                      {metrics.suggestionsCount > 0 ? `${metrics.suggestionsCount} tips ready` : "No issues"}
                    </span>
                  </div>
                </div>
              </div>

            {/* Legend Card */}
            <div className="px-6 py-5 bg-white/5 rounded-2xl border border-border/20">
              <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-3">Intelligence Legend</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  Income: Verified revenue entries
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-risk" />
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsAddTxOpen(false)}
        >
          <div 
            className="w-full max-w-lg premium-floating-panel rounded-3xl p-6 shadow-2xl relative my-8 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsAddTxOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 mb-3">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            
            <h3 className="text-base font-bold text-foreground mb-1">Add Manual Transaction</h3>
            <p className="text-xs text-muted-foreground mb-5">
              Record an offline or manual financial flow. The risk engine will automatically analyze it against uploaded bills.
            </p>
            
            <form onSubmit={handleSaveManualTx} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Transaction Date</label>
                  <input 
                    type="date"
                    required
                    value={manualTxDate}
                    onChange={(e) => setManualTxDate(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                  />
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount (INR ₹)</label>
                  <input 
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    placeholder="5,000.00"
                    value={manualTxAmt}
                    onChange={(e) => setManualTxAmt(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Type */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Flow Type</label>
                  <select
                    value={manualTxType}
                    onChange={(e) => setManualTxType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#161a18] border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="expense">Expense (Outflow)</option>
                    <option value="income">Revenue / Sales (Inflow)</option>
                    <option value="refund">Refund / Recovery (Inflow)</option>
                    <option value="unknown">Unknown Outflow</option>
                  </select>
                </div>

                {/* Vendor / Counterparty */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vendor / Counterparty</label>
                  <input 
                    type="text"
                    placeholder="e.g. AWS, Stripe, Google"
                    value={manualTxVendor}
                    onChange={(e) => setManualTxVendor(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Github Copilot subscription"
                  value={manualTxDesc}
                  onChange={(e) => setManualTxDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</label>
                    {manualTxDesc && (
                      <span className="text-[8px] font-black uppercase text-teal-400 bg-teal-500/10 px-1 py-0.2 rounded border border-teal-500/20">Auto suggested</span>
                    )}
                  </div>
                  <select
                    value={manualTxCat}
                    onChange={(e) => setManualTxCat(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161a18] border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary"
                  >
                    {ALL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Review Note */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Audit / Internal Note</label>
                  <input 
                    type="text"
                    placeholder="Optional memo..."
                    value={manualTxNote}
                    onChange={(e) => setManualTxNote(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-border/20 pt-4 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsAddTxOpen(false)}
                  disabled={manualTxSaving}
                  className="flex-1 py-2.5 bg-card hover:bg-muted text-foreground font-semibold rounded-xl text-xs transition-colors border border-border/40"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={manualTxSaving}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:opacity-90 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-1.5"
                >
                  {manualTxSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Save Transaction
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <AIReviewQueueModal 
        isOpen={isAIQueueOpen} 
        onClose={() => setIsAIQueueOpen(false)} 
        onRefreshParent={fetchDashboardData} 
      />
    </div>
  );
};

export default Dashboard;
