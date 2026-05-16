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
  Plus
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import { analyzeRisksForClient } from '../lib/riskEngine';
import EmptyState from '../components/ui/EmptyState';
import MetricCard from '../components/ui/MetricCard';

const RiskInbox: React.FC = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [risks, setRisks] = useState<any[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<any | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [stats, setStats] = useState({
    critical: 0,
    amount: 0,
    open: 0
  });

  useEffect(() => {
    if (activeClient) fetchRisks();
  }, [activeClient]);

  const fetchRisks = async () => {
    if (!activeClient) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('risk_events')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('severity', { ascending: false });

      if (error) throw error;
      setRisks(data || []);

      const s = (data || []).reduce((acc, r) => {
        if (r.severity === 'critical' || r.severity === 'high') acc.critical++;
        if (r.status === 'open') {
          acc.open++;
          acc.amount += Number(r.amount_at_risk);
        }
        return acc;
      }, { critical: 0, amount: 0, open: 0 });
      setStats(s);

    } catch (err) {
      console.error('[Risk] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!activeClient || !activeOrg) return;
    setAnalyzing(true);
    try {
      await analyzeRisksForClient(activeOrg.id, activeClient.id);
      await fetchRisks();
    } catch (err) {
      console.error('[Risk] Analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const updateStatus = async (riskId: string, status: string) => {
    try {
      await supabase.from('risk_events').update({ status }).eq('id', riskId);
      fetchRisks();
      if (selectedRisk?.id === riskId) setSelectedRisk({ ...selectedRisk, status });
    } catch (err) {
      console.error('[Risk] Update status failed:', err);
    }
  };

  const fetchNotes = async (riskId: string) => {
    try {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('parent_id', riskId)
        .order('created_at', { ascending: false });
      setNotes(data || []);
    } catch (err) {
      console.error('[Notes] Fetch error:', err);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !selectedRisk || !activeOrg || !activeClient) return;
    try {
      const { data: user } = await supabase.auth.getUser();
      await supabase.from('notes').insert({
        organization_id: activeOrg.id,
        client_id: activeClient.id,
        parent_type: 'risk_event',
        parent_id: selectedRisk.id,
        content: newNote,
        created_by: user.user?.id
      });
      setNewNote('');
      fetchNotes(selectedRisk.id);
    } catch (err) {
      console.error('[Notes] Add failed:', err);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return 'bg-risk text-white';
      case 'high': return 'bg-risk/10 text-risk border-risk/20';
      case 'medium': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (!activeClient) {
    return <EmptyState title="No client selected" description="Select a client to view risk inbox." />;
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
        
        <button 
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-6 py-3 bg-risk text-white rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-risk/20 disabled:opacity-50"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
          {risks.length > 0 ? 'Run Security Scan' : 'Identify Risks'}
        </button>
      </div>

      {loading && risks.length === 0 ? (
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-risk" />
          <p className="text-sm text-muted-foreground animate-pulse font-medium">Scanning ledger for anomalies...</p>
        </div>
      ) : risks.length === 0 ? (
        <div className="bg-card/30 border border-dashed border-border/60 rounded-3xl p-20 flex flex-col items-center justify-center text-center space-y-5">
          <div className="w-16 h-16 bg-muted/30 rounded-2xl flex items-center justify-center border border-border/50 text-muted-foreground/30">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">Clean Ledger</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              No financial risks detected. Run a scan if you have recently imported new transactions.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard 
              title="Open Risks" 
              value={stats.open.toString()} 
              description="Awaiting CFO review"
              icon={<ShieldAlert className="w-4 h-4 text-risk" />} 
            />
            <MetricCard 
              title="Amount at Risk" 
              value={formatCurrency(stats.amount)} 
              description="Potential leakage/loss"
              icon={<Zap className="w-4 h-4 text-warning" />} 
            />
            <MetricCard 
              title="Critical Issues" 
              value={stats.critical.toString()} 
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
                      Resolved
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
                          <p className="text-xs text-muted-foreground line-clamp-1">{risk.suggested_action}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-foreground">{formatCurrency(risk.amount_at_risk)}</p>
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
                      <p className="text-xs text-muted-foreground leading-relaxed">{selectedRisk.suggested_action}</p>
                    </div>

                    <div className="p-6 space-y-6">
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Risk Status</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => updateStatus(selectedRisk.id, 'confirmed')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all ${selectedRisk.status === 'confirmed' ? 'bg-risk/10 border-risk/40 text-risk' : 'bg-muted/50 border-border hover:border-risk/30 text-muted-foreground'}`}
                          >
                            Confirm Issue
                          </button>
                          <button 
                            onClick={() => updateStatus(selectedRisk.id, 'reviewed')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all ${selectedRisk.status === 'reviewed' ? 'bg-success/10 border-success/40 text-success' : 'bg-muted/50 border-border hover:border-success/30 text-muted-foreground'}`}
                          >
                            Reviewed
                          </button>
                          <button 
                            onClick={() => updateStatus(selectedRisk.id, 'false_positive')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all ${selectedRisk.status === 'false_positive' ? 'bg-muted border-foreground/20 text-foreground' : 'bg-muted/50 border-border hover:border-border text-muted-foreground'}`}
                          >
                            False Positive
                          </button>
                          <button 
                            onClick={() => updateStatus(selectedRisk.id, 'ignored')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all ${selectedRisk.status === 'ignored' ? 'bg-muted border-border text-muted-foreground/50' : 'bg-muted/50 border-border hover:border-border text-muted-foreground'}`}
                          >
                            Ignore
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 pt-6 border-t border-border/50">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center justify-between">
                          Notes & Audit Trail
                          <span className="text-[8px] font-bold text-muted-foreground/40 italic">Phase 5</span>
                        </h4>
                        
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                          {notes.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic text-center py-4">No audit notes yet.</p>
                          ) : (
                            notes.map(note => (
                              <div key={note.id} className="p-3 bg-muted/30 rounded-xl space-y-1 border border-border/30">
                                <p className="text-xs text-foreground/90 leading-relaxed font-medium">{note.content}</p>
                                <p className="text-[8px] text-muted-foreground/60 uppercase font-black tracking-tighter">
                                  {new Date(note.created_at).toLocaleDateString()} at {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
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
