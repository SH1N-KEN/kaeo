import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  AlertCircle, 
  Zap, 
  Loader2,
  Clock,
  MessageSquare,
  ArrowRight,
  MoreHorizontal,
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
import { formatMoney, needsConversion } from '../lib/currency';
import { analyzeRisksForClient } from '../lib/riskEngine';
import EmptyState from '../components/ui/EmptyState';
import MetricCard from '../components/ui/MetricCard';
import type { RiskEvent, Note } from '../types/finance';
import { trackAuditEvent } from '../lib/auditEngine';
import { useNavigate } from 'react-router-dom';
import { applyReviewSuggestion } from '../lib/reviewActions';
import { useToast } from '../hooks/useToast';

const RiskInbox: React.FC = () => {
  const navigate = useNavigate();
  const { activeClient, activeOrg } = useWorkspace();
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

  useEffect(() => {
    if (activeClient) {
      fetchTxCount();
      fetchRisks();
    }
  }, [activeClient]);

  const fetchTxCount = async () => {
    if (!activeClient) return;
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', activeClient.id);
    setTxCount(count || 0);
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
    return formatMoney(val, activeClient?.base_currency || 'INR');
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return 'bg-risk text-white';
      case 'high': return 'bg-risk/10 text-risk border-risk/20';
      case 'medium': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (!activeClient || !activeOrg) {
    return (
      <div className="h-[70vh] flex items-center justify-center animate-in fade-in duration-500">
        <EmptyState 
          title="No client workspace selected" 
          description="Select a client workspace to scan and audit high-risk vendor payments or anomalies." 
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Risk Inbox</h1>
            <div className="px-2 py-0.5 bg-risk/10 text-risk text-[10px] font-black rounded border border-risk/20 uppercase tracking-tighter">Monitoring Active</div>
          </div>
          <p className="text-sm text-muted-foreground">Automated financial anomaly detection for <span className="text-foreground font-semibold">{activeClient.name}</span></p>
        </div>
        
        <div className="flex items-center gap-3">
          {diagnostics.lastScan && (
            <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-muted/30 border border-border/50 rounded-xl text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><Database className="w-3 h-3" /> {diagnostics.txLoaded} Txns</span>
              <span className="w-1 h-1 bg-border rounded-full" />
              <span className="flex items-center gap-1.5 text-risk"><ShieldAlert className="w-3 h-3" /> {diagnostics.risksGenerated} Risks</span>
              <span className="w-1 h-1 bg-border rounded-full" />
              <span>Last: {diagnostics.lastScan}</span>
            </div>
          )}
          <button 
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-6 py-3 bg-risk text-white rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-risk/20 disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
            Identify Risks
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-risk/5 border border-risk/20 rounded-2xl flex gap-3 items-center animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-risk shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-black text-risk uppercase tracking-widest mb-0.5">Scan Error</p>
            <p className="text-xs text-risk/80 font-medium">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-risk/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-risk" />
          </button>
        </div>
      )}

      {loading && risks.length === 0 ? (
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-risk" />
          <p className="text-sm text-muted-foreground animate-pulse font-medium">Scanning ledger for anomalies...</p>
        </div>
      ) : txCount === 0 ? (
        <div className="bg-card/30 border border-dashed border-border/60 rounded-3xl p-20 flex flex-col items-center justify-center text-center space-y-5">
          <div className="w-16 h-16 bg-muted/30 rounded-2xl flex items-center justify-center border border-border/50 text-muted-foreground/30">
            <Search className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">No data to scan</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Import transactions first to enable automated risk monitoring.
            </p>
          </div>
        </div>
      ) : risks.length === 0 ? (
        <div className="bg-card/30 border border-dashed border-border/60 rounded-3xl p-20 flex flex-col items-center justify-center text-center space-y-5">
          <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center border border-success/20 text-success/50">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight text-success/80">Clean Ledger</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              No financial risks detected in the latest scan of {txCount} transactions.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard 
              title="Open Risks" 
              value={stats.open.toString()} 
              valueClassName="text-risk"
              description="Awaiting CFO review"
              icon={<ShieldAlert className="w-4 h-4 text-risk" />} 
            />
            <MetricCard 
              title="Review Exposure" 
              value={formatCurrency(stats.amount)} 
              valueClassName="text-warning"
              description="Potential leakage/loss"
              icon={<Zap className="w-4 h-4 text-warning" />} 
            />
            <MetricCard 
              title="Critical Issues" 
              value={stats.critical.toString()} 
              valueClassName="text-risk"
              description="Immediate action required"
              icon={<AlertCircle className="w-4 h-4 text-risk" />} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-4">
              {risks.map((risk) => (
                <div 
                  key={risk.id} 
                  onClick={() => {
                    setSelectedRisk(risk);
                    fetchNotes(risk.id);
                  }}
                  className={`bg-card border rounded-2xl p-6 transition-all cursor-pointer group hover:border-primary/40 shadow-sm relative overflow-hidden ${selectedRisk?.id === risk.id ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}
                >
                  {risk.status !== 'open' && (
                    <div className="absolute top-0 right-0 px-3 py-1 bg-success/10 text-success text-[8px] font-black uppercase tracking-tighter rounded-bl-lg border-l border-b border-success/20">
                      {risk.status.replace(/_/g, ' ')}
                    </div>
                  )}
                  
                  <div className="flex gap-6">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${risk.severity === 'critical' ? 'bg-risk text-white' : 'bg-muted text-muted-foreground'}`}>
                      {risk.risk_type.includes('duplicate') ? <MoreHorizontal className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground">{risk.title}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${getSeverityColor(risk.severity)}`}>
                              {risk.severity}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{risk.description || risk.suggested_action}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-risk">{formatCurrency(risk.amount_at_risk)}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{risk.risk_type.replace(/_/g, ' ')}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                            <Clock className="w-3 h-3" /> {new Date(risk.created_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                            <MessageSquare className="w-3 h-3" /> {risk.notes_count || 0} Notes
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-4">
              <div className="sticky top-8 space-y-6">
                {selectedRisk ? (
                  <div className="bg-card border border-primary/20 rounded-2xl overflow-hidden shadow-xl animate-in slide-in-from-right-4 duration-300">
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
                            {(() => {
                              const baseCurrency = activeClient?.base_currency || 'INR';
                              const isConverted = selectedRisk.evidence_json.original_currency && needsConversion(selectedRisk.evidence_json.original_currency, baseCurrency);
                              if (isConverted) {
                                const origAmt = selectedRisk.evidence_json.original_amount !== null && selectedRisk.evidence_json.original_amount !== undefined
                                  ? selectedRisk.evidence_json.original_amount
                                  : selectedRisk.evidence_json.amount;
                                return (
                                  <>
                                    <p className="opacity-70">• Original Amount: {formatMoney(origAmt, selectedRisk.evidence_json.original_currency)}</p>
                                    <p className="opacity-70">• Converted using stored FX rate: {Number(selectedRisk.evidence_json.exchange_rate || 1).toFixed(2)}</p>
                                  </>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      )}

                      {(() => {
                        const riskSuggestion = suggestions.find(
                          s => s.entity_type === 'risk' && s.entity_id === selectedRisk.id
                        );

                        if (!riskSuggestion) return null;

                        return (
                          <div className="mt-3 p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl space-y-2">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-teal-400 flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 animate-pulse" /> Kaeo Recommendation
                            </h4>
                            <div className="text-[10px] text-foreground/90 font-medium space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">
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
                        <div className="grid grid-cols-2 gap-2">
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
                          <button 
                            onClick={() => {
                              // If it has a related vendor name, go to vendors, else transactions
                              if (selectedRisk.evidence_json?.vendor_name) {
                                navigate('/vendors');
                              } else {
                                navigate('/transactions');
                              }
                            }}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all bg-muted/50 border-border hover:border-border text-muted-foreground`}
                          >
                            View Details
                          </button>
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
