import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Sparkles,
  TrendingUp,
  Loader2,
  Info,
} from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { supabase } from '../../lib/supabase';
import {
  applyReviewSuggestion,
  applyReviewSuggestionsBulk,
} from '../../lib/reviewActions';
import { generateMonthEndReviewPlan, syncReviewSuggestions } from '../../lib/aiReviewEngine';
import { useToast } from '../../hooks/useToast';
import { useNavigate } from 'react-router-dom';

interface AIReviewQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent?: () => void;
}

export const AIReviewQueueModal: React.FC<AIReviewQueueModalProps> = ({
  isOpen,
  onClose,
  onRefreshParent,
}) => {
  const { activeClient, activeOrg } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);

  // Projection state
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    if (isOpen && activeClient) {
      loadData();
    }
  }, [isOpen, activeClient]);

  const loadData = async () => {
    if (!activeClient || !activeOrg) return;
    setLoading(true);
    try {
      // 1. Sync & fetch suggestions
      let sugData: any[] = [];
      try {
        sugData = await syncReviewSuggestions(activeOrg.id, activeClient.id);
      } catch (err) {
        console.warn('Sync suggestions failed, fetching existing', err);
        const { data } = await supabase
          .from('ai_review_suggestions')
          .select('*')
          .eq('client_id', activeClient.id)
          .eq('status', 'pending');
        sugData = data || [];
      }
      setSuggestions(sugData || []);

      // 2. Fetch transactions and risks for readiness projection
      const [txRes, riskRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('client_id', activeClient.id),
        supabase.from('risk_events').select('*').eq('client_id', activeClient.id),
      ]);

      const txs = txRes.data || [];
      const rks = riskRes.data || [];
      setTransactions(txs);
      setRisks(rks);

      // 3. Compile Month-end plan and projections
      const compiledPlan = generateMonthEndReviewPlan(txs, rks, sugData || []);
      setPlan(compiledPlan);
    } catch (err: any) {
      toast(err.message || 'Failed to load review suggestions queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (suggestion: any, status: 'approved' | 'rejected') => {
    setProcessingId(suggestion.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await applyReviewSuggestion(suggestion, status, user?.id);

      toast(
        `Suggestion ${status === 'approved' ? 'approved & applied' : 'rejected'} successfully`,
        'success'
      );

      // Update local state
      const updatedSugs = suggestions.filter((s) => s.id !== suggestion.id);
      setSuggestions(updatedSugs);

      // Re-compile projection
      const compiledPlan = generateMonthEndReviewPlan(transactions, risks, updatedSugs);
      setPlan(compiledPlan);

      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      toast(err.message || 'Action failed', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkAction = async (mode: 'safe' | 'reject_all') => {
    setBulkProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (mode === 'safe') {
        const safeSugs = suggestions.filter((s) => !s.requires_approval);
        if (safeSugs.length === 0) {
          toast('No safe auto-categorization suggestions found', 'info');
          return;
        }
        const confirmBulk = window.confirm(
          `Are you sure you want to approve and apply all ${safeSugs.length} safe auto-categorization suggestions?\n\nThis will automatically update matching transaction categories. This action cannot be undone.`
        );
        if (!confirmBulk) return;
        await applyReviewSuggestionsBulk(safeSugs, 'approved', user?.id);
        toast(`Approved and applied ${safeSugs.length} safe suggestions`, 'success');
      } else if (mode === 'reject_all') {
        const confirmBulk = window.confirm(
          `Are you sure you want to reject and clear all ${suggestions.length} pending suggestions?\n\nThis will remove them from the AI review list. This action cannot be undone.`
        );
        if (!confirmBulk) return;
        await applyReviewSuggestionsBulk(suggestions, 'rejected', user?.id);
        toast('Rejected all pending suggestions', 'success');
      }

      await loadData();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      toast(err.message || 'Bulk action failed', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-card border border-border/80 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">AI Review Suggestions</h2>
              <p className="text-xs text-muted-foreground">Kaeo can prepare suggested categories and review actions. You approve before anything changes.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Readiness Projections Banner */}
        {plan && suggestions.length > 0 && (
          <div className="bg-teal-500/10 border-b border-teal-500/20 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-semibold text-foreground/90">
                Ready to optimize: Approve <strong className="text-teal-400">{plan.safeCount} safe suggestions</strong> to move readiness from{' '}
                <strong className="text-risk">{plan.currentScore}%</strong> to approximately{' '}
                <strong className="text-success">{plan.projectedScore}%</strong>.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={bulkProcessing || plan.safeCount === 0}
                onClick={() => handleBulkAction('safe')}
                className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-black text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40 shrink-0"
              >
                Approve Safe Suggestions
              </button>
              <button
                disabled={bulkProcessing || suggestions.length === 0}
                onClick={() => handleBulkAction('reject_all')}
                className="px-3.5 py-1.5 bg-muted/40 hover:bg-muted text-foreground text-[11px] font-semibold rounded-lg border border-border/40 transition-colors cursor-pointer disabled:opacity-40 shrink-0"
              >
                Reject All
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
              <p className="text-xs text-muted-foreground font-semibold">Running audit engine scans…</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold">No AI suggestions yet</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Kaeo can prepare suggested categories and review actions. You approve before anything changes.
                </p>
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-colors flex items-center gap-1.5 mx-auto cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Prepare suggestions
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((sug) => {
                const isHigh = sug.priority === 'high';
                const isMedium = sug.priority === 'medium';
                const priorityBadge = isHigh
                  ? 'bg-risk/10 text-risk border-risk/20'
                  : isMedium
                  ? 'bg-warning/10 text-warning border-warning/20'
                  : 'bg-muted text-muted-foreground border-border/40';

                const displayType = sug.entity_type.toUpperCase();

                return (
                  <div
                    key={sug.id}
                    className={`p-4 bg-muted/20 border border-border/40 rounded-xl flex flex-col sm:flex-row justify-between gap-4 transition-all hover:border-border/80 ${
                      processingId === sug.id ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20">
                          {displayType}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${priorityBadge}`}>
                          {sug.priority} Priority
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          Confidence: {Math.round(sug.confidence * 100)}%
                        </span>
                        {!sug.requires_approval && (
                          <span className="text-[8px] font-black uppercase text-success bg-success/10 px-2 py-0.5 rounded border border-success/20">
                            Auto-review safe
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-foreground font-semibold leading-relaxed">
                        <span className="text-muted-foreground mr-1">Kaeo Suggests:</span>
                        <code className="bg-white/5 border border-border/40 px-1.5 py-0.5 rounded font-mono font-bold text-teal-400">
                          {typeof sug.proposed_value === 'object' && sug.proposed_value !== null
                            ? sug.proposed_value.category || JSON.stringify(sug.proposed_value)
                            : String(sug.proposed_value)}
                        </code>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                        <span className="text-foreground/70 font-semibold">Why:</span> {sug.reason}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => {
                          onClose();
                          if (sug.entity_type === 'transaction') {
                            navigate(`/transactions?search=${sug.entity_id || ''}`);
                          } else if (sug.entity_type === 'risk') {
                            navigate(`/risk-inbox?search=${sug.entity_id || ''}`);
                          } else {
                            navigate(`/transactions`);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl text-[10px] transition-colors border border-border/40 shrink-0 cursor-pointer inline-flex items-center gap-1"
                        title="Open item details"
                      >
                        Open item
                      </button>
                      <button
                        onClick={() => handleAction(sug, 'approved')}
                        disabled={processingId !== null}
                        className="w-8 h-8 rounded-lg bg-success/15 hover:bg-success text-success hover:text-black flex items-center justify-center transition-all cursor-pointer border border-success/25 hover:border-transparent shrink-0"
                        title="Approve suggestion"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAction(sug, 'rejected')}
                        disabled={processingId !== null}
                        className="w-8 h-8 rounded-lg bg-risk/15 hover:bg-risk text-risk hover:text-white flex items-center justify-center transition-all cursor-pointer border border-risk/25 hover:border-transparent shrink-0"
                        title="Reject suggestion"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between bg-muted/10 shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold">
            <Info className="w-3.5 h-3.5" />
            <span>AI Review Mode changes require explicit human confirmation.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-muted text-foreground border border-border rounded-xl text-xs font-semibold hover:bg-muted/80 transition-colors cursor-pointer"
          >
            Close Queue
          </button>
        </div>
      </div>
    </div>
  );
};
