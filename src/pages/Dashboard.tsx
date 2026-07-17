import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  FileText,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Clock,
  Download,
  ShieldAlert,
  CheckCircle2,
  Layers,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { useToast } from '../hooks/useToast';
import EmptyState from '../components/ui/EmptyState';
import MetricCard from '../components/ui/MetricCard';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { StatusChip, reviewStatusToVariant } from '../components/ui/StatusChip';
import { supabase } from '../lib/supabase';
import { calculateMonthEndReadiness, type ReadinessResult } from '../lib/readinessEngine';
import { getDisplayCategory, inferTransactionCategory, ALL_CATEGORIES } from '../lib/categoryEngine';
import { getCleanTransactions } from '../lib/transactionFilters';
import { analyzeRisksForClient } from '../lib/riskEngine';
import { getSpendRules } from '../lib/spendRulesEngine';
import { AIReviewQueueModal } from '../components/ai/AIReviewQueueModal';
import { formatINR, getCleanClientName } from '../lib/formatters';
import { useWorkspaceRefresh } from '../hooks/useWorkspaceRefresh';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import AskLibbyButton from '../components/libby/AskLibbyButton';

interface ChartDataPoint {
  date: string;
  inflow: number;
  outflow: number;
  rawDate: string;
}

const Dashboard: React.FC = () => {
  const {
    activeClient,
    accountMode,
    setModalMode,
    setClientToEdit,
    setIsCreateModalOpen,
    clients,
    setActiveClient
  } = useWorkspace();
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
  // Track AI suggestion counts but don't display in current layout
  const [, setSugMetrics] = useState({ pending: 0, safe: 0, high: 0 });

  useEffect(() => {
    if (manualTxDesc) {
      const suggested = inferTransactionCategory(manualTxDesc, manualTxVendor, manualTxType);
      if (suggested && suggested !== 'Uncategorized') setManualTxCat(suggested);
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
      if (isNaN(amt) || amt <= 0) throw new Error('Please enter a valid positive number for the amount.');
      const finalAmt = (manualTxType === 'expense' || manualTxType === 'unknown') ? -Math.abs(amt) : Math.abs(amt);
      const { error } = await supabase.from('transactions').insert({
        organization_id: activeClient.organization_id,
        client_id: activeClient.id,
        transaction_date: manualTxDate || new Date().toISOString().split('T')[0],
        description: manualTxDesc,
        amount: finalAmt,
        original_amount: finalAmt,
        original_currency: 'INR',
        currency: 'INR',
        exchange_rate: 1,
        amount_in_base_currency: finalAmt,
        fx_date: null, fx_source: null, fx_metadata: {},
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
      setManualTxDesc(''); setManualTxAmt(''); setManualTxType('expense');
      setManualTxCat('Uncategorized'); setManualTxVendor(''); setManualTxNote('');
      fetchDashboardData();
      await analyzeRisksForClient(activeClient.organization_id, activeClient.id);
    } catch (err: any) {
      toast(err.message || 'Failed to add transaction', 'error');
    } finally {
      setManualTxSaving(false);
    }
  };

  const [metrics, setMetrics] = useState({
    income: 0, expenses: 0, refunds: 0, net: 0, count: 0,
    incomeCount: 0, expenseCount: 0, unknownCount: 0,
    vendorPaymentCount: 0, refundCount: 0, failedCount: 0,
    topVendor: { name: '', amount: 0 },
    uncategorizedCount: 0, unreviewedCount: 0, openRisksCount: 0,
    duplicateExposure: 0, uniqueVendorsCount: 0,
    matchedInvoicesCount: 0, totalInvoicesCount: 0, overdueInvoicesCount: 0,
    highValueCount: 0, recurringCount: 0, rulesActiveCount: 0,
    uploadsCount: 0, suggestionsCount: 0
  });
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [, setTrends] = useState<{
    spendChange: number | null;
    incomeChange: number | null;
    netChange: number | null;
    countChange: number | null;
    hasPrevPeriod: boolean;
    prevMonthName: string;
    currentMonthName: string;
    prevSpend: number;
    curSpend: number;
    prevIncome: number;
    curIncome: number;
    prevNet: number;
    curNet: number;
    prevCount: number;
    curCount: number;
  }>({
    spendChange: null,
    incomeChange: null,
    netChange: null,
    countChange: null,
    hasPrevPeriod: false,
    prevMonthName: '',
    currentMonthName: '',
    prevSpend: 0,
    curSpend: 0,
    prevIncome: 0,
    curIncome: 0,
    prevNet: 0,
    curNet: 0,
    prevCount: 0,
    curCount: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [openRisksData, setOpenRisksData] = useState<any[]>([]);

  useEffect(() => {
    if (activeClient) fetchDashboardData();
  }, [activeClient]);

  useWorkspaceRefresh(useCallback(() => {
    if (activeClient) fetchDashboardData();
  }, [activeClient]));

  const needsProfileCompletion = !!activeClient && (
    !activeClient.industry ||
    !activeClient.metadata?.accounting_tools?.[0] ||
    !activeClient.metadata?.monthly_spend_range
  );
  const [isProfileCardDismissed, setIsProfileCardDismissed] = useState(true);
  useEffect(() => {
    if (activeClient) {
      setIsProfileCardDismissed(localStorage.getItem(`kaeo_profile_dismiss_${activeClient.id}`) === 'true');
    }
  }, [activeClient]);

  const fetchDashboardData = async () => {
    if (!activeClient) return;
    setLoading(true);
    try {
      const { data: allTransactions, error: metricsErr } = await supabase
        .from('transactions').select('*').eq('client_id', activeClient.id);
      if (metricsErr) throw metricsErr;

      const cleanTransactions = getCleanTransactions(allTransactions || []);
      const { data: risksData } = await supabase
        .from('risk_events').select('*').eq('client_id', activeClient.id).eq('status', 'open');

      setOpenRisksData(risksData || []);
      const readinessResult = calculateMonthEndReadiness(cleanTransactions, risksData || []);
      setReadiness(readinessResult);

      // Group clean transactions by Year-Month for trend calculation
      const monthlyData: Record<string, { income: number; expenses: number; net: number; count: number }> = {};
      cleanTransactions.forEach(tx => {
        if (!tx.transaction_date) return;
        const date = new Date(tx.transaction_date);
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;

        if (!monthlyData[key]) {
          monthlyData[key] = { income: 0, expenses: 0, net: 0, count: 0 };
        }

        const txAmountVal = tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined
          ? Number(tx.amount_in_base_currency) : Number(tx.amount);
        const amt = Math.abs(txAmountVal);
        const directionDerived = tx.raw_row_json?.direction_derived as string | undefined;
        const isInflowTx = directionDerived === 'inflow' || (!directionDerived && txAmountVal > 0);

        if (tx.type !== 'transfer') {
          if (tx.type === 'income' && isInflowTx && amt > 0) {
            monthlyData[key].income += amt;
          } else if (['expense', 'vendor_payment', 'subscription', 'bank_charge'].includes(tx.type)) {
            monthlyData[key].expenses += amt;
          }
        }
        monthlyData[key].count++;
      });

      // Calculate net for each month
      Object.keys(monthlyData).forEach(key => {
        monthlyData[key].net = monthlyData[key].income - monthlyData[key].expenses;
      });

      const sortedMonths = Object.keys(monthlyData).sort();
      let currentMonthKey = sortedMonths[sortedMonths.length - 1];
      let previousMonthKey = sortedMonths[sortedMonths.length - 2];

      let trendMetrics = {
        spendChange: null as number | null,
        incomeChange: null as number | null,
        netChange: null as number | null,
        countChange: null as number | null,
        hasPrevPeriod: false,
        prevMonthName: '',
        currentMonthName: '',
        prevSpend: 0,
        curSpend: 0,
        prevIncome: 0,
        curIncome: 0,
        prevNet: 0,
        curNet: 0,
        prevCount: 0,
        curCount: 0
      };

      if (currentMonthKey && previousMonthKey) {
        const cur = monthlyData[currentMonthKey];
        const prev = monthlyData[previousMonthKey];

        const getMonthName = (key: string) => {
          const [y, m] = key.split('-');
          const monthIndex = Number(m) - 1;
          const monthName = new Date(Number(y), monthIndex).toLocaleString('en-US', { month: 'short' });
          return `${monthName} '${y.substring(2)}`;
        };

        trendMetrics.currentMonthName = getMonthName(currentMonthKey);
        trendMetrics.prevMonthName = getMonthName(previousMonthKey);
        trendMetrics.hasPrevPeriod = true;

        trendMetrics.curSpend = cur.expenses;
        trendMetrics.prevSpend = prev.expenses;
        trendMetrics.curIncome = cur.income;
        trendMetrics.prevIncome = prev.income;
        trendMetrics.curNet = cur.net;
        trendMetrics.prevNet = prev.net;
        trendMetrics.curCount = cur.count;
        trendMetrics.prevCount = prev.count;

        const calcPct = (cVal: number, pVal: number) => {
          if (pVal === 0) return null;
          return ((cVal - pVal) / Math.abs(pVal)) * 100;
        };

        trendMetrics.spendChange = calcPct(cur.expenses, prev.expenses);
        trendMetrics.incomeChange = calcPct(cur.income, prev.income);
        trendMetrics.netChange = calcPct(cur.net, prev.net);
        trendMetrics.countChange = calcPct(cur.count, prev.count);
      }

      setTrends(trendMetrics);

      const vendors: Record<string, number> = {};
      const dailyMap: Record<string, { inflow: number; outflow: number; rawDate: string }> = {};

      const stats = cleanTransactions.reduce((acc, tx) => {
        const txAmountVal = tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined
          ? Number(tx.amount_in_base_currency) : Number(tx.amount);
        const amt = Math.abs(txAmountVal);
        const directionDerived = tx.raw_row_json?.direction_derived as string | undefined;
        const isInflowTx = directionDerived === 'inflow' || (!directionDerived && txAmountVal > 0);
        const isOutflowTx = directionDerived === 'outflow' || (!directionDerived && txAmountVal < 0);

        if (!tx.review_status || tx.review_status === 'new' || tx.review_status === 'needs_review') acc.unreviewedCount++;

        if (tx.transaction_date) {
          const rawDateStr = tx.transaction_date.split('T')[0];
          const displayDate = new Date(tx.transaction_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          if (!dailyMap[displayDate]) dailyMap[displayDate] = { inflow: 0, outflow: 0, rawDate: rawDateStr };
          if (tx.type !== 'transfer') {
            if (isInflowTx) dailyMap[displayDate].inflow += amt;
            else if (isOutflowTx) dailyMap[displayDate].outflow += amt;
          }
        }

        if (tx.type === 'income' && isInflowTx && amt > 0) { acc.income += amt; acc.incomeCount++; }
        else if (['expense', 'vendor_payment', 'subscription', 'bank_charge'].includes(tx.type) && tx.type !== 'transfer') {
          acc.expenses += amt; acc.expenseCount++;
          if (tx.type === 'vendor_payment') acc.vendorPaymentCount++;
          const name = tx.counterparty_name?.trim() || tx.description.replace(/vendor payment|payment to|paid to/gi, '').trim().split(' ').filter((w: string) => w.length > 2 && !/\d/.test(w))[0] || tx.description.split(' ')[0];
          vendors[name] = (vendors[name] || 0) + amt;
        }
        else if (tx.type === 'refund') { acc.refunds += amt; acc.refundCount++; }
        else if (tx.type === 'failed' || tx.type === 'failed_payment') { acc.failedCount++; }
        acc.count++;
        return acc;
      }, { income: 0, expenses: 0, refunds: 0, count: 0, incomeCount: 0, expenseCount: 0, unknownCount: 0, vendorPaymentCount: 0, refundCount: 0, failedCount: 0, uncategorizedCount: 0, unreviewedCount: 0 });

      let totalUncategorizedCount = 0; let totalUnknownCount = 0;
      cleanTransactions.forEach(tx => {
        const cat = getDisplayCategory(tx);
        const isCatMissingOrInvalid = !tx.category || tx.category.trim() === '' || tx.category.toLowerCase() === 'null' || tx.category.toLowerCase() === 'generic';
        if (cat === 'Uncategorized' || cat === 'Unknown' || tx.type === 'unknown' || isCatMissingOrInvalid) {
          if (tx.type === 'unknown') totalUnknownCount++;
          else totalUncategorizedCount++;
        }
      });
      stats.uncategorizedCount = totalUncategorizedCount;
      stats.unknownCount = totalUnknownCount;

      let duplicateExposure = 0;
      (risksData || []).forEach(r => { if (r.risk_type.includes('duplicate')) duplicateExposure += Number(r.amount_at_risk); });

      let topVendor = { name: '', amount: 0 };
      Object.entries(vendors).forEach(([name, amount]) => { if (amount > topVendor.amount) topVendor = { name, amount }; });

      let totalInvoicesCount = 0; let matchedInvoicesCount = 0; let overdueInvoicesCount = 0;
      try {
        const { data: invoicesData } = await supabase.from('invoices').select('id, status, due_date').eq('client_id', activeClient.id);
        if (invoicesData) {
          totalInvoicesCount = invoicesData.length;
          matchedInvoicesCount = invoicesData.filter(inv => inv.status === 'paid').length;
          const today = new Date();
          overdueInvoicesCount = invoicesData.filter(inv => inv.status === 'overdue' || (inv.status === 'unpaid' && inv.due_date && new Date(inv.due_date) < today)).length;
        }
      } catch (e) { console.error('Error fetching invoices:', e); }

      let uploadsCount = 0;
      try {
        const { data: uploadsData } = await supabase.from('uploaded_files').select('id').eq('client_id', activeClient.id);
        if (uploadsData) uploadsCount = uploadsData.length;
      } catch (e) { console.error('Error fetching uploads:', e); }

      let rulesActiveCount = 0;
      try {
        const activeRules = await getSpendRules(activeClient.organization_id);
        rulesActiveCount = activeRules.filter(r => r.enabled).length;
      } catch (e) { console.error('Error fetching rules:', e); }

      const highValueCount = cleanTransactions.filter(tx => {
        const val = tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined ? Number(tx.amount_in_base_currency) : Number(tx.amount);
        return ['expense', 'vendor_payment', 'subscription'].includes(tx.type) && Math.abs(val) >= 50000;
      }).length;
      const recurringCount = cleanTransactions.filter(tx => tx.type === 'subscription').length;

      let pendingSugsCount = 0; let safeSugsCount = 0; let highSugsCount = 0;
      try {
        const { data: sugs } = await supabase.from('ai_review_suggestions').select('priority, requires_approval').eq('client_id', activeClient.id).eq('status', 'pending');
        if (sugs) { pendingSugsCount = sugs.length; safeSugsCount = sugs.filter(s => !s.requires_approval).length; highSugsCount = sugs.filter(s => s.priority === 'high').length; }
      } catch (e) { console.error('Error fetching suggestions:', e); }

      setSugMetrics({ pending: pendingSugsCount, safe: safeSugsCount, high: highSugsCount });

      setMetrics({
        ...stats, net: stats.income + stats.refunds - stats.expenses,
        topVendor, openRisksCount: risksData?.length || 0, duplicateExposure,
        uniqueVendorsCount: Object.keys(vendors).length,
        matchedInvoicesCount, totalInvoicesCount, overdueInvoicesCount,
        highValueCount, recurringCount, rulesActiveCount, uploadsCount,
        suggestionsCount: pendingSugsCount
      });

      const sortedDailySeries = Object.entries(dailyMap)
        .map(([date, data]) => ({ date, inflow: data.inflow, outflow: data.outflow, rawDate: data.rawDate }))
        .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())
        .slice(-15);
      setChartData(sortedDailySeries);

      const { data: recent } = await supabase
        .from('transactions').select('*').eq('client_id', activeClient.id)
        .order('transaction_date', { ascending: false }).limit(20);
      const cleanRecent = getCleanTransactions(recent || []).slice(0, 6);
      setRecentTransactions(cleanRecent);

    } catch (err: any) {
      console.error('[Dashboard] Fetch error:', err);
      toast(err.message || 'Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => formatINR(val);
  const handleDownloadReport = () => navigate('/reports');

  // ── Risk type grouping for snapshot ──
  const riskSnapshot = React.useMemo(() => {
    const defaultList = [
      { key: 'high_value_payment', label: 'High-Value Payments', desc: 'Transactions exceeding safety threshold', severity: 'medium', count: 0, amount: 0 },
      { key: 'balance_mismatch', label: 'Balance Mismatch', desc: 'Discrepancy between invoice and payment balance', severity: 'high', count: 0, amount: 0 },
      { key: 'duplicate_payment', label: 'Duplicate Suspected', desc: 'Identical amount and recipient markers detected', severity: 'critical', count: 0, amount: 0 },
      { key: 'invoice_payment_mismatch', label: 'Invoice Mismatch', desc: 'Invoices mismatching records or ledger entries', severity: 'high', count: 0, amount: 0 },
      { key: 'unusual_vendor_spend', label: 'Unusual Vendor Spend', desc: 'Spike in vendor payment velocity or frequency', severity: 'medium', count: 0, amount: 0 },
      { key: 'uncategorized_transaction', label: 'Uncategorized Transaction', desc: 'Unmapped spend exceeding ₹50,000 limit', severity: 'low', count: 0, amount: 0 },
    ];

    const groups: Record<string, { count: number; amount: number; severity: string }> = {};
    (openRisksData || []).forEach(r => {
      const key = r.risk_type;
      if (!groups[key]) {
        groups[key] = { count: 0, amount: 0, severity: r.severity };
      }
      groups[key].count++;
      groups[key].amount += Number(r.amount_at_risk || 0);
    });

    return defaultList.map(item => {
      const matchingKeys = Object.keys(groups).filter(k => 
        k === item.key || 
        (item.key === 'duplicate_payment' && k.includes('duplicate')) ||
        (item.key === 'high_value_payment' && k.includes('high_value')) ||
        (item.key === 'invoice_payment_mismatch' && k.includes('invoice')) ||
        (item.key === 'unusual_vendor_spend' && k.includes('vendor')) ||
        (item.key === 'uncategorized_transaction' && k.includes('uncategorized'))
      );
      
      let count = 0;
      let amount = 0;
      let severity = item.severity;
      
      matchingKeys.forEach(k => {
        count += groups[k].count;
        amount += groups[k].amount;
        severity = groups[k].severity || severity;
      });

      return {
        ...item,
        count,
        amount,
        severity
      };
    });
  }, [openRisksData]);

  // Compute total inflow, outflow, and net flow for the Cash Flow chart data
  const { totalInflow, totalOutflow, netChartFlow } = React.useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    chartData.forEach(d => {
      inflow += d.inflow;
      outflow += d.outflow;
    });
    return {
      totalInflow: inflow,
      totalOutflow: outflow,
      netChartFlow: inflow - outflow
    };
  }, [chartData]);

  // ── Custom chart tooltip ──
  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="frosted-popover px-3 py-2.5 text-[12px]" style={{ minWidth: 140 }}>
          <p className="font-semibold text-[var(--muted-foreground)] mb-1.5">{payload[0].payload.date}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: '#168A5B' }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#168A5B' }} />
                Inflow
              </span>
              <span className="font-semibold" style={{ color: '#168A5B' }}>{formatCurrency(payload[0].value)}</span>
            </div>
            {payload[1] && (
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5" style={{ color: '#C2413A' }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#C2413A' }} />
                  Outflow
                </span>
                <span className="font-semibold" style={{ color: '#C2413A' }}>{formatCurrency(payload[1].value)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // ── No client state ──
  if (!activeClient) {
    if (clients && clients.length > 0) {
      return (
        <div className="h-[70vh] flex items-center justify-center animate-kaeo-fade">
          <div className="frosted-card p-10 flex flex-col items-center text-center gap-5 max-w-sm">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-muted border border-border">
              <Plus className="w-7 h-7" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold mb-1">Business not selected</h3>
              <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>Click below to activate your business workspace.</p>
            </div>
            <button onClick={() => setActiveClient(clients[0])} className="btn-primary">
              Use this business
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="h-[70vh] flex items-center justify-center animate-kaeo-fade">
        <EmptyState
          title="Add a business to start reviewing finances"
          description="Add your business details or select a workspace to begin tracking spend."
          action={{
            label: accountMode === 'business_owner' ? 'Add business' : 'Add client business',
            onClick: () => { setModalMode(accountMode === 'business_owner' ? 'create_business' : 'create_client_business'); setClientToEdit(null); setIsCreateModalOpen(true); }
          }}
        />
      </div>
    );
  }

  if (loading && metrics.count === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: 'var(--primary)' }} />
        <p className="text-[13px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
          Loading finance overview…
        </p>
      </div>
    );
  }

  const hasTransactions = metrics.count > 0;

  const getReadinessDesc = () => {
    if (!hasTransactions) return 'Upload data to calculate readiness';
    const risks = metrics.openRisksCount;
    const reviews = metrics.unreviewedCount;
    if (risks === 0 && reviews === 0) {
      return 'Ready for accountant close';
    }
    const parts = [];
    if (risks > 0) parts.push(`${risks} risk${risks > 1 ? 's' : ''}`);
    if (reviews > 0) parts.push(`${reviews} pending review${reviews > 1 ? 's' : ''}`);
    return `Resolve ${parts.join(' and ')}`;
  };

  const isReadinessComplete = metrics.openRisksCount === 0 && metrics.unreviewedCount === 0;

  const suggestedPrompts = [
    { label: 'What changed this month?',        query: 'What changed this month?' },
    { label: 'Show duplicate payments',          query: 'Show duplicate payments' },
    { label: 'Which vendors need review?',       query: 'Which vendors need review?' },
    { label: 'Generate an expense report',       query: 'Generate a monthly expense report' },
    { label: 'Summarize risky spend',            query: 'Summarize risky spend' },
  ];

  return (
    <div className="space-y-7 animate-kaeo-fade pb-16">

      {/* ── Page Header ── */}
      <PageHeader
        title="Finance Review"
        description={`Review spend, risks, and reports for ${getCleanClientName(activeClient.name)}`}
        badge={{ label: 'Live', variant: 'default' }}
        primaryAction={{
          label: 'Generate Report',
          onClick: handleDownloadReport,
          icon: <Download className="w-4 h-4" />
        }}
      />

      {/* ── Profile completion prompt ── */}
      {needsProfileCompletion && !isProfileCardDismissed && (
        <div className="frosted-card p-4 flex items-start justify-between gap-4"
          style={{ borderLeft: '3px solid var(--primary)' }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted border border-border">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="text-[13px] font-semibold mb-0.5">Complete your business profile</h4>
              <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                Add industry, accounting tool, and spend range for better AI suggestions.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => { localStorage.setItem(`kaeo_profile_dismiss_${activeClient.id}`, 'true'); setIsProfileCardDismissed(true); }}
              className="text-[12px] font-medium cursor-pointer transition-colors"
              style={{ color: 'var(--muted-foreground)' }}>
              Dismiss
            </button>
            <button
              onClick={() => { setModalMode(accountMode === 'business_owner' ? 'edit_business' : 'edit_client_business'); setClientToEdit(activeClient); setIsCreateModalOpen(true); }}
              className="btn-primary btn-sm">
              Complete profile
            </button>
          </div>
        </div>
      )}

      {/* ── KPI Row — 8 primary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Spend"
          value={hasTransactions ? formatCurrency(metrics.expenses) : '—'}
          description={hasTransactions ? `${metrics.expenseCount} expense transactions from imported files` : 'Upload a statement to begin review.'}
          trend={undefined}
          icon={<ArrowUpRight className="w-4 h-4" />}
          accentColor={hasTransactions ? 'danger' : 'default'}
          valueClassName={hasTransactions ? 'text-[var(--danger)] text-2xl font-bold' : 'text-[var(--muted-foreground)] text-2xl font-bold'}
          onClick={() => navigate('/transactions?type=expense')}
          askLibbyQuery={hasTransactions ? "Explain why expenses changed this month. (KPI: Total Spend)" : undefined}
        />
        <MetricCard
          title="Money In"
          value={hasTransactions ? formatCurrency(metrics.income) : '—'}
          description={hasTransactions ? `${metrics.incomeCount} inflow transactions from imported files` : 'Upload a statement to begin review.'}
          trend={undefined}
          icon={<ArrowDownLeft className="w-4 h-4" />}
          accentColor={hasTransactions ? 'success' : 'default'}
          valueClassName={hasTransactions ? 'text-[var(--success)] text-2xl font-bold' : 'text-[var(--muted-foreground)] text-2xl font-bold'}
          onClick={() => navigate('/transactions?type=income')}
          askLibbyQuery={hasTransactions ? "Explain why revenue changed this month. (KPI: Money In)" : undefined}
        />
        <MetricCard
          title="Open Risks"
          value={hasTransactions ? metrics.openRisksCount : '—'}
          description={hasTransactions ? (metrics.openRisksCount > 0 ? `${formatCurrency(metrics.duplicateExposure)} duplicate exposure` : 'No compliance issues found') : 'Upload data to calculate risks'}
          trend={undefined}
          icon={<ShieldAlert className="w-4 h-4" />}
          accentColor={hasTransactions ? (metrics.openRisksCount > 0 ? 'danger' : 'success') : 'default'}
          valueClassName={hasTransactions ? `text-2xl font-bold ${metrics.openRisksCount > 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}` : 'text-[var(--muted-foreground)] text-2xl font-bold'}
          onClick={() => navigate('/risk-inbox')}
          askLibbyQuery={hasTransactions ? "Explain my open compliance risks. (KPI: Open Risks)" : undefined}
        />
        <MetricCard
          title="Net Flow"
          value={hasTransactions ? formatCurrency(metrics.net) : '—'}
          description={hasTransactions ? 'Money in minus money out' : 'Upload a statement to begin review.'}
          trend={undefined}
          icon={<DollarSign className="w-4 h-4" />}
          accentColor={hasTransactions ? (metrics.net >= 0 ? 'success' : 'danger') : 'default'}
          valueClassName={hasTransactions ? `text-2xl font-bold ${metrics.net >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}` : 'text-[var(--muted-foreground)] text-2xl font-bold'}
          onClick={() => navigate('/transactions')}
          askLibbyQuery={hasTransactions ? "Explain why net cash changed this month. (KPI: Net Flow)" : undefined}
        />
      </div>

      {/* ── Secondary metrics row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Needs Review"
          value={hasTransactions ? metrics.unreviewedCount : '—'}
          description={hasTransactions ? (metrics.unreviewedCount > 0 ? `${metrics.unreviewedCount} transactions need validation` : 'All entries verified') : 'Upload data to verify'}
          trend={undefined}
          icon={<Clock className="w-4 h-4" />}
          accentColor={hasTransactions ? (metrics.unreviewedCount > 0 ? 'warning' : 'success') : 'default'}
          valueClassName={hasTransactions ? `text-2xl font-bold ${metrics.unreviewedCount > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}` : 'text-[var(--muted-foreground)] text-2xl font-bold'}
          onClick={() => navigate('/transactions?review=pending')}
          askLibbyQuery={hasTransactions ? "Explain what needs review. (KPI: Needs Review)" : undefined}
        />
        <MetricCard
          title="Uncategorized"
          value={hasTransactions ? (metrics.uncategorizedCount + metrics.unknownCount) : '—'}
          description={hasTransactions ? ((metrics.uncategorizedCount + metrics.unknownCount) > 0 ? 'Requires classification' : 'All transactions mapped') : 'Upload data to map'}
          trend={undefined}
          icon={<FileText className="w-4 h-4" />}
          accentColor={hasTransactions ? ((metrics.uncategorizedCount + metrics.unknownCount) > 0 ? 'warning' : 'success') : 'default'}
          valueClassName={hasTransactions ? `text-2xl font-bold ${(metrics.uncategorizedCount + metrics.unknownCount) > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}` : 'text-[var(--muted-foreground)] text-2xl font-bold'}
          onClick={() => navigate('/transactions?category=uncategorized')}
          askLibbyQuery={hasTransactions ? "Explain which transactions are uncategorized. (KPI: Uncategorized)" : undefined}
        />
        <MetricCard
          title="Total Transactions"
          value={hasTransactions ? metrics.count.toLocaleString() : '—'}
          description={hasTransactions ? `${metrics.count.toLocaleString()} transactions in imported files${metrics.uploadsCount > 0 ? ` · across ${metrics.uploadsCount} file${metrics.uploadsCount !== 1 ? 's' : ''}` : ''}` : 'Upload a statement to begin review.'}
          trend={undefined}
          icon={<Layers className="w-4 h-4" />}
          accentColor={hasTransactions ? 'primary' : 'default'}
          valueClassName={hasTransactions ? 'text-[var(--foreground)] text-2xl font-bold' : 'text-[var(--muted-foreground)] text-2xl font-bold'}
          onClick={() => navigate('/transactions')}
          askLibbyQuery={hasTransactions ? "Summarise my transactions. (KPI: Total Transactions)" : undefined}
        />
        <MetricCard
          title="Readiness Score"
          value={hasTransactions && readiness ? `${readiness.score}%` : '—'}
          description={getReadinessDesc()}
          trend={undefined}
          icon={<CheckCircle2 className="w-4 h-4" />}
          accentColor={hasTransactions && readiness ? (isReadinessComplete ? 'success' : 'warning') : 'default'}
          valueClassName={`text-2xl font-bold ${hasTransactions && readiness ? (isReadinessComplete ? 'text-[var(--success)]' : 'text-[var(--warning)]') : 'text-[var(--muted-foreground)]'}`}
          onClick={() => navigate('/reports')}
          askLibbyQuery={hasTransactions ? "How ready am I for month-end close? (KPI: Readiness Score)" : undefined}
        />
      </div>

      {/* ── Main content: Chart + Risk Snapshot ── */}
      {hasTransactions && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Cash Flow Chart */}
          <SectionCard
            title="Cash Flow Overview"
            description="Inflow and outflow activity over the last 15 days"
            className="lg:col-span-2"
            action={
              <AskLibbyButton query="What is my net cash?" label="Ask Libby" variant="inline" />
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">Total Inflow</p>
                  <p className="text-[15px] font-bold text-[var(--success)]">{formatCurrency(totalInflow)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">Total Outflow</p>
                  <p className="text-[15px] font-bold text-[var(--danger)]">{formatCurrency(totalOutflow)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">Net Flow</p>
                  <p className={`text-[15px] font-bold ${netChartFlow >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {formatCurrency(netChartFlow)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]">
                  Last 15 Days
                </span>
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="h-[240px] sm:h-[280px] lg:h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.12}/>
                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.10}/>
                        <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="date" stroke="var(--chart-label)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--chart-label)" fontSize={10} tickLine={false} axisLine={false}
                      tickFormatter={v => `${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Area type="monotone" dataKey="inflow" stroke="var(--success)" strokeWidth={1.75} fillOpacity={1} fill="url(#inflowGrad)" />
                    <Area type="monotone" dataKey="outflow" stroke="var(--danger)" strokeWidth={1.75} fillOpacity={1} fill="url(#outflowGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center">
                <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>No chart data yet</p>
              </div>
            )}
          </SectionCard>

          {/* Risk Snapshot */}
          <SectionCard
            title="Risk Snapshot"
            description="Open issues detected by Kaeo"
            action={
              <div className="flex items-center gap-2">
                <AskLibbyButton query="What risks need review?" label="Ask Libby" variant="inline" />
                <button onClick={() => navigate('/risk-inbox')}
                  className="text-[12px] font-medium flex items-center gap-1 transition-colors"
                  style={{ color: 'var(--primary)' }}>
                  View Inbox <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            }
          >
            <div className="space-y-3">
              {riskSnapshot.map((group, i) => {
                const hasRisks = group.count > 0;
                return (
                  <div key={i}
                    onClick={() => navigate('/risk-inbox')}
                    className={`flex flex-col gap-1.5 p-3 rounded-xl border border-[var(--border)] transition-all cursor-pointer group ${hasRisks ? 'bg-[rgba(224,84,80,0.03)] border-[rgba(224,84,80,0.12)] hover:border-[rgba(224,84,80,0.22)]' : 'bg-transparent hover:bg-[var(--muted)]'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          group.severity === 'critical' || group.severity === 'high' 
                            ? 'risk-dot-critical' 
                            : group.severity === 'medium' 
                              ? 'risk-dot-medium' 
                              : 'risk-dot-low'
                        }`} />
                        <span className="text-[13px] font-semibold truncate text-[var(--foreground)]">
                          {group.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasRisks ? (
                          <span className="chip chip-critical px-2 py-0.5 text-[10px]">
                            {group.count} Open
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-[var(--muted-foreground)] px-2 py-0.5 rounded-full bg-[var(--muted)] border border-[var(--border)]">
                            Clear
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-end justify-between">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-[11px] text-[var(--muted-foreground)] leading-tight mt-0.5">
                          {group.desc}
                        </p>
                        {hasRisks && group.amount > 0 && (
                          <p className="text-[11px] font-semibold text-[var(--danger)]">
                            Exposure: {formatCurrency(group.amount)}
                          </p>
                        )}
                      </div>
                      {hasRisks && (
                        <span className="text-[11px] font-semibold text-[var(--primary)] group-hover:underline flex items-center gap-0.5 flex-shrink-0 ml-2">
                          Review <ChevronRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {!hasTransactions && (
        <div className="frosted-card py-12 px-6 flex flex-col items-center justify-center text-center max-w-xl mx-auto border border-dashed border-[var(--border)] mt-4">
          <FileText className="w-10 h-10 text-[var(--muted-foreground)] mb-4" style={{ opacity: 0.5 }} />
          <h3 className="text-[16px] font-semibold mb-2 text-[var(--foreground)]">No transaction data</h3>
          <p className="text-[13px] text-[var(--muted-foreground)] max-w-sm mb-6">
            Upload a statement to begin review.
          </p>
          <button
            onClick={() => navigate('/files')}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-1" />
            Upload statement
          </button>
        </div>
      )}

      {/* ── Ask Libby Panel ── */}
      <SectionCard
        title="Ask Libby"
        description="Get guided help with risks, transactions, vendors, and reports."
        action={
          <button onClick={() => navigate('/libby')} className="btn-secondary btn-sm">
            Ask Libby
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {suggestedPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-ask-libby', { detail: { query: prompt.query } }));
              }}
              className="text-left px-3.5 py-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-all cursor-pointer group"
            >
              <Sparkles className="w-3.5 h-3.5 mb-1.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[12px] font-medium leading-snug block" style={{ color: 'var(--foreground)' }}>
                {prompt.label}
              </span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── Recent Transactions ── */}
      {recentTransactions.length > 0 && (
        <SectionCard
          title="Recent Transactions"
          description="Latest imported and manually-added entries"
          action={
            <button onClick={() => navigate('/transactions')}
              className="text-[12px] font-medium flex items-center gap-1"
              style={{ color: 'var(--primary)' }}>
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          }
          noPadding
        >
          <div className="overflow-x-auto">
            <table className="kaeo-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map(tx => {
                  const amtVal = tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined
                    ? Number(tx.amount_in_base_currency) : Number(tx.amount);
                  const isInflow = amtVal > 0;
                  const category = getDisplayCategory(tx);
                  return (
                    <tr key={tx.id}
                      onClick={() => navigate(`/transactions?search=${encodeURIComponent(tx.description || '')}`)}
                      className="cursor-pointer">
                      <td className="td-muted whitespace-nowrap">
                        {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                      </td>
                      <td>
                        <div>
                          <p className="text-[13px] font-medium truncate max-w-[220px]" style={{ color: 'var(--foreground)' }}>
                            {tx.counterparty_name || tx.description || 'Unnamed'}
                          </p>
                          {tx.counterparty_name && tx.description && (
                            <p className="text-[11px] truncate max-w-[220px]" style={{ color: 'var(--muted-foreground)' }}>
                              {tx.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-[12px] px-2 py-0.5 rounded font-medium"
                          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                          {category}
                        </span>
                      </td>
                      <td className="td-amount">
                        <span style={{ color: isInflow ? '#168A5B' : '#C2413A' }}>
                          {isInflow ? '+' : ''}{formatCurrency(amtVal)}
                        </span>
                      </td>
                      <td>
                        <StatusChip variant={reviewStatusToVariant(tx.review_status)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── Add Transaction Modal ── */}
      {isAddTxOpen && (
        <div className="kaeo-modal-overlay" onClick={() => setIsAddTxOpen(false)}>
          <div className="kaeo-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-semibold">Add Manual Transaction</h2>
              <button onClick={() => setIsAddTxOpen(false)} className="p-1.5 rounded-lg transition-colors cursor-pointer"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ color: 'var(--muted-foreground)' }}>✕</span>
              </button>
            </div>
            <form onSubmit={handleSaveManualTx} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Date</label>
                  <input type="date" className="kaeo-input" value={manualTxDate} onChange={e => setManualTxDate(e.target.value)} required />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Type</label>
                  <select className="kaeo-input" value={manualTxType} onChange={e => setManualTxType(e.target.value as any)}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="refund">Refund</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Description</label>
                <input type="text" className="kaeo-input" placeholder="Transaction description" value={manualTxDesc} onChange={e => setManualTxDesc(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Amount (₹)</label>
                  <input type="number" min="0" step="0.01" className="kaeo-input" placeholder="0.00" value={manualTxAmt} onChange={e => setManualTxAmt(e.target.value)} required />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Vendor</label>
                  <input type="text" className="kaeo-input" placeholder="Vendor name (optional)" value={manualTxVendor} onChange={e => setManualTxVendor(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  Category <span className="font-normal normal-case tracking-normal">(AI-suggested: <span style={{ color: 'var(--primary)' }}>{manualTxCat}</span>)</span>
                </label>
                <select className="kaeo-input" value={manualTxCat} onChange={e => setManualTxCat(e.target.value)}>
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Review Note</label>
                <input type="text" className="kaeo-input" placeholder="Optional note" value={manualTxNote} onChange={e => setManualTxNote(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsAddTxOpen(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={manualTxSaving} className="btn-primary flex-1 justify-center">
                  {manualTxSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Queue Modal */}
      {isAIQueueOpen && (
        <AIReviewQueueModal
          isOpen={isAIQueueOpen}
          onClose={() => setIsAIQueueOpen(false)}
          onRefreshParent={fetchDashboardData}
        />
      )}
    </div>
  );
};

export default Dashboard;
