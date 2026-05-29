import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Calendar,
  Tag,
  Loader2,
  AlertCircle,
  FileText,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  UploadCloud,
  Copy,
  Filter,
  CheckCircle2,
  CircleDashed,
  EyeOff,
  Plus,
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import EmptyState from '../components/ui/EmptyState';
import {
  getDisplayCategory,
  getCategoryBadgeStyle,
  type TransactionCategory,
} from '../lib/categoryEngine';
import { getCleanTransactions } from '../lib/transactionFilters';
import { useToast } from '../hooks/useToast';
import { trackAuditEvent } from '../lib/auditEngine';
import { AIReviewQueueModal } from '../components/ai/AIReviewQueueModal';
import { applyReviewSuggestion } from '../lib/reviewActions';
import { Sparkles } from 'lucide-react';
import { formatCurrency, formatSignedCurrency } from '../lib/formatters';
import { useWorkspaceRefresh } from '../hooks/useWorkspaceRefresh';

// ── Sort types ────────────────────────────────────────────────────────────────
type SortKey = 'transaction_date' | 'description' | 'category' | 'amount' | 'type' | 'source_provider' | 'review_status' | 'counterparty_name';
type SortDir = 'asc' | 'desc';

// ── Date range presets ────────────────────────────────────────────────────────
type DateRange = 'all' | 'this_month' | 'last_30';

// ── Amount range presets ──────────────────────────────────────────────────────
type AmountRange = 'all' | 'under_10k' | '10k_50k' | 'above_50k';

// ── Review filter ─────────────────────────────────────────────────────────────
type ReviewFilter = 'all' | 'pending' | 'new' | 'needs_review' | 'reviewed' | 'ignored' | 'resolved' | 'uncategorized' | 'unknown' | 'high_value' | 'ai_suggested';

const Transactions: React.FC = () => {
  const { 
    activeClient, 
    activeOrg,
    accountMode,
    setModalMode,
    setClientToEdit,
    setIsCreateModalOpen,
    clients,
    setActiveClient
  } = useWorkspace();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [filterTransactionId, setFilterTransactionId] = useState<string | null>(null);
  const [filterTransactionIds, setFilterTransactionIds] = useState<string[] | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // ── Sort state ────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('transaction_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Context menu state ────────────────────────────────────────────────────
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [isAIQueueOpen, setIsAIQueueOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any | null>(null);

  const handleApproveSuggestion = async (sug: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await applyReviewSuggestion(sug, 'approved', user?.id);
      toast('AI category suggestion approved and applied', 'success');
      fetchTransactions();
    } catch (err: any) {
      toast(err.message || 'Approval failed', 'error');
    }
  };

  const handleRejectSuggestion = async (sug: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await applyReviewSuggestion(sug, 'rejected', user?.id);
      toast('AI suggestion rejected', 'info');
      fetchTransactions();
    } catch (err: any) {
      toast(err.message || 'Rejection failed', 'error');
    }
  };

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
    const sourceParam = searchParams.get('source');
    const searchParamVal = searchParams.get('search');

    if (searchParamVal) {
      setSearchTerm(searchParamVal);
    } else {
      setSearchTerm('');
    }

    // 1. Review status query param mapping
    if (reviewStatusParam === 'needs_review') {
      setFilterReview('needs_review');
    } else if (reviewStatusParam === 'new') {
      setFilterReview('new');
    } else if (reviewStatusParam === 'pending' || reviewParam === 'pending') {
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

    // 2. Category mapping
    if (categoryParam === 'uncategorized') {
      setFilterCategory('Uncategorized');
    } else if (categoryParam) {
      setFilterCategory(categoryParam);
    } else {
      setFilterCategory('all');
    }

    // 3. Type mapping
    if (typeParam) {
      if (['income', 'expense', 'refund', 'unknown'].includes(typeParam)) {
        setFilterType(typeParam);
      }
    } else {
      setFilterType('all');
    }

    // 4. Source mapping
    if (sourceParam) {
      setFilterSource(sourceParam);
    } else {
      setFilterSource('all');
    }

    // 5. Transaction ID mapping
    const transactionIdParam = searchParams.get('transactionId') || searchParams.get('txId');
    const transactionIdsParam = searchParams.get('transactionIds');

    if (transactionIdParam) {
      setFilterTransactionId(transactionIdParam);
    } else {
      setFilterTransactionId(null);
    }

    if (transactionIdsParam) {
      setFilterTransactionIds(transactionIdsParam.split(',').filter(Boolean));
    } else {
      setFilterTransactionIds(null);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeClient) fetchTransactions();
  }, [activeClient]);

  useEffect(() => {
    if (!loading && (filterTransactionId || (filterTransactionIds && filterTransactionIds.length > 0))) {
      const targetId = filterTransactionId || filterTransactionIds?.[0];
      if (targetId) {
        const timer = setTimeout(() => {
          const el = document.getElementById(`tx-row-${targetId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, filterTransactionId, filterTransactionIds]);

  // Re-fetch when Libby applies a transaction action workspace-wide
  useWorkspaceRefresh(useCallback(() => {
    if (activeClient) fetchTransactions();
  }, [activeClient]));

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

      const { data: sugs, error: sugsError } = await supabase
        .from('ai_review_suggestions')
        .select('*')
        .eq('client_id', activeClient.id)
        .eq('status', 'pending');
      
      if (sugsError) throw sugsError;
      setSuggestions(sugs || []);
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
    const cleanTxs = getCleanTransactions(transactions);
    const metadataCount = transactions.length - cleanTxs.length;
    console.log('metadataRowsFiltered =', metadataCount);

    return cleanTxs.map((tx) => ({
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
      // Transaction ID overrides (bypasses standard search/filters)
      if (filterTransactionId) {
        return tx.id === filterTransactionId;
      }
      if (filterTransactionIds && filterTransactionIds.length > 0) {
        return filterTransactionIds.includes(tx.id);
      }

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
        const amtVal = tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined
          ? Number(tx.amount_in_base_currency)
          : Number(tx.amount);
        const abs = Math.abs(amtVal);
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
        if (filterReview === 'ai_suggested') {
          const hasSug = suggestions.some(s => s.entity_type === 'transaction' && s.entity_id === tx.id);
          if (!hasSug) return false;
        }
      }

      return true;
    });
  }, [displayTransactions, searchTerm, filterType, filterCategory, filterSource, filterDateRange, filterAmountRange, filterReview, filterTransactionId, filterTransactionIds, suggestions]);

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
          aVal = a.amount_in_base_currency !== null && a.amount_in_base_currency !== undefined ? a.amount_in_base_currency : a.amount;
          bVal = b.amount_in_base_currency !== null && b.amount_in_base_currency !== undefined ? b.amount_in_base_currency : b.amount;
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
        case 'review_status':
          aVal = a.review_status || 'new';
          bVal = b.review_status || 'new';
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
      const amtVal = tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined
        ? Number(tx.amount_in_base_currency)
        : Number(tx.amount);
      if (amtVal > 0) inflow += amtVal;
      else outflow += Math.abs(amtVal);
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
    filterReview !== 'all' ||
    filterTransactionId ||
    (filterTransactionIds && filterTransactionIds.length > 0);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
    setFilterCategory('all');
    setFilterSource('all');
    setFilterDateRange('all');
    setFilterAmountRange('all');
    setFilterReview('all');
    setFilterTransactionId(null);
    setFilterTransactionIds(null);
    setSortKey('transaction_date');
    setSortDir('desc');
    navigate('/transactions');
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

  if (!activeClient || !activeOrg) {
    if (clients && clients.length > 0) {
      return (
        <div className="h-[70vh] flex items-center justify-center animate-in fade-in">
          <div className="premium-glass border border-border/40 rounded-3xl p-10 flex flex-col items-center justify-center text-center space-y-5 max-w-md shadow-xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20 shadow-inner">
              <Plus className="w-8 h-8 text-teal-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold tracking-tight">We found your business but it was not selected.</h3>
              <p className="text-xs text-muted-foreground font-medium">
                Click below to start using your business workspace.
              </p>
            </div>
            <button 
              onClick={() => {
                setActiveClient(clients[0]);
              }}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-all shadow-xl shadow-primary/20 cursor-pointer text-xs"
            >
              Use this business
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-[70vh] flex items-center justify-center animate-in fade-in">
        <EmptyState
          title="Transactions appear after you add a business and upload files."
          description="Complete your business profile or select a workspace to view transactions ledger."
          action={{
            label: accountMode === 'business_owner' ? "Add business" : "Add client business",
            onClick: () => {
              setModalMode(accountMode === 'business_owner' ? 'create_business' : 'create_client_business');
              setClientToEdit(null);
              setIsCreateModalOpen(true);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-kaeo-fade pb-24">
      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-1">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle mt-1">
            Review, categorize, and approve imported ledger rows for <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{activeClient.name}</span>.
          </p>
        </div>
        <div className="flex gap-2.5 flex-shrink-0">
          <button
            onClick={() => setIsAIQueueOpen(true)}
            className="btn-secondary flex items-center gap-1.5 border-border/40 hover:bg-muted/30"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" /> AI Suggestions
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl flex gap-3 items-center" style={{ background: 'rgba(194,65,58,0.06)', border: '1px solid rgba(194,65,58,0.20)', color: '#C2413A' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="text-[13px] font-medium">{error}</p>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="kaeo-card p-4 space-y-3.5 bg-card/40 border-border/30 backdrop-blur-md rounded-xl">
        {/* Row 1: search + type tabs */}
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-muted-foreground" />
            <input
              type="text"
              placeholder="Search description, counterparty, category…"
              className="kaeo-input text-xs py-2 bg-background/50 border-border/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 rounded-lg"
              style={{ paddingLeft: '2.5rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Type tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'income', 'expense', 'refund', 'transfer', 'unknown'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-all border cursor-pointer ${
                  filterType === t
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                    : 'border-border/30 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
                style={filterType !== t ? { background: 'var(--card)' } : {}}
              >
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: secondary filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Review status */}
          <select
            className="kaeo-input text-xs py-1.5 px-3 bg-background/50 border-border/30 rounded-lg cursor-pointer hover:bg-background/80 transition-colors"
            style={{ width: 'auto' }}
            value={filterReview}
            onChange={(e) => setFilterReview(e.target.value as ReviewFilter)}
          >
            <option value="all">All review statuses</option>
            <option value="pending">Pending Review</option>
            <option value="new">New</option>
            <option value="needs_review">Needs Review</option>
            <option value="reviewed">Reviewed</option>
            <option value="ignored">Ignored</option>
            <option value="resolved">Resolved</option>
            <option value="ai_suggested">AI Suggested</option>
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

          {/* Category */}
          <select
            className="kaeo-input text-xs py-1.5 px-3 bg-background/50 border-border/30 rounded-lg cursor-pointer hover:bg-background/80 transition-colors"
            style={{ width: 'auto' }}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Date range */}
          <select
            className="kaeo-input text-xs py-1.5 px-3 bg-background/50 border-border/30 rounded-lg cursor-pointer hover:bg-background/80 transition-colors"
            style={{ width: 'auto' }}
            value={filterDateRange}
            onChange={(e) => setFilterDateRange(e.target.value as DateRange)}
          >
            <option value="all">All time</option>
            <option value="this_month">This month</option>
            <option value="last_30">Last 30 days</option>
          </select>

          {/* Toggle More Filters */}
          <button
            onClick={() => setShowMoreFilters(prev => !prev)}
            className="px-3 py-1.5 bg-background/50 hover:bg-background/80 border border-border/30 text-[11px] font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Filter className="w-3 h-3 text-muted-foreground" />
            {showMoreFilters ? 'Fewer' : 'More'}
            {showMoreFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Collapsible Advanced Filters */}
          {showMoreFilters && (
            <div className="flex flex-wrap gap-2 items-center animate-kaeo-fade">
              {availableSources.length > 1 && (
                <select
                  className="kaeo-input text-xs py-1.5 px-3 bg-background/50 border-border/30 rounded-lg cursor-pointer hover:bg-background/80 transition-colors"
                  style={{ width: 'auto' }}
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                >
                  <option value="all">All Sources</option>
                  {availableSources.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
              <select
                className="kaeo-input text-xs py-1.5 px-3 bg-background/50 border-border/30 rounded-lg cursor-pointer hover:bg-background/80 transition-colors"
                style={{ width: 'auto' }}
                value={filterAmountRange}
                onChange={(e) => setFilterAmountRange(e.target.value as AmountRange)}
              >
                <option value="all">All amounts</option>
                <option value="under_10k">Under ₹10k</option>
                <option value="10k_50k">₹10k – ₹50k</option>
                <option value="above_50k">Above ₹50k</option>
              </select>
            </div>
          )}

          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors ml-2"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Showing', value: `${filteredTransactions.length.toLocaleString()} / ${transactions.length}`, color: 'var(--foreground)' },
          { label: 'Inflow', value: formatCurrency(summary.inflow), color: 'var(--success)' },
          { label: 'Outflow', value: formatCurrency(summary.outflow), color: 'var(--danger)' },
          { label: 'Net', value: formatSignedCurrency(summary.net), color: summary.net >= 0 ? 'var(--success)' : 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className="kaeo-card p-4 rounded-xl bg-card/45 border-border/30 backdrop-blur-md flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1">{s.label}</span>
            <span className="text-lg font-bold tracking-tight" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      {loading && transactions.length === 0 ? (
        <div className="kaeo-card h-[40vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
          <p className="text-[13px] font-medium text-muted-foreground">Loading ledger…</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="kaeo-card p-8 rounded-xl border-border/30">
          <EmptyState
            icon={<UploadCloud className="w-8 h-8 text-muted-foreground/50" />}
            title="Upload a statement to start reviewing transactions."
            description="Import a PDF bank statement or a CSV file to populate your ledger."
            action={{ 
              label: 'Go to Files', 
              onClick: () => navigate('/files') 
            }}
          />
        </div>
      ) : sortedTransactions.length === 0 ? (
        <div className="kaeo-card p-8 rounded-xl border-border/30">
          {filterTransactionId || (filterTransactionIds && filterTransactionIds.length > 0) ? (
            <EmptyState
              icon={<AlertCircle className="w-8 h-8 text-muted-foreground/50" />}
              title="Transaction not found"
              description="No matching transaction found for this risk. The transaction may have been deleted, filtered out, or imported under another client."
              action={{ label: 'View all transactions', onClick: clearFilters }}
            />
          ) : (
            <EmptyState
              icon={<FileText className="w-8 h-8 text-muted-foreground/50" />}
              title="No transactions match"
              description="Try adjusting or clearing your filters."
              action={{ label: 'Clear filters', onClick: clearFilters }}
            />
          )}
        </div>
      ) : (
        <div className="kaeo-card rounded-xl border-border/30 overflow-hidden shadow-sm bg-card/30 backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="kaeo-table min-w-[860px]">
              <thead>
                <tr className="bg-muted/30">
                  <th
                    className={thClass}
                    onClick={() => handleSort('transaction_date')}
                    style={{ width: '100px' }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Date
                      <SortIcon col="transaction_date" />
                    </span>
                  </th>
                  <th
                    className={thClass}
                    onClick={() => handleSort('counterparty_name')}
                  >
                    <span className="flex items-center gap-1.5">
                      Vendor / Description
                      <SortIcon col="counterparty_name" />
                    </span>
                  </th>
                  <th
                    className={thClass}
                    onClick={() => handleSort('category')}
                    style={{ width: '150px' }}
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
                    style={{ width: '130px' }}
                  >
                    <span className="flex items-center justify-end gap-1.5">
                      Amount
                      <SortIcon col="amount" />
                    </span>
                  </th>
                  <th
                    className={`${thClass} text-center`}
                    style={{ width: '110px' }}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      Confidence
                    </span>
                  </th>
                  <th
                    className={`${thClass} text-center`}
                    style={{ width: '150px' }}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      Risk
                    </span>
                  </th>
                  <th
                    className={thClass}
                    onClick={() => handleSort('review_status')}
                    style={{ width: '120px' }}
                  >
                    <span className="flex items-center gap-1.5">
                      Status
                      <SortIcon col="review_status" />
                    </span>
                  </th>
                  <th className="px-4 py-3 border-b border-border/50 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {sortedTransactions.map((tx) => {
                  const cat = tx._displayCategory as TransactionCategory;
                  const badge = getCategoryBadgeStyle(cat);
                  const isMenuOpen = openMenuId === tx.id;
 
                  const isHighlighted = tx.id === filterTransactionId || (filterTransactionIds && filterTransactionIds.includes(tx.id));
 
                  return (
                    <tr
                      key={tx.id}
                      id={`tx-row-${tx.id}`}
                      className={`group relative border-b border-border/10 hover:bg-muted/20 transition-colors duration-150 ${isHighlighted ? 'bg-teal-500/5' : ''}`}
                      style={isHighlighted ? { borderLeft: '3px solid #2FB8A6' } : {}}
                      onClick={() => { if (isMenuOpen) setOpenMenuId(null); }}
                    >
                      {/* Date */}
                      <td className="whitespace-nowrap td-muted px-4 py-3.5 text-xs text-muted-foreground font-medium">
                        {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
 
                      {/* Counterparty + Description */}
                      <td className="max-w-[280px] px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-bold block truncate text-[var(--foreground)]">
                            {tx.counterparty_name && tx.counterparty_name !== 'No counterparty' ? tx.counterparty_name : (tx.description?.split(' ')[0] || 'Unknown Vendor')}
                          </span>
                          <span className="text-[11px] block truncate text-[var(--muted-foreground)] font-normal" title={tx.description}>
                            {tx.description}
                          </span>
                        </div>
                      </td>
 
                      {/* Category badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {(() => {
                          const categorySuggestion = suggestions.find(
                            s => s.entity_type === 'transaction' && 
                            s.entity_id === tx.id && 
                            s.suggestion_type === 'categorize_transaction'
                          );
 
                          if (categorySuggestion) {
                            return (
                              <div className="flex flex-col gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                                >
                                  {cat}
                                </span>
                                <div className="text-[10px] bg-primary/5 text-primary border border-primary/20 p-2 rounded-lg mt-1 flex flex-col gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSuggestion(categorySuggestion);
                                    }}
                                    className="flex items-center justify-between gap-1 w-full text-left font-bold cursor-pointer hover:underline text-primary bg-transparent border-none p-0"
                                  >
                                    <span className="flex items-center gap-1">
                                      <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                                      Suggested: {categorySuggestion.proposed_value.category}
                                    </span>
                                    <span className="text-[9px] underline opacity-80 shrink-0">View</span>
                                  </button>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleApproveSuggestion(categorySuggestion);
                                      }}
                                      className="px-2 py-0.5 bg-[var(--success)] text-white text-[9px] font-black rounded hover:bg-success/80 transition-all cursor-pointer"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRejectSuggestion(categorySuggestion);
                                      }}
                                      className="px-2 py-0.5 bg-[var(--danger)] text-white text-[9px] font-black rounded hover:bg-risk/80 transition-all cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          }
 
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {cat}
                            </span>
                          );
                        })()}
                      </td>
 
                      {/* Amount */}
                      <td className="td-amount whitespace-nowrap px-4 py-3.5 text-right font-semibold text-[13px]">
                        {(() => {
                          const displayAmt = tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined
                            ? tx.amount_in_base_currency : tx.amount;
                          const dirDerived = tx.raw_row_json?.direction_derived;
                          const isOutflow = dirDerived === 'outflow' || (!dirDerived && Number(displayAmt) < 0);
                          const isTransfer = tx.type === 'transfer';
                          const isRefund = tx.type === 'refund';
                          const amtColor = isTransfer ? '#2563EB' : isRefund ? 'var(--accent)' : isOutflow ? 'var(--danger)' : 'var(--success)';
                          const signedAmt = displayAmt === 0 ? 0 : (isOutflow ? -Math.abs(Number(displayAmt)) : Math.abs(Number(displayAmt)));
                          return (
                            <span className="text-[13px] font-semibold" style={{ color: amtColor }}>
                              {formatSignedCurrency(signedAmt)}
                            </span>
                          );
                        })()}
                      </td>
 
                      {/* Confidence */}
                      <td className="text-center whitespace-nowrap px-4 py-3.5">
                        {(() => {
                          const conf = tx.raw_row_json?.intelligence?.intelligence_confidence || (tx.review_status === 'reviewed' ? 'high' : 'medium');
                          const confCfg: Record<string, { label: string; style?: React.CSSProperties }> = {
                            high:   { label: 'High',   style: { background: 'rgba(22, 138, 91, 0.06)', color: 'var(--success)', borderColor: 'rgba(22, 138, 91, 0.15)' } },
                            medium: { label: 'Medium', style: { background: 'rgba(183, 121, 31, 0.06)', color: 'var(--warning)', borderColor: 'rgba(183, 121, 31, 0.15)' } },
                            low:    { label: 'Low',    style: { background: 'rgba(194, 65, 58, 0.06)',  color: 'var(--danger)',  borderColor: 'rgba(194, 65, 58, 0.15)' } },
                          };
                          const cfg = confCfg[conf] || confCfg.medium;
                          return (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border" style={cfg.style}>
                              {cfg.label}
                            </span>
                          );
                        })()}
                      </td>
 
                      {/* Risk */}
                      <td className="text-center whitespace-nowrap px-4 py-3.5">
                        {(() => {
                          const amtVal = tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined
                            ? Number(tx.amount_in_base_currency) : Number(tx.amount);
                          const isHighValue = Math.abs(amtVal) >= 50000 && ['expense', 'vendor_payment', 'subscription'].includes(tx.type);
                          const isMismatch = !!tx.raw_row_json?.metadata?.balance_mismatch;
                          const isUncategorized = cat === 'Uncategorized';
                          
                          let riskLabel = 'Clear';
                          let riskStyle: React.CSSProperties = { background: 'rgba(22, 138, 91, 0.06)', color: 'var(--success)', borderColor: 'rgba(22, 138, 91, 0.15)' };
                          
                          if (isMismatch) {
                            riskLabel = 'Balance Mismatch';
                            riskStyle = { background: 'rgba(194, 65, 58, 0.08)', color: 'var(--danger)', borderColor: 'rgba(194, 65, 58, 0.18)' };
                          } else if (isHighValue) {
                            riskLabel = 'High-Value';
                            riskStyle = { background: 'rgba(183, 121, 31, 0.08)', color: 'var(--warning)', borderColor: 'rgba(183, 121, 31, 0.18)' };
                          } else if (isUncategorized) {
                            riskLabel = 'Uncategorized';
                            riskStyle = { background: 'rgba(93, 107, 102, 0.08)', color: 'var(--muted-foreground)', borderColor: 'rgba(93, 107, 102, 0.18)' };
                          }
                          
                          return (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border" style={riskStyle}>
                              {riskLabel}
                            </span>
                          );
                        })()}
                      </td>
 
                      {/* Review Status */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-center">
                        <ReviewBadge status={tx.review_status || 'new'} />
                      </td>
 
                      {/* Row actions */}
                      <td className="text-right relative px-4 py-3.5 w-10">
                        <button
                          className="p-1.5 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                          style={{ color: 'var(--muted-foreground)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
                            className="absolute right-4 top-full mt-1 w-48 kaeo-popover z-50 animate-kaeo-scale"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[
                              { icon: <Copy className="w-3.5 h-3.5" />, label: 'Copy description', onClick: () => { navigator.clipboard.writeText(tx.description); toast('Copied', 'success'); setOpenMenuId(null); } },
                              { icon: <Tag className="w-3.5 h-3.5" />, label: 'Filter by category', onClick: () => { setFilterCategory(tx._displayCategory); setOpenMenuId(null); } },
                            ].map(action => (
                              <button key={action.label}
                                className="w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium flex items-center gap-2 cursor-pointer transition-all"
                                style={{ color: 'var(--muted-foreground)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--muted)'; e.currentTarget.style.color = 'var(--foreground)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; }}
                                onClick={action.onClick}
                              >
                                {action.icon} {action.label}
                              </button>
                            ))}
                            <div className="h-px mx-1 my-1" style={{ background: 'var(--border)' }} />
                            {[
                              { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Mark Reviewed', status: 'reviewed', hoverColor: '#168A5B' },
                              { icon: <CircleDashed className="w-3.5 h-3.5" />, label: 'Needs Review', status: 'needs_review', hoverColor: '#B7791F' },
                              { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Resolve', status: 'resolved', hoverColor: '#0F766E' },
                              { icon: <EyeOff className="w-3.5 h-3.5" />, label: 'Ignore', status: 'ignored', hoverColor: '#5D6B66' },
                            ].map(action => (
                              <button key={action.status}
                                className="w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium flex items-center gap-2 cursor-pointer transition-all"
                                style={{ color: 'var(--muted-foreground)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--muted)'; e.currentTarget.style.color = action.hoverColor; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; }}
                                onClick={() => { updateReviewStatus(tx.id, action.status); setOpenMenuId(null); }}
                              >
                                {action.icon} {action.label}
                              </button>
                            ))}
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
      <AIReviewQueueModal 
        isOpen={isAIQueueOpen} 
        onClose={() => setIsAIQueueOpen(false)} 
        onRefreshParent={fetchTransactions} 
      />

      {/* Selected Suggestion Detail Modal */}
      {selectedSuggestion && (
        <div className="kaeo-modal-overlay" onClick={() => setSelectedSuggestion(null)}>
          <div className="kaeo-modal max-w-md bg-card/95 border-border/50 backdrop-blur-xl rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                <h2 className="text-base font-bold text-foreground">AI Review Suggestion</h2>
              </div>
              <button type="button" onClick={() => setSelectedSuggestion(null)} className="p-1.5 rounded-lg transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                ✕
              </button>
            </div>
 
            <div className="space-y-4">
              {/* Info block */}
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-1">
                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-primary/10 text-primary border border-primary/20">
                  {selectedSuggestion.suggestion_type.replace(/_/g, ' ')}
                </span>
                <h3 className="font-bold text-sm text-foreground mt-1.5">
                  Categorize Transaction
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedSuggestion.reason}
                </p>
              </div>
 
              {/* Affected Transaction Details */}
              <div className="bg-background/40 border border-border/30 rounded-xl p-4 space-y-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60 block">Affected Transaction</span>
                {(() => {
                  const tx = transactions.find(t => t.id === selectedSuggestion.entity_id);
                  if (!tx) return <p className="text-xs text-muted-foreground">Transaction details not found.</p>;
                  return (
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-bold text-foreground truncate max-w-[200px]" title={tx.description}>
                          {tx.counterparty_name || tx.description}
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {formatCurrency(tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined ? tx.amount_in_base_currency : tx.amount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground/80">
                        <span>{tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('en-IN') : '—'}</span>
                        <span className="capitalize">{tx.type}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
 
              {/* Recommended Action */}
              <div className="bg-muted/20 border border-border/20 rounded-xl p-4 space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60 block">Recommended Action</span>
                <p className="text-xs font-bold text-foreground">
                  Update category to <span className="text-primary font-extrabold">{selectedSuggestion.proposed_value?.category}</span>
                </p>
              </div>
 
              {/* Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleApproveSuggestion(selectedSuggestion);
                      setSelectedSuggestion(null);
                    }}
                    className="btn-primary flex-1 justify-center text-xs py-2 rounded-xl"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleRejectSuggestion(selectedSuggestion);
                      setSelectedSuggestion(null);
                    }}
                    className="btn-secondary flex-1 justify-center text-xs py-2 rounded-xl"
                  >
                    Ignore
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSuggestion(null);
                      navigate('/risk-inbox');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer border border-border/40"
                  >
                    Open in Risk Inbox
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



// ── ReviewBadge ──────────────────────────────────────────────────────────────
const REVIEW_CFG: Record<string, { label: string; bg: string; color: string; title: string }> = {
  new:          { label: 'New',          bg: 'rgba(93,107,102,0.08)',  color: '#5D6B66', title: 'Imported but not checked' },
  needs_review: { label: 'Needs Review', bg: 'rgba(183,121,31,0.10)', color: '#B7791F', title: 'Should be manually checked' },
  reviewed:     { label: 'Reviewed',     bg: 'rgba(22,138,91,0.10)',  color: '#168A5B', title: 'Checked and accepted' },
  ignored:      { label: 'Ignored',      bg: 'rgba(93,107,102,0.06)', color: '#8A9C97', title: 'Not relevant' },
  resolved:     { label: 'Resolved',     bg: 'rgba(15,118,110,0.10)', color: '#0F766E', title: 'Issue handled' },
};

const ReviewBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = REVIEW_CFG[status] ?? REVIEW_CFG.new;
  return (
    <span className="chip" title={cfg.title}
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.bg, cursor: 'help' }}>
      {cfg.label}
    </span>
  );
};

export default Transactions;
