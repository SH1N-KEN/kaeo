import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, 
  AlertCircle, 
  Zap, 
  Loader2,
  MessageSquare,
  ArrowRight,
  X,
  Plus,
  Terminal,
  Database,
  Search,
  CheckCircle2,
  User,
  Sparkles
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import { formatINR } from '../lib/formatters';
import { analyzeRisksForClient } from '../lib/riskEngine';
import { getCleanTransactions } from '../lib/transactionFilters';
import EmptyState from '../components/ui/EmptyState';
import MetricCard from '../components/ui/MetricCard';
import type { RiskEvent, Note } from '../types/finance';
import { trackAuditEvent } from '../lib/auditEngine';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { applyReviewSuggestion } from '../lib/reviewActions';
import { useToast } from '../hooks/useToast';
import { useWorkspaceRefresh } from '../hooks/useWorkspaceRefresh';

const getFriendlyRiskType = (type: string): string => {
  const mapping: Record<string, string> = {
    duplicate_payment: 'Duplicate payment',
    duplicate: 'Duplicate payment',
    high_value_payment: 'High-value payment',
    high_value: 'High-value payment',
    uncategorized_transaction: 'Uncategorized transaction',
    missing_invoice: 'Missing invoice',
    invoice_payment_mismatch: 'Invoice mismatch',
    invoice_mismatch: 'Invoice mismatch',
    unknown_vendor: 'Unknown vendor',
    recurring_spend: 'Recurring spend',
    recurring: 'Recurring spend'
  };
  return mapping[type.toLowerCase()] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const RiskInbox: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [risks, setRisks] = useState<RiskEvent[]>([]);
  const [txCount, setTxCount] = useState<number | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<RiskEvent | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<{
    txLoaded: number;
    risksGenerated: number;
    lastScan: string | null;
  }>({ txLoaded: 0, risksGenerated: 0, lastScan: null });

  const [stats, setStats] = useState({
    critical: 0,
    amount: 0,
    open: 0
  });
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const searchVal = searchParams.get('search') || '';

  const filteredRisks = React.useMemo(() => {
    if (!searchVal) return risks;
    const term = searchVal.toLowerCase();
    return risks.filter(r => 
      r.title?.toLowerCase().includes(term) ||
      r.description?.toLowerCase().includes(term) ||
      r.risk_type?.toLowerCase().includes(term) ||
      r.suggested_action?.toLowerCase().includes(term)
    );
  }, [risks, searchVal]);

  useEffect(() => {
    if (searchVal && filteredRisks.length > 0) {
      const exists = selectedRisk && filteredRisks.some(r => r.id === selectedRisk.id);
      if (!exists) {
        setSelectedRisk(filteredRisks[0]);
        fetchNotes(filteredRisks[0].id);
      }
    }
  }, [searchVal, filteredRisks, selectedRisk]);

  useEffect(() => {
    if (activeClient) {
      fetchTxCount();
      fetchRisks();
    }
  }, [activeClient]);

  // Re-fetch when Libby resolves a risk workspace-wide
  useWorkspaceRefresh(useCallback(() => {
    if (activeClient) {
      fetchTxCount();
      fetchRisks();
    }
  }, [activeClient]));

  const fetchTxCount = async () => {
    if (!activeClient) return;
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('client_id', activeClient.id);
    
    const cleanTxs = getCleanTransactions(data || []);
    setTxCount(cleanTxs.length);
  };

  const fetchRisks = async () => {
    if (!activeClient) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('risk_events')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('severity', { ascending: false });

      if (fetchErr) throw fetchErr;

      // Fetch note counts
      const { data: notesData } = await supabase
        .from('notes')
        .select('entity_id')
        .eq('client_id', activeClient.id)
        .eq('entity_type', 'risk_event');
      
      const noteCounts = (notesData || []).reduce((acc: any, n) => {
        acc[n.entity_id] = (acc[n.entity_id] || 0) + 1;
        return acc;
      }, {});

      const enrichedRisks = (data || []).map(r => ({
        ...r,
        notes_count: noteCounts[r.id] || 0
      }));

      setRisks(enrichedRisks);

      const s = enrichedRisks.reduce((acc, r) => {
        if (r.severity === 'critical' || r.severity === 'high') acc.critical++;
        if (r.status === 'open') {
          acc.open++;
          acc.amount += Number(r.amount_at_risk);
        }
        return acc;
      }, { critical: 0, amount: 0, open: 0 });
      setStats(s);

      // Fetch pending review suggestions
      const { data: sugs } = await supabase
        .from('ai_review_suggestions')
        .select('*')
        .eq('client_id', activeClient.id)
        .eq('status', 'pending');
      setSuggestions(sugs || []);

    } catch (err: any) {
      console.error('[Risk] Fetch error:', err);
      if (err.message?.includes('column') && err.message?.includes('does not exist')) {
        setError('Database schema is out of date. Run latest Phase 5 repair migration (0007).');
      } else {
        setError(err.message || 'Failed to fetch risk events.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!activeClient || !activeOrg) return;
    setAnalyzing(true);
    setError(null);
    try {
      const generatedRisks = await analyzeRisksForClient(activeOrg.id, activeClient.id);
      setDiagnostics({
        txLoaded: txCount || 0,
        risksGenerated: generatedRisks.length,
        lastScan: new Date().toLocaleTimeString()
      });
      await fetchRisks();
    } catch (err: any) {
      console.error('[Risk] Analysis failed:', err);
      if (err.message?.includes('column') && err.message?.includes('does not exist')) {
        setError('Database schema is out of date. Run latest Phase 5 repair migration (0007).');
      } else {
        setError(err.message || 'Security scan failed. Check database connection.');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const updateStatus = async (riskId: string, status: string) => {
    if (!activeOrg) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { error: updateErr } = await supabase
        .from('risk_events')
        .update({ 
          status,
          reviewed_by: userData.user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', riskId);
      
      if (updateErr) throw updateErr;
      
      let actionName = 'risk_resolved';
      if (status === 'ignored') actionName = 'risk_ignored';
      if (status === 'reviewed') actionName = 'risk_review_started';

      await trackAuditEvent(activeOrg.id, actionName as any, 'risk', riskId, { status });
      
      fetchRisks();
      if (selectedRisk?.id === riskId) {
        setSelectedRisk({ 
          ...selectedRisk, 
          status: status as RiskEvent['status'],
          reviewed_by: userData.user?.id,
          reviewed_at: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error('[Risk] Update status failed:', err);
      setError('Failed to update status: ' + err.message);
    }
  };

  const fetchNotes = async (riskId: string) => {
    try {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('entity_id', riskId)
        .eq('entity_type', 'risk_event')
        .order('created_at', { ascending: false });
      setNotes(data || []);
    } catch (err) {
      console.error('[Notes] Fetch error:', err);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !selectedRisk || !activeOrg || !activeClient) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { error: insertErr } = await supabase.from('notes').insert({
        organization_id: activeOrg.id,
        client_id: activeClient.id,
        entity_type: 'risk_event',
        entity_id: selectedRisk.id,
        note: newNote,
        created_by: userData.user.id
      });

      if (insertErr) {
        if (insertErr.message?.includes('column') && insertErr.message?.includes('does not exist')) {
          throw new Error('Database schema is out of date. Run latest Phase 5 repair migration (0007).');
        }
        throw insertErr;
      }

      setNewNote('');
      fetchNotes(selectedRisk.id);
      fetchRisks();
    } catch (err: any) {
      console.error('[Notes] Add failed:', err);
      setError('Failed to add note: ' + err.message);
    }
  };

  const formatCurrency = (val: number) => {
    return formatINR(val);
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return 'bg-[rgba(224,84,80,0.15)] text-[#E05450] border-[rgba(224,84,80,0.25)]';
      case 'high': return 'bg-[rgba(224,84,80,0.10)] text-[#E05450] border-[rgba(224,84,80,0.20)]';
      case 'medium': return 'bg-[rgba(214,146,42,0.10)] text-[#D4922A] border-[rgba(214,146,42,0.20)]';
      default: return 'bg-[rgba(93,107,102,0.08)] text-[#7E9C98] border-[rgba(93,107,102,0.16)]';
    }
  };

  if (!activeClient || !activeOrg) {
    if (clients && clients.length > 0) {
      return (
        <div className="h-[70vh] flex items-center justify-center animate-in fade-in duration-500">
          <div className="frosted-card p-10 flex flex-col items-center justify-center text-center space-y-5 max-w-md animate-kaeo-scale">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-muted border border-border">
              <Plus className="w-8 h-8" style={{ color: 'var(--primary)' }} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold tracking-tight">We found your business but it was not selected.</h3>
              <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                Click below to start using your business workspace.
              </p>
            </div>
            <button 
              onClick={() => { setActiveClient(clients[0]); }}
              className="btn-primary"
            >
              Use this business
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-[70vh] flex items-center justify-center animate-in fade-in duration-500">
        <EmptyState 
          title="Risks appear after you upload data for a business." 
          description="Complete your business profile or select a workspace to inspect ledger anomalies and risks." 
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
    <div className="space-y-7 animate-kaeo-fade pb-20">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="page-title">Risk Inbox</h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(194,65,58,0.10)', color: '#C2413A', border: '1px solid rgba(194,65,58,0.20)' }}>Live Monitoring</span>
          </div>
          <p className="page-subtitle">Duplicate payments, risky vendors, uncategorized rows, and month-end blockers for <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{activeClient.name}</span>.</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {diagnostics.lastScan && (
            <div className="hidden md:flex items-center gap-3 px-3.5 py-2 rounded-xl text-[11px] font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
              <span className="flex items-center gap-1.5"><Database className="w-3 h-3" /> {diagnostics.txLoaded} txns</span>
              <span className="w-px h-3" style={{ background: 'var(--border)' }} />
              <span className="flex items-center gap-1.5" style={{ color: '#C2413A' }}><ShieldAlert className="w-3 h-3" /> {diagnostics.risksGenerated} risks</span>
              <span className="w-px h-3" style={{ background: 'var(--border)' }} />
              <span>Last: {diagnostics.lastScan}</span>
            </div>
          )}
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="btn-danger flex items-center gap-2"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
            {analyzing ? 'Scanning…' : 'Identify Risks'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl flex gap-3 items-start" style={{ background: 'rgba(194,65,58,0.06)', border: '1px solid rgba(194,65,58,0.20)' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#C2413A' }} />
          <div className="flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#C2413A' }}>Scan Error</p>
            <p className="text-[12px]" style={{ color: '#C2413A', opacity: 0.8 }}>{error}</p>
          </div>
          <button onClick={() => setError(null)} className="p-1 rounded-lg cursor-pointer transition-colors" style={{ color: '#C2413A' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading && risks.length === 0 ? (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#C2413A' }} />
          <p className="text-[13px] font-medium" style={{ color: 'var(--muted-foreground)' }}>Scanning ledger for anomalies…</p>
        </div>
      ) : txCount === 0 ? (
        <div className="frosted-card py-20 flex flex-col items-center justify-center text-center gap-5 animate-kaeo-fade">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--muted)' }}>
            <Search className="w-7 h-7" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
          </div>
          <div>
            <h3 className="text-[17px] font-semibold mb-1">Upload data to begin risk evaluation</h3>
            <p className="text-[13px] max-w-xs mx-auto" style={{ color: 'var(--muted-foreground)' }}>
              Upload financial statements or invoices to run anomaly detection.
            </p>
          </div>
          <button onClick={() => navigate('/files')} className="btn-primary">
            Upload files
          </button>
        </div>
      ) : risks.length === 0 ? (
        <div className="frosted-card py-20 flex flex-col items-center justify-center text-center gap-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(22,138,91,0.10)', border: '1px solid rgba(22,138,91,0.20)' }}>
            <CheckCircle2 className="w-7 h-7" style={{ color: '#168A5B' }} />
          </div>
          <div>
            <h3 className="text-[17px] font-semibold mb-1" style={{ color: '#168A5B' }}>No open risks right now</h3>
            <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>New risks will appear after uploads or rule checks.</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Open Risks"
              value={stats.open.toString()}
              valueClassName="text-2xl font-bold text-[#C2413A]"
              description="Awaiting review"
              icon={<ShieldAlert className="w-4 h-4" />}
              accentColor="danger"
            />
            <MetricCard
              title="Exposure"
              value={formatCurrency(stats.amount)}
              valueClassName="text-2xl font-bold text-[#B7791F]"
              description="Potential leakage"
              icon={<Zap className="w-4 h-4" />}
              accentColor="warning"
            />
            <MetricCard
              title="Critical Issues"
              value={stats.critical.toString()}
              valueClassName={`text-2xl font-bold ${stats.critical > 0 ? 'text-[#C2413A]' : 'text-[#168A5B]'}`}
              description="High / critical severity"
              icon={<AlertCircle className="w-4 h-4" />}
              accentColor={stats.critical > 0 ? 'danger' : 'success'}
            />
          </div>

          {/* Risk list + detail panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-3">
              {filteredRisks.length === 0 ? (
                <div className="frosted-card py-12 text-center">
                  <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>No risks matching &ldquo;{searchVal}&rdquo; found.</p>
                </div>
              ) : (
                filteredRisks.map((risk) => (
                  <div
                    key={risk.id}
                    onClick={() => {
                      setSelectedRisk(risk);
                      fetchNotes(risk.id);
                    }}
                    className={`frosted-card p-5 cursor-pointer relative overflow-hidden transition-all ${
                      selectedRisk?.id === risk.id 
                        ? 'border-primary shadow-sm bg-primary/[0.02]' 
                        : 'frosted-card-hover hover:border-primary/40'
                    }`}
                  >
                    {risk.status !== 'open' && (
                      <div className="absolute top-0 right-0 px-2.5 py-1 text-[10px] font-semibold rounded-bl-lg" style={{ background: 'rgba(22,138,91,0.10)', color: '#168A5B', borderLeft: '1px solid rgba(22,138,91,0.20)', borderBottom: '1px solid rgba(22,138,91,0.20)' }}>
                        {risk.status.replace(/_/g, ' ')}
                      </div>
                    )}

                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: risk.severity === 'critical' || risk.severity === 'high' ? 'rgba(224,84,80,0.12)' : 'var(--muted)',
                          color: risk.severity === 'critical' || risk.severity === 'high' ? '#E05450' : 'var(--muted-foreground)'
                        }}>
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-foreground text-[14px]">{risk.title}</h3>
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${getSeverityColor(risk.severity)}`}>
                                {risk.severity}
                              </span>
                            </div>
                            <p className="text-[12px] text-[var(--foreground-muted)] leading-normal mt-1">{risk.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-black text-[var(--danger)]">{formatCurrency(risk.amount_at_risk)}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{getFriendlyRiskType(risk.risk_type)}</p>
                          </div>
                        </div>

                        {/* Affected transactions & Recommended action details */}
                        <div className="bg-[var(--muted)] p-2.5 rounded-lg text-[11px] space-y-1">
                          <p className="text-[var(--muted-foreground)]">
                            <span className="font-semibold text-[var(--foreground)]">Recommended Action:</span> {risk.suggested_action}
                          </p>
                          {(risk.evidence_json?.transaction_id || risk.evidence_json?.tx_id) && (
                            <p className="text-[10px] text-[var(--muted-foreground)]">
                              <span className="font-semibold">Affected Tx ID:</span> <code className="bg-[var(--card)] px-1 py-0.5 rounded text-[var(--foreground)]">{risk.evidence_json.transaction_id || risk.evidence_json.tx_id}</code>
                            </p>
                          )}
                        </div>

                        {/* Card actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/30">
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={(e) => { e.stopPropagation(); updateStatus(risk.id, 'reviewed'); }}
                              className="px-2.5 py-1 text-[10px] font-semibold rounded bg-[rgba(15,118,110,0.08)] text-[var(--primary)] hover:bg-[rgba(15,118,110,0.15)] transition-colors"
                            >
                              Review
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateStatus(risk.id, 'resolved'); }}
                              className="px-2.5 py-1 text-[10px] font-semibold rounded bg-[rgba(22,138,91,0.08)] text-[var(--success)] hover:bg-[rgba(22,138,91,0.15)] transition-colors"
                            >
                              Mark resolved
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateStatus(risk.id, 'ignored'); }}
                              className="px-2.5 py-1 text-[10px] font-semibold rounded bg-[rgba(93,107,102,0.06)] text-[var(--muted-foreground)] hover:bg-[rgba(93,107,102,0.12)] transition-colors"
                            >
                              Ignore
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRisk(risk);
                                fetchNotes(risk.id);
                                setTimeout(() => {
                                  document.getElementById('strategic-note-input')?.focus();
                                }, 100);
                              }}
                              className="px-2.5 py-1 text-[10px] font-semibold rounded bg-transparent border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors animate-pulse"
                            >
                              Create report note
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                            <MessageSquare className="w-3.5 h-3.5" /> {risk.notes_count || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="lg:col-span-4">
              <div className="sticky top-8 space-y-6">
                {selectedRisk ? (
                  <div className="frosted-card overflow-hidden shadow-xl animate-in slide-in-from-right-4 duration-300">
                    <div className="p-6 bg-muted/20 border-b border-border/50">
                      <div className="flex items-center justify-between mb-4">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${getSeverityColor(selectedRisk.severity)}`}>
                          {selectedRisk.severity}
                        </span>
                        <button onClick={() => setSelectedRisk(null)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="font-bold text-lg mb-1">{selectedRisk.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-primary/30 pl-3 mb-4">
                        {selectedRisk.suggested_action}
                      </p>
                      
                      {selectedRisk.evidence_json && (
                        <div className="bg-background/50 rounded-xl p-3 border border-border/50 space-y-2">
                          <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                            <Terminal className="w-3 h-3" /> Risk Evidence
                          </h4>
                          <div className="text-[10px] text-foreground/80 leading-relaxed font-medium">
                            <p className="mb-2">{selectedRisk.description}</p>
                            {selectedRisk.evidence_json.reason && <p className="opacity-70">• {selectedRisk.evidence_json.reason}</p>}
                            {selectedRisk.evidence_json.vendor_name && <p className="opacity-70">• Vendor: {selectedRisk.evidence_json.vendor_name}</p>}
                            {selectedRisk.evidence_json.transaction_count && <p className="opacity-70">• Occurrences: {selectedRisk.evidence_json.transaction_count}</p>}
                          </div>
                        </div>
                      )}

                      {(() => {
                        const riskSuggestion = suggestions.find(
                          s => s.entity_type === 'risk' && s.entity_id === selectedRisk.id
                        );

                        if (!riskSuggestion) return null;

                        return (
                          <div className="mt-3 p-3 bg-[var(--secondary)] border border-[var(--border)] rounded-xl space-y-2">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-[var(--primary)] flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 animate-pulse" /> Kaeo Recommendation
                            </h4>
                            <div className="text-[10px] text-foreground/90 font-medium space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="bg-primary/10 text-[var(--primary)] px-1.5 py-0.5 rounded text-[8px] font-black uppercase">
                                  {Math.round(riskSuggestion.confidence * 100)}% Confidence
                                </span>
                                <span className="text-muted-foreground">Action: {riskSuggestion.suggestion_type.replace(/_/g, ' ')}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground/90">{riskSuggestion.reason}</p>
                              <div className="flex gap-2 pt-1.5">
                                <button
                                  onClick={async () => {
                                    try {
                                      const { data: { user } } = await supabase.auth.getUser();
                                      await applyReviewSuggestion(riskSuggestion, 'approved', user?.id);
                                      toast('AI recommendation applied successfully', 'success');
                                      fetchRisks();
                                      setSelectedRisk(null);
                                    } catch (err: any) {
                                      setError('Failed to approve suggestion: ' + err.message);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-success text-black text-[9px] font-black rounded hover:bg-success/80 transition-all cursor-pointer"
                                >
                                  Approve Recommendation
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      const { data: { user } } = await supabase.auth.getUser();
                                      await applyReviewSuggestion(riskSuggestion, 'rejected', user?.id);
                                      toast('AI recommendation dismissed', 'info');
                                      fetchRisks();
                                      setSelectedRisk(null);
                                    } catch (err: any) {
                                      setError('Failed to reject suggestion: ' + err.message);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-risk text-white text-[9px] font-black rounded hover:bg-risk/80 transition-all cursor-pointer"
                                >
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="p-6 space-y-6">
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Risk Status</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <button 
                            onClick={() => updateStatus(selectedRisk.id, 'resolved')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all ${selectedRisk.status === 'resolved' ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-muted/50 border-border hover:border-primary/30 text-muted-foreground'}`}
                          >
                            Mark Resolved
                          </button>
                          <button 
                            onClick={() => updateStatus(selectedRisk.id, 'reviewed')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all ${selectedRisk.status === 'reviewed' ? 'bg-success/10 border-success/40 text-success' : 'bg-muted/50 border-border hover:border-success/30 text-muted-foreground'}`}
                          >
                            Mark Reviewed
                          </button>
                          <button 
                            onClick={() => updateStatus(selectedRisk.id, 'ignored')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all ${selectedRisk.status === 'ignored' ? 'bg-muted border-border text-muted-foreground/50' : 'bg-muted/50 border-border hover:border-border text-muted-foreground'}`}
                          >
                            Ignore
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-border/30">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Action Links</h4>
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => {
                              const evidence = selectedRisk.evidence_json || {};
                              const txId = evidence.transaction_id || evidence.tx_id || selectedRisk.transaction_id;
                              const txIds = evidence.transaction_ids || selectedRisk.related_transaction_ids;

                              if (txIds && txIds.length > 0) {
                                navigate(`/transactions?transactionIds=${txIds.join(',')}`);
                              } else if (txId) {
                                navigate(`/transactions?transactionId=${txId}`);
                              } else {
                                const fallbackTerm = 
                                  evidence.vendor_name || 
                                  evidence.counterparty || 
                                  evidence.description || 
                                  selectedRisk.title || 
                                  '';
                                navigate(`/transactions?search=${encodeURIComponent(fallbackTerm)}`);
                              }
                            }}
                            className="px-3 py-2 rounded-lg text-[10px] font-bold border bg-[var(--surface-muted)] border-border/40 hover:border-primary/40 text-foreground transition-all cursor-pointer text-left flex justify-between items-center"
                          >
                            <span>Open Transaction</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          </button>

                          {selectedRisk.evidence_json?.vendor_name && (
                            <button 
                              onClick={() => {
                                navigate(`/vendors?search=${encodeURIComponent(selectedRisk.evidence_json.vendor_name)}`);
                              }}
                              className="px-3 py-2 rounded-lg text-[10px] font-bold border bg-[var(--surface-muted)] border-border/40 hover:border-primary/40 text-foreground transition-all cursor-pointer text-left flex justify-between items-center"
                            >
                              <span>Open Vendor</span>
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            </button>
                          )}

                          {(selectedRisk.risk_type.includes('invoice') || selectedRisk.evidence_json?.invoice_id) && (
                            <button 
                              onClick={() => {
                                navigate('/files?tab=invoices');
                              }}
                              className="px-3 py-2 rounded-lg text-[10px] font-bold border bg-[var(--surface-muted)] border-border/40 hover:border-primary/40 text-foreground transition-all cursor-pointer text-left flex justify-between items-center"
                            >
                              <span>Review Invoice</span>
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4 pt-6 border-t border-border/50">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center justify-between">
                          Notes & Audit Trail
                        </h4>
                        
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                          {notes.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic text-center py-4">No audit notes yet.</p>
                          ) : (
                            notes.map(note => (
                              <div key={note.id} className="p-3 bg-muted/30 rounded-xl space-y-1 border border-border/30">
                                <p className="text-xs text-foreground/90 leading-relaxed font-medium">{note.note}</p>
                                <div className="flex items-center justify-between text-[8px] text-muted-foreground/60 uppercase font-black tracking-tighter">
                                  <div className="flex items-center gap-1"><User className="w-2 h-2" /> You</div>
                                  <div>{new Date(note.created_at).toLocaleDateString()} at {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="flex gap-2">
                          <input 
                            id="strategic-note-input"
                            type="text" 
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Add strategic note..." 
                            className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-2 text-xs focus:ring-1 ring-primary/30 outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && addNote()}
                          />
                          <button 
                            onClick={addNote}
                            disabled={!newNote.trim()}
                            className="p-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-30 transition-all"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 border border-dashed border-border/60 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-12 h-12 bg-muted/30 rounded-2xl flex items-center justify-center text-muted-foreground/20">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium px-4 leading-relaxed">
                      Select a risk item to view strategic evidence and manage audit trail.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RiskInbox;
