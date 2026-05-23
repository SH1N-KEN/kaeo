import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Tag,
  Loader2,
  AlertCircle,
  FileText,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  UploadCloud,
  Copy,
  Filter,
  CheckCircle2,
  CircleDashed,
  EyeOff,
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import EmptyState from '../components/ui/EmptyState';
import {
  getDisplayCategory,
  getCategoryBadgeStyle,
  type TransactionCategory,
} from '../lib/categoryEngine';
import { useToast } from '../hooks/useToast';
import { trackAuditEvent } from '../lib/auditEngine';

// ── Shared INR formatter ─────────────────────────────────────────────────────
const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatINR(amount: number): string {
  return INR.format(Math.abs(amount));
}

// ── Sort types ────────────────────────────────────────────────────────────────
type SortKey = 'transaction_date' | 'description' | 'category' | 'amount' | 'type' | 'source_provider';
type SortDir = 'asc' | 'desc';

// ── Date range presets ────────────────────────────────────────────────────────
type DateRange = 'all' | 'this_month' | 'last_30';

// ── Amount range presets ──────────────────────────────────────────────────────
type AmountRange = 'all' | 'under_10k' | '10k_50k' | 'above_50k';

// ── Review filter ─────────────────────────────────────────────────────────────
type ReviewFilter = 'all' | 'pending' | 'new' | 'needs_review' | 'reviewed' | 'ignored' | 'resolved' | 'uncategorized' | 'unknown' | 'high_value';

const Transactions: React.FC = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState<DateRange>('all');
  const [filterAmountRange, setFilterAmountRange] = useState<AmountRange>('all');
  const [filterReview, setFilterReview] = useState<ReviewFilter>('all');

  // ── Sort state ────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('transaction_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Context menu state ────────────────────────────────────────────────────
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const lastSearchRef = useRef<string | null>(null);

  useEffect(() => {
    const currentSearch = searchParams.toString();
    if (lastSearchRef.current !== null && currentSearch === lastSearchRef.current) {
      return;
    }
    lastSearchRef.current = currentSearch;

    const reviewStatusParam = searchParams.get('review_status');
    const reviewParam = searchParams.get('review');
    const categoryParam = searchParams.get('category');
    const typeParam = searchParams.get('type');

    if (reviewStatusParam === 'needs_review') {
      setFilterReview('needs_review');
    } else if (reviewStatusParam === 'new') {
      setFilterReview('new');
    } else if (reviewStatusParam === 'pending' || reviewParam === 'pending' || reviewStatusParam === 'pending') {
      setFilterReview('pending');
    } else if (reviewStatusParam === 'reviewed') {
      setFilterReview('reviewed');
    } else if (reviewStatusParam === 'ignored') {
      setFilterReview('ignored');
    } else if (reviewStatusParam === 'resolved') {
      setFilterReview('resolved');
    } else if (categoryParam === 'uncategorized') {
      setFilterReview('uncategorized');
    } else if (typeParam === 'unknown') {
      setFilterReview('unknown');
    } else {
      setFilterReview('all');
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeClient) fetchTransactions();
  }, [activeClient]);

  const fetchTransactions = async () => {
    if (!activeClient) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateReviewStatus = async (txId: string, status: string) => {
    if (!activeOrg) return;
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ review_status: status, reviewed_at: new Date().toISOString() })
        .eq('id', txId);
      if (error) throw error;
      
      setTransactions(prev => prev.map(t => t.id === txId ? { ...t, review_status: status } : t));
      toast(`Marked as ${status.replace('_', ' ')}`, 'success');
      
      let actionName = 'transaction_marked_reviewed';
      if (status === 'ignored') actionName = 'transaction_marked_ignored';
      if (status === 'needs_review') actionName = 'transaction_marked_needs_review';
      
      await trackAuditEvent(activeOrg.id, actionName as any, 'transaction', txId, { status });
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  // ── Derive display transactions (category inference) ─────────────────────
  const displayTransactions = useMemo(() => {
    return transactions.map((tx) => ({
      ...tx,
      _displayCategory: getDisplayCategory({
        category: tx.category,
        description: tx.description,
        counterparty_name: tx.counterparty_name,
        type: tx.type,
      }),
    }));
  }, [transactions]);

  // ── Derive filter options ─────────────────────────────────────────────────
  const availableSources = useMemo(() => {
    const seen = new Set<string>();
    displayTransactions.forEach((tx) => {
      if (tx.source_provider) seen.add(tx.source_provider);
    });
    return Array.from(seen).sort();
  }, [displayTransactions]);

  const availableCategories = useMemo(() => {
    const seen = new Set<string>();
    displayTransactions.forEach((tx) => {
      if (tx._displayCategory) seen.add(tx._displayCategory);
    });
    return Array.from(seen).sort() as TransactionCategory[];
  }, [displayTransactions]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return displayTransactions.filter((tx) => {
      // Search
      if (searchTerm) {
        const hay = [tx.description, tx.counterparty_name, tx._displayCategory, tx.source_provider]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(searchTerm.toLowerCase())) return false;
      }

      // Type filter
      if (filterType !== 'all' && tx.type !== filterType) return false;

      // Category filter
      if (filterCategory !== 'all' && tx._displayCategory !== filterCategory) return false;

      // Source filter
      if (filterSource !== 'all' && tx.source_provider !== filterSource) return false;

      // Date range
      if (filterDateRange !== 'all') {
        const txDate = new Date(tx.transaction_date);
        if (filterDateRange === 'this_month' && txDate < startOfMonth) return false;
        if (filterDateRange === 'last_30' && txDate < last30) return false;
      }

      // Amount range (absolute value)
      if (filterAmountRange !== 'all') {
        const abs = Math.abs(tx.amount);
        if (filterAmountRange === 'under_10k' && abs >= 10000) return false;
        if (filterAmountRange === '10k_50k' && (abs < 10000 || abs > 50000)) return false;
        if (filterAmountRange === 'above_50k' && abs <= 50000) return false;
      }

      // Review filter
      if (filterReview !== 'all') {
        const revStatus = tx.review_status || 'new';
        if (filterReview === 'new' && revStatus !== 'new') return false;
        if (filterReview === 'needs_review' && revStatus !== 'needs_review') return false;
        if (filterReview === 'reviewed' && revStatus !== 'reviewed') return false;
        if (filterReview === 'ignored' && revStatus !== 'ignored') return false;
        if (filterReview === 'resolved' && revStatus !== 'resolved') return false;
        if (filterReview === 'pending' && revStatus !== 'new' && revStatus !== 'needs_review') return false;
        if (filterReview === 'uncategorized' && tx._displayCategory !== 'Uncategorized') return false;
        if (filterReview === 'unknown' && tx.type !== 'unknown') return false;
        if (filterReview === 'high_value' && (tx.amount >= 0 || Math.abs(tx.amount) < 50000)) return false;
      }

      return true;
    });
  }, [displayTransactions, searchTerm, filterType, filterCategory, filterSource, filterDateRange, filterAmountRange, filterReview]);

  // ── Sorting ───────────────────────────────────────────────────────────────
  const sortedTransactions = useMemo(() => {
    const arr = [...filteredTransactions];
    arr.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortKey) {
        case 'transaction_date':
          aVal = new Date(a.transaction_date).getTime();
          bVal = new Date(b.transaction_date).getTime();
          break;
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
        case 'category':
          aVal = a._displayCategory ?? '';
          bVal = b._displayCategory ?? '';
          break;
        case 'type':
          aVal = a.type ?? '';
          bVal = b.type ?? '';
          break;
        case 'source_provider':
          aVal = a.source_provider ?? '';
          bVal = b.source_provider ?? '';
          break;
        default:
          aVal = (a[sortKey] ?? '').toString().toLowerCase();
          bVal = (b[sortKey] ?? '').toString().toLowerCase();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredTransactions, sortKey, sortDir]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.amount > 0) inflow += tx.amount;
      else outflow += Math.abs(tx.amount);
    });
    return { inflow, outflow, net: inflow - outflow };
  }, [filteredTransactions]);

  // ── Sort click handler ────────────────────────────────────────────────────
  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir(key === 'transaction_date' ? 'desc' : 'asc');
      }
    },
    [sortKey]
  );

  // ── Clear all filters ─────────────────────────────────────────────────────
  const hasActiveFilters =
    searchTerm ||
    filterType !== 'all' ||
    filterCategory !== 'all' ||
    filterSource !== 'all' ||
    filterDateRange !== 'all' ||
    filterAmountRange !== 'all' ||
    filterReview !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setFilterCategory('all');
    setFilterSource('all');
    setFilterDateRange('all');
    setFilterAmountRange('all');
    setFilterReview('all');
    setSortKey('transaction_date');
    setSortDir('desc');
  };

  // ── Sort indicator icon ───────────────────────────────────────────────────
  const SortIcon: React.FC<{ col: SortKey }> = ({ col }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-primary" />
    ) : (
      <ChevronDown className="w-3 h-3 text-primary" />
    );
  };

  const thClass =
    'px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b border-border/50 select-none cursor-pointer hover:text-foreground transition-colors';

  // ── No workspace ──────────────────────────────────────────────────────────
  if (!activeClient || !activeOrg) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <EmptyState
          title="No client workspace selected"
          description="Select a client workspace to view transaction history."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight mb-1">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Ledger for{' '}
            <span className="text-foreground font-semibold">{activeClient.name}</span>
            {' — '}{transactions.length.toLocaleString()} total rows imported
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-risk/5 border border-risk/20 rounded-xl flex gap-3 items-center text-risk">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-4">
        {/* Row 1: search + type tabs */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search description, counterparty, category, source…"
              className="w-full bg-muted/30 border border-border/40 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/40 focus:border-primary/40 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Type tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'income', 'expense', 'refund', 'unknown'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-all border cursor-pointer ${
                  filterType === t
                    ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/15'
                    : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted'
                }`}
              >
                {t === 'all' ? 'All types' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: secondary filters */}
        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Category */}
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              className="bg-muted/30 border border-border/40 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Source */}
          {availableSources.length > 1 && (
            <select
              className="bg-muted/30 border border-border/40 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
            >
              <option value="all">All Sources</option>
              {availableSources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {/* Date range */}
          <select
            className="bg-muted/30 border border-border/40 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            value={filterDateRange}
            onChange={(e) => setFilterDateRange(e.target.value as DateRange)}
          >
            <option value="all">All time</option>
            <option value="this_month">This month</option>
            <option value="last_30">Last 30 days</option>
          </select>

          {/* Amount range */}
          <select
            className="bg-muted/30 border border-border/40 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            value={filterAmountRange}
            onChange={(e) => setFilterAmountRange(e.target.value as AmountRange)}
          >
            <option value="all">All amounts</option>
            <option value="under_10k">Under ₹10k</option>
            <option value="10k_50k">₹10k – ₹50k</option>
            <option value="above_50k">Above ₹50k</option>
          </select>

          {/* Review status */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              className="bg-muted/30 border border-border/40 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              value={filterReview}
              onChange={(e) => setFilterReview(e.target.value as ReviewFilter)}
            >
              <option value="all">All</option>
              <option value="pending">Pending Review</option>
              <option value="new">New</option>
              <option value="needs_review">Needs Review</option>
              <option value="reviewed">Reviewed</option>
              <option value="ignored">Ignored</option>
              <option value="resolved">Resolved</option>
              {filterReview === 'uncategorized' && (
                <option value="uncategorized">Uncategorized</option>
              )}
              {filterReview === 'unknown' && (
                <option value="unknown">Unknown Rows</option>
              )}
              {filterReview === 'high_value' && (
                <option value="high_value">High-value expenses</option>
              )}
            </select>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-muted-foreground hover:text-foreground border border-border/40 hover:border-border bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
            Showing
          </p>
          <p className="text-lg font-black text-foreground">
            {filteredTransactions.length.toLocaleString()}
            <span className="text-xs font-semibold text-muted-foreground ml-1">/ {transactions.length}</span>
          </p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
            Inflow
          </p>
          <p className="text-lg font-black text-success flex items-center justify-center gap-1">
            <TrendingUp className="w-4 h-4" />
            {formatINR(summary.inflow)}
          </p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
            Outflow
          </p>
          <p className="text-lg font-black text-risk flex items-center justify-center gap-1">
            <TrendingDown className="w-4 h-4" />
            {formatINR(summary.outflow)}
          </p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl p-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
            Net
          </p>
          <p className={`text-lg font-black flex items-center justify-center gap-1 ${summary.net >= 0 ? 'text-success' : 'text-risk'}`}>
            <Minus className="w-4 h-4" />
            {summary.net >= 0 ? '+' : '-'}{formatINR(summary.net)}
          </p>
        </div>
      </div>

      {/* ── Table ── */}
      {loading && transactions.length === 0 ? (
        <div className="h-[40vh] flex flex-col items-center justify-center space-y-4 bg-card border rounded-2xl">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse font-medium">Loading ledger…</p>
        </div>
      ) : transactions.length === 0 ? (
        /* No data at all */
        <div className="bg-card border rounded-2xl p-16 text-center space-y-5">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto">
            <UploadCloud className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <div>
            <h3 className="text-lg font-black mb-1">No transactions yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Upload a CSV/XLSX statement to see transactions here.
            </p>
          </div>
          <Link
            to="/files"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-95 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            Go to Files
          </Link>
        </div>
      ) : sortedTransactions.length === 0 ? (
        /* Filters returned nothing */
        <div className="bg-card border rounded-2xl p-16 text-center space-y-5">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <div>
            <h3 className="text-lg font-black mb-1">
              {filterReview === 'pending'
                ? "All transactions are reviewed."
                : filterReview !== 'all'
                ? "No transactions match this review filter."
                : "No transactions match these filters."}
            </h3>
            <p className="text-sm text-muted-foreground">
              {filterReview === 'pending'
                ? "You're all caught up with your review checklist."
                : "Try adjusting or clearing your filters."}
            </p>
          </div>
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-muted text-foreground border border-border rounded-xl text-sm font-bold hover:bg-muted/80 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-muted/40">
                  <th
                    className={thClass}
                    onClick={() => handleSort('transaction_date')}
                  >
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Date
                      <SortIcon col="transaction_date" />
                    </span>
                  </th>
                  <th
                    className={thClass}
                    onClick={() => handleSort('description')}
                  >
                    <span className="flex items-center gap-1.5">
                      Description
                      <SortIcon col="description" />
                    </span>
                  </th>
                  <th
                    className={thClass}
                    onClick={() => handleSort('category')}
                  >
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      Category
                      <SortIcon col="category" />
                    </span>
                  </th>
                  <th
                    className={`${thClass} text-right`}
                    onClick={() => handleSort('amount')}
                  >
                    <span className="flex items-center justify-end gap-1.5">
                      Amount
                      <SortIcon col="amount" />
                    </span>
                  </th>
                  <th
                    className={`${thClass} text-center`}
                    onClick={() => handleSort('type')}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      Type
                      <SortIcon col="type" />
                    </span>
                  </th>
                  <th
                    className={thClass}
                    onClick={() => handleSort('source_provider')}
                  >
                    <span className="flex items-center gap-1.5">
                      Source
                      <SortIcon col="source_provider" />
                    </span>
                  </th>
                  <th
                    className={thClass}
                  >
                    Status
                  </th>
                  <th className="px-4 py-3 border-b border-border/50 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sortedTransactions.map((tx) => {
                  const cat = tx._displayCategory as TransactionCategory;
                  const badge = getCategoryBadgeStyle(cat);
                  const isExpense = tx.amount < 0;
                  const isMenuOpen = openMenuId === tx.id;

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-muted/20 transition-colors group relative"
                      onClick={() => { if (isMenuOpen) setOpenMenuId(null); }}
                    >
                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {new Date(tx.transaction_date).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {tx.description}
                          </span>
                          {tx.counterparty_name && (
                            <span className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {tx.counterparty_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {cat}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`text-sm font-black flex items-center justify-end gap-1 ${
                            isExpense ? 'text-risk' : 'text-success'
                          }`}
                        >
                          {isExpense ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          )}
                          {isExpense ? '-' : '+'}
                          {formatINR(tx.amount)}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <TypeBadge type={tx.type} />
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted/40 px-2 py-1 rounded border border-border/30">
                          {tx.source_provider || 'Manual'}
                        </span>
                      </td>

                      {/* Review Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <ReviewBadge status={tx.review_status || 'new'} />
                      </td>

                      {/* Row actions */}
                      <td className="px-3 py-3 text-right relative">
                        <button
                          className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(isMenuOpen ? null : tx.id);
                          }}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="4" cy="10" r="1.5" />
                            <circle cx="10" cy="10" r="1.5" />
                            <circle cx="16" cy="10" r="1.5" />
                          </svg>
                        </button>

                        {isMenuOpen && (
                          <div
                            className="absolute right-4 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer flex items-center gap-2"
                              onClick={() => {
                                navigator.clipboard.writeText(tx.description);
                                toast('Description copied', 'success');
                                setOpenMenuId(null);
                              }}
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Copy description
                            </button>
                            <button
                              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer flex items-center gap-2"
                              onClick={() => {
                                setFilterCategory(tx._displayCategory);
                                setOpenMenuId(null);
                              }}
                            >
                              <Tag className="w-3.5 h-3.5" />
                              Filter by category
                            </button>
                            <button
                              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer flex items-center gap-2"
                              onClick={() => {
                                if (tx.source_provider) setFilterSource(tx.source_provider);
                                setOpenMenuId(null);
                              }}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Filter by source
                            </button>
                            <div className="h-px bg-border my-1 mx-2" />
                            <button
                              className="w-full text-left px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-success hover:bg-success/10 transition-colors cursor-pointer flex items-center gap-2"
                              onClick={() => {
                                updateReviewStatus(tx.id, 'reviewed');
                                setOpenMenuId(null);
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Mark Reviewed
                            </button>
                            <button
                              className="w-full text-left px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer flex items-center gap-2"
                              onClick={() => {
                                updateReviewStatus(tx.id, 'needs_review');
                                setOpenMenuId(null);
                              }}
                            >
                              <CircleDashed className="w-3.5 h-3.5" />
                              Needs Review
                            </button>
                            <button
                              className="w-full text-left px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center gap-2"
                              onClick={() => {
                                updateReviewStatus(tx.id, 'resolved');
                                setOpenMenuId(null);
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                              Mark Resolved
                            </button>
                            <button
                              className="w-full text-left px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-2"
                              onClick={() => {
                                updateReviewStatus(tx.id, 'ignored');
                                setOpenMenuId(null);
                              }}
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                              Ignore
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Type badge sub-component ─────────────────────────────────────────────────
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  income: { bg: 'bg-success/10', text: 'text-success' },
  refund: { bg: 'bg-success/10', text: 'text-success' },
  expense: { bg: 'bg-risk/10', text: 'text-risk' },
  vendor_payment: { bg: 'bg-risk/10', text: 'text-risk' },
  subscription: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  unknown: { bg: 'bg-muted/60', text: 'text-muted-foreground' },
  failed_payment: { bg: 'bg-muted/60', text: 'text-muted-foreground' },
};

const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const colors = TYPE_COLORS[type] ?? { bg: 'bg-muted/40', text: 'text-muted-foreground' };
  const label = type.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  );
};

const REVIEW_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: 'bg-muted/40', text: 'text-muted-foreground' },
  needs_review: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  reviewed: { bg: 'bg-success/10', text: 'text-success' },
  ignored: { bg: 'bg-muted/30', text: 'text-muted-foreground/50' },
  resolved: { bg: 'bg-primary/10', text: 'text-primary' },
};

const ReviewBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors = REVIEW_COLORS[status] ?? REVIEW_COLORS.new;
  const label = status.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  );
};

export default Transactions;
