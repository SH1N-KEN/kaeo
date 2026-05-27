import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Search, Bell, X, Upload } from 'lucide-react';
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
  '/dashboard':    'Dashboard',
  '/ask-kaeo':     'Ask Libby',
  '/libby':        'Ask Libby',
  '/files':        'Files',
  '/transactions': 'Transactions',
  '/vendors':      'Vendors',
  '/risk-inbox':   'Risk Inbox',
  '/reports':      'Reports',
  '/clients':      'Clients',
  '/settings':     'Settings',
  '/billing':      'Billing & Plans',
  '/account':      'Account',
};

const Topbar: React.FC = () => {
  const { accountMode, activeClient } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const getPageTitle = (path: string): string => {
    if (path === '/settings') {
      return accountMode === 'business_owner' ? 'Settings' : 'Workspace Settings';
    }
    if (path === '/clients') {
      return accountMode === 'business_owner' ? 'Business Profile' : 'Clients';
    }
    if (path.endsWith('/mapping')) return 'Ledger Mapping';
    if (path.startsWith('/reports/')) return 'Report Detail';
    if (pathTitleMap[path]) return pathTitleMap[path];
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return 'Dashboard';
    const lastSegment = segments[segments.length - 1];
    const isId = /^[0-9a-fA-F-]+$/.test(lastSegment) || /^\d+$/.test(lastSegment);
    const targetSegment = isId && segments.length > 1 ? segments[segments.length - 2] : lastSegment;
    return targetSegment.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const pageTitle = getPageTitle(currentPath);

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
      console.error('Error fetching workspace data:', err);
    }
  };

  useEffect(() => { fetchWorkspaceData(); }, [activeClient?.id]);
  useEffect(() => {
    if (isSearchOpen || isNotifOpen) fetchWorkspaceData();
  }, [isSearchOpen, isNotifOpen]);

  const { alertItems, priorityCount } = React.useMemo(() => {
    if (!dbData) return { alertItems: [], priorityCount: 0 };
    const items: { id: string; text: string; route: string }[] = [];

    const openRisks = dbData.risks.filter(r => r.status === 'open');
    if (openRisks.length > 0) {
      items.push({ id: 'open_risks', text: `${openRisks.length} open risk${openRisks.length > 1 ? 's' : ''} need review`, route: '/risk-inbox' });
    }

    const pendingTxCount = dbData.transactions.filter(
      t => !t.review_status || t.review_status === 'new' || t.review_status === 'needs_review'
    ).length;
    if (pendingTxCount > 0) {
      items.push({ id: 'pending_tx', text: `${pendingTxCount} transaction${pendingTxCount > 1 ? 's' : ''} need validation`, route: '/transactions?review=pending' });
    }

    const uncategorizedCount = dbData.transactions.filter(t => getDisplayCategory(t) === 'Uncategorized').length;
    if (uncategorizedCount > 0) {
      items.push({ id: 'uncategorized_tx', text: `${uncategorizedCount} row${uncategorizedCount > 1 ? 's' : ''} need category mapping`, route: '/transactions?category=uncategorized' });
    }

    const readiness = calculateMonthEndReadiness(dbData.transactions, dbData.risks);
    if (readiness.score < 90 && dbData.transactions.length > 0) {
      items.push({ id: 'accountant_pack', text: 'Accountant pack is still draft', route: '/reports' });
    }

    const mismatchCount = dbData.invoices.filter(i => i.status === 'mismatch').length;
    if (mismatchCount > 0) {
      items.push({ id: 'invoice_mismatch', text: `${mismatchCount} invoice mismatch${mismatchCount > 1 ? 'es' : ''} need review`, route: '/files?tab=invoices' });
    }

    const count = openRisks.length + uncategorizedCount + mismatchCount;
    return { alertItems: items.slice(0, 5), priorityCount: count };
  }, [dbData]);

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
    ).slice(0, 4);

    const matchedRisks = dbData.risks.filter(r =>
      r.title?.toLowerCase().includes(query) ||
      r.risk_type?.toLowerCase().includes(query) ||
      r.description?.toLowerCase().includes(query)
    ).slice(0, 4);

    const matchedFiles = dbData.files.filter(f =>
      f.file_name?.toLowerCase().includes(query)
    ).slice(0, 3);

    const matchedReports = dbData.reports.filter(r =>
      r.name?.toLowerCase().includes(query) || r.title?.toLowerCase().includes(query)
    ).slice(0, 3);

    const totalCount = matchedTxs.length + matchedVendors.length + matchedRisks.length + matchedFiles.length + matchedReports.length;
    return { transactions: matchedTxs, vendors: matchedVendors, risks: matchedRisks, files: matchedFiles, reports: matchedReports, totalCount };
  }, [searchQuery, dbData]);

  const isWorkspaceEmpty = dbData && dbData.transactions.length === 0 && dbData.files.length === 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isSearchOpen) setIsSearchOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  useEffect(() => {
    if (isSearchOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [isSearchOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
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
      <header className="topbar-base">
        {/* Left: breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink asChild>
                  <Link to="/dashboard" className="text-[13px]">Workspace</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:inline-flex" />
              {currentPath === '/settings' && tabParam ? (
                <>
                  <BreadcrumbItem className="hidden sm:inline-flex">
                    <BreadcrumbLink asChild>
                      <Link to="/settings" className="text-[13px]">Settings</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:inline-flex" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-[13px]">
                      {tabParam === 'clients' ? (accountMode === 'business_owner' ? 'Business Profile' : 'Clients')
                        : tabParam === 'spend-rules' ? 'Spend Rules'
                        : tabParam === 'data' ? 'Data & Reset'
                        : tabParam === 'integrations' ? 'Integrations'
                        : tabParam.charAt(0).toUpperCase() + tabParam.slice(1)}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[13px]">{pageTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search trigger */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] text-[var(--muted-foreground)] w-48 md:w-56 cursor-pointer transition-all"
            style={{ background: 'var(--surface)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--muted)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--surface)';
            }}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 text-left truncate">Search…</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
              ⌘K
            </span>
          </button>

          {/* Import button */}
          <button
            onClick={() => navigate('/files')}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Import
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-2 rounded-lg cursor-pointer transition-all"
              style={{ background: 'var(--surface)' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--muted)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--surface)';
              }}
            >
              <Bell className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
              {priorityCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                  style={{ background: '#C2413A' }}
                >
                  {priorityCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div
                className="absolute right-0 mt-2 w-80 kaeo-popover shadow-xl z-[90] animate-kaeo-scale"
                style={{ padding: '4px' }}
              >
                <div className="px-3 py-2.5 border-b border-[var(--border)] mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
                    <h4 className="text-[13px] font-semibold" style={{ color: 'var(--foreground)' }}>
                      Workspace Alerts
                    </h4>
                  </div>
                  {priorityCount > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(194,65,58,0.10)', color: '#C2413A' }}>
                      {priorityCount} urgent
                    </span>
                  )}
                </div>

                {alertItems.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
                      All clear — no urgent alerts
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5 p-1">
                    {alertItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => { setIsNotifOpen(false); navigate(item.route); }}
                        className="w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-2.5 cursor-pointer transition-all group"
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                          style={{ background: 'var(--primary)' }} />
                        <p className="text-[12px] font-medium leading-snug" style={{ color: 'var(--foreground)' }}>
                          {item.text}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Command Palette / Search Modal ── */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-[999] flex items-start justify-center pt-20 px-4"
          style={{ background: 'rgba(10,15,14,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl kaeo-modal animate-kaeo-scale"
            onClick={e => e.stopPropagation()}
            style={{ padding: '0' }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search transactions, vendors, risks, files…"
                className="flex-1 bg-transparent text-[14px] font-medium outline-none"
                style={{ color: 'var(--foreground)' }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-1 rounded-lg transition-colors"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <X className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[420px] overflow-y-auto">
              {isWorkspaceEmpty ? (
                <div className="px-5 py-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border border-dashed border-[var(--border)]"
                    style={{ background: 'var(--muted)' }}>
                    <Search className="w-5 h-5" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                      Workspace is empty
                    </h3>
                    <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
                      Upload a CSV or XLSX file first to start searching.
                    </p>
                  </div>
                  <button onClick={() => handleResultClick('/files')} className="btn-primary btn-sm mx-auto">
                    Go to Files
                  </button>
                </div>
              ) : !searchQuery.trim() ? (
                <div className="px-5 py-5 space-y-4">
                  <p className="text-[12px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    Quick navigation
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Open Risk Inbox',     route: '/risk-inbox',                dotColor: '#C2413A' },
                      { label: 'Review Transactions',  route: '/transactions?review=pending', dotColor: '#0F766E' },
                      { label: 'Upload Files',         route: '/files',                      dotColor: '#2563EB' },
                      { label: 'Ask Libby',             route: '/libby',                      dotColor: '#2FB8A6' },
                    ].map(q => (
                      <button
                        key={q.route}
                        onClick={() => handleResultClick(q.route)}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-left transition-all cursor-pointer"
                        style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(15,118,110,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--muted)')}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: q.dotColor }} />
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : searchResults && searchResults.totalCount === 0 ? (
                <div className="px-5 py-10 text-center space-y-2">
                  <h3 className="text-[14px] font-semibold" style={{ color: 'var(--foreground)' }}>
                    No results found
                  </h3>
                  <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
                    Try a different keyword or amount
                  </p>
                  <button
                    onClick={() => {
                      const q = searchQuery;
                      setIsSearchOpen(false);
                      setSearchQuery('');
                      window.dispatchEvent(new CustomEvent('open-ask-libby', { detail: { query: q } }));
                    }}
                    className="mt-2 btn-secondary btn-sm mx-auto"
                  >
                    Ask Libby to help find it
                  </button>

                </div>
              ) : (
                <div className="py-2 space-y-1">
                  {/* Transactions */}
                  {searchResults && searchResults.transactions.length > 0 && (
                    <SearchGroup label="Transactions">
                      {searchResults.transactions.map(tx => (
                        <SearchResult
                          key={tx.id}
                          primary={tx.description || 'Unnamed'}
                          secondary={`${tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString() : ''} · ${tx.category || 'Uncategorized'}`}
                          badge={formatINR(tx.amount)}
                          badgeColor={tx.type === 'income' || tx.type === 'refund' ? '#168A5B' : '#C2413A'}
                          tag="txn"
                          onClick={() => handleResultClick(`/transactions?search=${encodeURIComponent(tx.description || '')}`)}
                        />
                      ))}
                    </SearchGroup>
                  )}
                  {/* Vendors */}
                  {searchResults && searchResults.vendors.length > 0 && (
                    <SearchGroup label="Vendors">
                      {searchResults.vendors.map(v => (
                        <SearchResult
                          key={v.id}
                          primary={v.name}
                          secondary={v.category || 'Uncategorized'}
                          badge={v.total_spend ? formatINR(v.total_spend) : ''}
                          tag="vendor"
                          onClick={() => handleResultClick(`/vendors?search=${encodeURIComponent(v.name || '')}`)}
                        />
                      ))}
                    </SearchGroup>
                  )}
                  {/* Risks */}
                  {searchResults && searchResults.risks.length > 0 && (
                    <SearchGroup label="Risks">
                      {searchResults.risks.map(r => (
                        <SearchResult
                          key={r.id}
                          primary={r.title}
                          secondary={r.description || r.suggested_action || ''}
                          badge={r.amount_at_risk > 0 ? formatINR(r.amount_at_risk) : 'Risk'}
                          badgeColor="#C2413A"
                          tag="risk"
                          onClick={() => handleResultClick(`/risk-inbox?search=${encodeURIComponent(r.title || '')}`)}
                        />
                      ))}
                    </SearchGroup>
                  )}
                  {/* Files */}
                  {searchResults && searchResults.files.length > 0 && (
                    <SearchGroup label="Files">
                      {searchResults.files.map(f => (
                        <SearchResult
                          key={f.id}
                          primary={f.file_name}
                          secondary={f.created_at ? `Uploaded ${new Date(f.created_at).toLocaleDateString()}` : ''}
                          badge={f.status || ''}
                          tag="file"
                          onClick={() => handleResultClick(`/files?search=${encodeURIComponent(f.file_name || '')}`)}
                        />
                      ))}
                    </SearchGroup>
                  )}
                  {/* Reports */}
                  {searchResults && searchResults.reports.length > 0 && (
                    <SearchGroup label="Reports">
                      {searchResults.reports.map(r => (
                        <SearchResult
                          key={r.id}
                          primary={r.name || r.title}
                          secondary={r.created_at ? `Created ${new Date(r.created_at).toLocaleDateString()}` : ''}
                          badge={r.status || ''}
                          tag="report"
                          onClick={() => handleResultClick(`/reports?search=${encodeURIComponent(r.name || r.title || '')}`)}
                        />
                      ))}
                    </SearchGroup>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                Tip: Use filters on each page for more precise results
              </span>
              <kbd className="text-[11px] px-2 py-0.5 rounded border border-[var(--border)] font-medium"
                style={{ color: 'var(--muted-foreground)', background: 'var(--muted)' }}>
                ESC
              </kbd>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ── Search sub-components ── */
const SearchGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="px-5 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </span>
    </div>
    {children}
  </div>
);

const SearchResult: React.FC<{
  primary: string;
  secondary: string;
  badge?: string;
  badgeColor?: string;
  tag?: string;
  onClick: () => void;
}> = ({ primary, secondary, badge, badgeColor, tag, onClick }) => (
  <button
    onClick={onClick}
    className="w-full text-left px-5 py-2.5 flex items-center justify-between gap-4 cursor-pointer transition-all group"
    onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
  >
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-medium truncate transition-colors"
        style={{ color: 'var(--foreground)' }}>
        {primary}
      </p>
      {secondary && (
        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {secondary}
        </p>
      )}
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {badge && (
        <span className="text-[12px] font-semibold" style={{ color: badgeColor || 'var(--muted-foreground)' }}>
          {badge}
        </span>
      )}
      {tag && (
        <span className="text-[10px] font-medium px-2 py-0.5 rounded"
          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
          {tag}
        </span>
      )}
    </div>
  </button>
);

export default Topbar;
