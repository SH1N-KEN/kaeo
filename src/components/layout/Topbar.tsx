import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Search, Bell, X } from 'lucide-react';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import { useWorkspace } from '../../hooks/useWorkspace';
import { supabase } from '../../lib/supabase';
import { calculateMonthEndReadiness } from '../../lib/readinessEngine';
import { getDisplayCategory } from '../../lib/categoryEngine';
import { formatINR } from '../../lib/formatters';
import { getCleanTransactions } from '../../lib/transactionFilters';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/Breadcrumb';

const pathTitleMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/ask-kaeo': 'Libby',
  '/libby': 'Libby',
  '/files': 'Files Ingestion',
  '/transactions': 'Transactions',
  '/vendors': 'Vendors',
  '/risk-inbox': 'Risk Inbox',
  '/reports': 'Reports',
  '/clients': 'Clients',
  '/settings': 'Settings',
  '/billing': 'Billing & Plans',
  '/spend-rules': 'Spend Rules',
  '/account': 'Account',
};

const Topbar: React.FC = () => {
  const { accountMode, activeClient } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search query state
  const [searchQuery, setSearchQuery] = useState('');

  // Cached workspace data for search and alerts
  const [dbData, setDbData] = useState<{
    transactions: any[];
    vendors: any[];
    risks: any[];
    files: any[];
    reports: any[];
    invoices: any[];
  } | null>(null);
  
  const currentPath = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get('tab');
  
  // Dynamic page title mapping helper
  const getPageTitle = (path: string): string => {
    if (path === '/settings') {
      return accountMode === 'business_owner' ? 'Business Settings' : 'Workspace Settings';
    }
    if (path === '/clients') {
      return accountMode === 'business_owner' ? 'Business Profile' : 'Client Businesses';
    }
    if (path === '/settings' && tabParam === 'spend-rules') return 'Spend Rules';
    if (path === '/settings' && tabParam === 'data') return 'Data & Reset';
    if (pathTitleMap[path]) {
      if (path === '/settings') {
        return accountMode === 'business_owner' ? 'Business Settings' : 'Workspace Settings';
      }
      if (path === '/clients') {
        return accountMode === 'business_owner' ? 'Business Profile' : 'Client Businesses';
      }
      return pathTitleMap[path];
    }
    
    if (path.endsWith('/mapping')) {
      return 'Ledger Mapping';
    }
    if (path.startsWith('/reports/')) {
      return 'Report Detail';
    }
    
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return 'Current Page';
    
    const lastSegment = segments[segments.length - 1];
    const isId = /^[0-9a-fA-F-]+$/.test(lastSegment) || /^\d+$/.test(lastSegment);
    const targetSegment = isId && segments.length > 1 ? segments[segments.length - 2] : lastSegment;
    
    return targetSegment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const pageTitle = getPageTitle(currentPath);

  // Fetch workspace data for active client
  const fetchWorkspaceData = async () => {
    if (!activeClient?.id) return;
    try {
      const [txsRes, risksRes, invoicesRes, vendorsRes, filesRes, reportsRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('client_id', activeClient.id),
        supabase.from('risk_events').select('*').eq('client_id', activeClient.id),
        supabase.from('invoices').select('*').eq('client_id', activeClient.id),
        supabase.from('vendors').select('*').eq('client_id', activeClient.id),
        supabase.from('uploaded_files').select('*').eq('client_id', activeClient.id),
        supabase.from('reports').select('*').eq('client_id', activeClient.id),
      ]);

      const cleanTxs = getCleanTransactions(txsRes.data || []);

      setDbData({
        transactions: cleanTxs,
        risks: risksRes.data || [],
        invoices: invoicesRes.data || [],
        vendors: vendorsRes.data || [],
        files: filesRes.data || [],
        reports: reportsRes.data || [],
      });
    } catch (err) {
      console.error('Error fetching workspace alerts and search data:', err);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, [activeClient?.id]);

  useEffect(() => {
    if (isSearchOpen || isNotifOpen) {
      fetchWorkspaceData();
    }
  }, [isSearchOpen, isNotifOpen]);

  // Compute Alerts list & priority notification count
  const { alertItems, priorityCount } = React.useMemo(() => {
    if (!dbData) return { alertItems: [], priorityCount: 0 };
    const items: { id: string; text: string; route: string }[] = [];

    // 1. Open risks
    const openRisks = dbData.risks.filter(r => r.status === 'open');
    if (openRisks.length > 0) {
      items.push({
        id: 'open_risks',
        text: `${openRisks.length} open risk${openRisks.length > 1 ? 's' : ''} need${openRisks.length === 1 ? 's' : ''} review`,
        route: '/risk-inbox'
      });
    }

    // 2. Transactions needing validation
    const pendingTxCount = dbData.transactions.filter(
      t => !t.review_status || t.review_status === 'new' || t.review_status === 'needs_review'
    ).length;
    if (pendingTxCount > 0) {
      items.push({
        id: 'pending_tx',
        text: `${pendingTxCount} transaction${pendingTxCount > 1 ? 's still' : ''} need${pendingTxCount === 1 ? 's' : ''} validation`,
        route: '/transactions?review=pending'
      });
    }

    // 3. Uncategorized rows
    const uncategorizedCount = dbData.transactions.filter(
      t => getDisplayCategory(t) === 'Uncategorized'
    ).length;
    if (uncategorizedCount > 0) {
      items.push({
        id: 'uncategorized_tx',
        text: `${uncategorizedCount} row${uncategorizedCount > 1 ? 's' : ''} need${uncategorizedCount === 1 ? 's' : ''} category mapping`,
        route: '/transactions?category=uncategorized'
      });
    }

    // 4. Accountant pack draft
    const readiness = calculateMonthEndReadiness(dbData.transactions, dbData.risks);
    const isAccountantPackDraft = readiness.score < 90 && dbData.transactions.length > 0;
    if (isAccountantPackDraft) {
      items.push({
        id: 'accountant_pack',
        text: 'Accountant pack is still draft',
        route: '/reports'
      });
    }

    // 5. Invoice mismatches
    const mismatchCount = dbData.invoices.filter(i => i.status === 'mismatch').length;
    if (mismatchCount > 0) {
      items.push({
        id: 'invoice_mismatch',
        text: `${mismatchCount} invoice mismatch${mismatchCount > 1 ? 'es' : ''} need${mismatchCount === 1 ? 's' : ''} review`,
        route: '/files?tab=invoices'
      });
    }

    // Priority Count = open risks + uncategorized rows + invoice mismatches + accountant pack draft status
    const count = openRisks.length + uncategorizedCount + mismatchCount + (isAccountantPackDraft ? 1 : 0);

    return { alertItems: items.slice(0, 5), priorityCount: count };
  }, [dbData]);

  // Client-side search results
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim() || !dbData) return null;
    const query = searchQuery.toLowerCase();

    const matchedTxs = dbData.transactions.filter(t => 
      t.description?.toLowerCase().includes(query) ||
      t.counterparty_name?.toLowerCase().includes(query) ||
      t.category?.toLowerCase().includes(query) ||
      String(t.amount || '').includes(query) ||
      t.transaction_date?.toLowerCase().includes(query)
    ).slice(0, 5);

    const matchedVendors = dbData.vendors.filter(v => 
      v.name?.toLowerCase().includes(query) ||
      v.category?.toLowerCase().includes(query)
    ).slice(0, 5);

    const matchedRisks = dbData.risks.filter(r => 
      r.title?.toLowerCase().includes(query) ||
      r.risk_type?.toLowerCase().includes(query) ||
      r.description?.toLowerCase().includes(query) ||
      r.suggested_action?.toLowerCase().includes(query) ||
      JSON.stringify(r.evidence_json || {}).toLowerCase().includes(query)
    ).slice(0, 5);

    const matchedFiles = dbData.files.filter(f => 
      f.file_name?.toLowerCase().includes(query) ||
      f.status?.toLowerCase().includes(query)
    ).slice(0, 5);

    const matchedReports = dbData.reports.filter(r => 
      r.name?.toLowerCase().includes(query) ||
      r.status?.toLowerCase().includes(query)
    ).slice(0, 5);

    const totalCount = matchedTxs.length + matchedVendors.length + matchedRisks.length + matchedFiles.length + matchedReports.length;

    return {
      transactions: matchedTxs,
      vendors: matchedVendors,
      risks: matchedRisks,
      files: matchedFiles,
      reports: matchedReports,
      totalCount
    };
  }, [searchQuery, dbData]);

  const isWorkspaceEmpty = dbData && dbData.transactions.length === 0 && dbData.files.length === 0;

  // Keyboard shortcut listener Ctrl+K / Cmd+K and ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  // Autofocus input when modal opens
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchOpen]);

  // Close notifications dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (route: string) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(route);
  };

  return (
    <>
      <header className="h-16 premium-topbar sticky top-0 z-40 flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <WorkspaceSwitcher />
          <div className="h-4 w-px bg-border/40 mx-2" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">Workspaces</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:inline-flex" />
              
              {currentPath === '/settings' && tabParam ? (
                <>
                  <BreadcrumbItem className="hidden sm:inline-flex">
                    <BreadcrumbLink asChild>
                      <Link to="/settings">{accountMode === 'business_owner' ? 'Business Settings' : 'Workspace Settings'}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:inline-flex" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {tabParam === 'clients'
                        ? (accountMode === 'business_owner' ? 'Business Profile' : 'Client Businesses')
                        : tabParam === 'spend-rules'
                        ? 'Spend Rules'
                        : tabParam === 'data'
                        ? 'Data & Reset'
                        : tabParam === 'integrations'
                        ? 'Integrations'
                        : tabParam.charAt(0).toUpperCase() + tabParam.slice(1)}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Trigger Button */}
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-xs font-semibold text-muted-foreground w-48 md:w-64 cursor-pointer premium-topbar-card"
          >
            <Search className="w-3.5 h-3.5 search-icon" />
            <span className="text-left flex-1">Search transactions, vendors, risks, files...</span>
            <span className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded border border-border/20 text-muted-foreground">Ctrl K</span>
          </button>
          
          {/* Notifications Popover Trigger */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="p-2 rounded-xl transition-colors relative cursor-pointer premium-topbar-card"
            >
              <Bell className="w-4 h-4 bell-icon" />
              {priorityCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-risk px-1 text-[9px] font-black text-white border border-card shadow-sm">
                  {priorityCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 premium-floating-panel rounded-2xl p-4 shadow-2xl z-[90] animate-in fade-in slide-in-from-top-2 duration-200 text-left border border-border/40">
                <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-teal-400" />
                    Workspace Alerts
                  </h4>
                  {priorityCount > 0 && (
                    <span className="text-[9px] font-extrabold bg-risk/10 text-risk px-2 py-0.5 rounded border border-risk/20">
                      {priorityCount} Urgent
                    </span>
                  )}
                </div>

                {alertItems.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-[11px] text-muted-foreground font-medium">Nothing urgent right now.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {alertItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setIsNotifOpen(false);
                          navigate(item.route);
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-border/30 flex items-start gap-2.5 cursor-pointer group"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0 group-hover:scale-125 transition-transform" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-foreground leading-normal">{item.text}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Command Palette / Search Modal */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-start justify-center pt-24 px-4 animate-in fade-in duration-200"
          onClick={() => setIsSearchOpen(false)}
        >
          <div 
            className="w-full max-w-xl premium-floating-panel rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 border border-border/40"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsSearchOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Input search block */}
            <div className="flex items-center gap-3 border-b border-border/40 pb-4 mb-4">
              <Search className="w-5 h-5 text-teal-400 shrink-0" />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Search transactions, vendors, risks, files..." 
                className="w-full bg-transparent text-sm font-semibold outline-none text-foreground placeholder:text-muted-foreground"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Content view */}
            {isWorkspaceEmpty ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-12 h-12 bg-muted/40 rounded-2xl flex items-center justify-center mx-auto border border-border/40 text-muted-foreground/50">
                  <Search className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground">Workspace is empty</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Upload a CSV/XLSX file first to search your workspace.
                  </p>
                </div>
                <button
                  onClick={() => handleResultClick('/files')}
                  className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:opacity-90 transition-all cursor-pointer shadow-sm"
                >
                  Go to Uploads
                </button>
              </div>
            ) : !searchQuery.trim() ? (
              /* Empty Query / Quick Shortcuts State */
              <div className="py-4 space-y-4">
                <div className="text-center space-y-1 mb-2">
                  <h3 className="text-xs font-bold text-foreground">Try searching a vendor, transaction, risk, or file.</h3>
                  <p className="text-[10px] text-muted-foreground">Jump directly to workspace pages or trigger intelligence.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto">
                  <button
                    onClick={() => handleResultClick('/risk-inbox')}
                    className="flex items-center gap-2.5 p-3 bg-white/5 border border-border/20 rounded-xl hover:bg-white/10 text-left text-xs font-semibold cursor-pointer group transition-all"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-risk group-hover:scale-125 transition-all" />
                    <span>Open Risk Inbox</span>
                  </button>
                  <button
                    onClick={() => handleResultClick('/transactions?review=pending')}
                    className="flex items-center gap-2.5 p-3 bg-white/5 border border-border/20 rounded-xl hover:bg-white/10 text-left text-xs font-semibold cursor-pointer group transition-all"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 group-hover:scale-125 transition-all" />
                    <span>Review Transactions</span>
                  </button>
                  <button
                    onClick={() => handleResultClick('/files')}
                    className="flex items-center gap-2.5 p-3 bg-white/5 border border-border/20 rounded-xl hover:bg-white/10 text-left text-xs font-semibold cursor-pointer group transition-all"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 group-hover:scale-125 transition-all" />
                    <span>Upload Files</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                      window.dispatchEvent(new CustomEvent('open-ask-libby'));
                    }}
                    className="flex items-center gap-2.5 p-3 bg-white/5 border border-border/20 rounded-xl hover:bg-white/10 text-left text-xs font-semibold cursor-pointer group transition-all"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:scale-125 transition-all" />
                    <span>Ask Libby</span>
                  </button>
                </div>
              </div>
            ) : searchResults && searchResults.totalCount === 0 ? (
              /* No matching results found */
              <div className="py-8 text-center space-y-3 animate-in fade-in duration-200">
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center mx-auto border border-border/20 text-muted-foreground/60">
                  <X className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">No matching workspace data found.</h3>
                  <p className="text-[10px] text-muted-foreground leading-normal">Try matching another keyword, description, or amount.</p>
                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      const q = searchQuery;
                      setSearchQuery('');
                      window.dispatchEvent(new CustomEvent('open-ask-libby', { detail: { query: q } }));
                    }}
                    className="mt-3 px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-[10px] font-bold rounded-lg border border-teal-500/25 transition-all cursor-pointer inline-flex items-center gap-1"
                  >
                    Ask Libby to help find it
                  </button>
                </div>
              </div>
            ) : (
              /* Matching Results Render */
              <div className="max-h-[380px] overflow-y-auto space-y-4 pr-1 scrollbar-thin animate-in fade-in duration-200">
                {/* Transactions Group */}
                {searchResults && searchResults.transactions.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/70 mb-2 border-b border-border/10 pb-0.5">Transactions</h4>
                    <div className="space-y-1">
                      {searchResults.transactions.map(tx => (
                        <button
                          key={tx.id}
                          onClick={() => handleResultClick(`/transactions?search=${encodeURIComponent(tx.description || '')}`)}
                          className="w-full text-left p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-border/30 flex items-center justify-between cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{tx.description || 'Unnamed Entry'}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString() : 'No date'} • {tx.category || 'Uncategorized'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className={`text-xs font-bold ${tx.type === 'income' || tx.type === 'refund' ? 'text-success' : 'text-risk'}`}>
                              {formatINR(tx.amount)}
                            </span>
                            <span className="text-[8px] bg-muted/40 px-1.5 py-0.5 rounded border border-border/20 text-muted-foreground uppercase font-black tracking-wider">txn</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vendors Group */}
                {searchResults && searchResults.vendors.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/70 mb-2 border-b border-border/10 pb-0.5">Vendors</h4>
                    <div className="space-y-1">
                      {searchResults.vendors.map(v => (
                        <button
                          key={v.id}
                          onClick={() => handleResultClick(`/vendors?search=${encodeURIComponent(v.name || '')}`)}
                          className="w-full text-left p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-border/30 flex items-center justify-between cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{v.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{v.category || 'Uncategorized Category'}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            {v.total_spend && (
                              <span className="text-[10px] font-bold text-foreground">
                                Spend: {formatINR(v.total_spend)}
                              </span>
                            )}
                            <span className="text-[8px] bg-muted/40 px-1.5 py-0.5 rounded border border-border/20 text-muted-foreground uppercase font-black tracking-wider">vendor</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risks Group */}
                {searchResults && searchResults.risks.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/70 mb-2 border-b border-border/10 pb-0.5">Risks</h4>
                    <div className="space-y-1">
                      {searchResults.risks.map(r => (
                        <button
                          key={r.id}
                          onClick={() => handleResultClick(`/risk-inbox?search=${encodeURIComponent(r.title || '')}`)}
                          className="w-full text-left p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-border/30 flex items-center justify-between cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{r.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate leading-tight">{r.description || r.suggested_action}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className="text-xs font-bold text-risk">
                              {r.amount_at_risk > 0 ? `${formatINR(r.amount_at_risk)}` : 'Risk Alert'}
                            </span>
                            <span className="text-[8px] bg-muted/40 px-1.5 py-0.5 rounded border border-border/20 text-muted-foreground uppercase font-black tracking-wider">risk</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files Group */}
                {searchResults && searchResults.files.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/70 mb-2 border-b border-border/10 pb-0.5">Files</h4>
                    <div className="space-y-1">
                      {searchResults.files.map(f => (
                        <button
                          key={f.id}
                          onClick={() => handleResultClick(`/files?search=${encodeURIComponent(f.file_name || '')}`)}
                          className="w-full text-left p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-border/30 flex items-center justify-between cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{f.file_name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              Uploaded: {f.created_at ? new Date(f.created_at).toLocaleDateString() : 'No date'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className="text-[9px] font-semibold text-muted-foreground uppercase">{f.status || 'unknown'}</span>
                            <span className="text-[8px] bg-muted/40 px-1.5 py-0.5 rounded border border-border/20 text-muted-foreground uppercase font-black tracking-wider">file</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reports Group */}
                {searchResults && searchResults.reports.length > 0 && (
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/70 mb-2 border-b border-border/10 pb-0.5">Reports</h4>
                    <div className="space-y-1">
                      {searchResults.reports.map(r => (
                        <button
                          key={r.id}
                          onClick={() => handleResultClick(`/reports?search=${encodeURIComponent(r.name || r.title || '')}`)}
                          className="w-full text-left p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-border/30 flex items-center justify-between cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{r.name || r.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              Created: {r.created_at ? new Date(r.created_at).toLocaleDateString() : 'No date'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className="text-[9px] font-semibold text-muted-foreground uppercase">{r.status || 'Ready'}</span>
                            <span className="text-[8px] bg-muted/40 px-1.5 py-0.5 rounded border border-border/20 text-muted-foreground uppercase font-black tracking-wider">report</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="border-t border-border/30 pt-3 mt-4 flex items-center justify-between text-[10px] text-muted-foreground font-bold">
              <span>TIP: Scroll to view more results</span>
              <kbd className="px-2 py-0.5 bg-muted rounded border border-border/50">ESC to exit</kbd>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Topbar;
