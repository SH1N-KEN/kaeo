import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAskKaeoChat } from '../hooks/useAskKaeoChat';
import { Send, AlertCircle, User, Zap, Sparkles, ExternalLink } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';

import { useToast } from '../hooks/useToast';
import { useAuth } from '../components/auth/AuthProvider';
import { useWorkspaceRefresh, triggerWorkspaceRefresh } from '../hooks/useWorkspaceRefresh';
import {
  getAvailableLibbyActionsForContext,
  applyLibbyAction,
  rejectLibbyAction,
  clearLibbyActions,
  clearAllLibbyActions,
  EXECUTABLE_ACTION_TYPES,
  type LibbyAction
} from '../lib/libbyActions';

const renderStructuredContent = (content: string) => {
  if (!content) return null;
  // If the content is simple text, just render standard paragraph
  if (!content.includes('\n') && content.length < 150) {
    return <p className="text-sm leading-relaxed">{content}</p>;
  }

  const lines = content.split('\n');
  const sections: { title: string; items: string[]; type: 'summary' | 'numbers' | 'risks' | 'actions' | 'sources' | 'general' }[] = [];
  
  let currentSection: { title: string; items: string[]; type: 'summary' | 'numbers' | 'risks' | 'actions' | 'sources' | 'general' } = { title: '', items: [], type: 'general' };
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    const headerMatch = trimmed.match(/^(?:###|\*\*|### \*\*)\s*(Summary|Key [nN]umbers|Risks? [fF]ound|Risks?|Recommended [nN]ext [aA]ctions|Recommended [aA]ctions|Next [aA]ctions|Sources?|Source [tT]ransactions)\s*(?::|\*\*|: \*\*|$)/i);
    
    if (headerMatch) {
      if (currentSection.title || currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      
      const title = headerMatch[1];
      let type: 'summary' | 'numbers' | 'risks' | 'actions' | 'sources' | 'general' = 'general';
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('summary')) type = 'summary';
      else if (lowerTitle.includes('number')) type = 'numbers';
      else if (lowerTitle.includes('risk')) type = 'risks';
      else if (lowerTitle.includes('action')) type = 'actions';
      else if (lowerTitle.includes('source')) type = 'sources';
      
      currentSection = { title, items: [], type };
    } else {
      const cleanedLine = trimmed.replace(/^[-*+]\s+/, '').replace(/^###\s+/, '');
      currentSection.items.push(cleanedLine);
    }
  });
  
  if (currentSection.title || currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  if (sections.length <= 1) {
    return <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map((sec, idx) => {
        if (sec.type === 'summary') {
          return (
            <div key={idx} className="pb-3 border-b border-border/30">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Summary</h4>
              <p className="text-sm font-medium leading-relaxed text-foreground">{sec.items.join(' ')}</p>
            </div>
          );
        }
        
        if (sec.type === 'numbers') {
          return (
            <div key={idx} className="bg-[var(--muted)] p-3.5 rounded-xl border border-[var(--border)]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                Key Metrics & Numbers
              </h4>
              <ul className="space-y-1.5">
                {sec.items.map((item, i) => (
                  <li key={i} className="text-xs text-[var(--foreground)] font-medium leading-normal flex items-start gap-2">
                    <span className="text-[var(--primary)] mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        if (sec.type === 'risks') {
          return (
            <div key={idx} className="bg-[rgba(224,84,80,0.03)] p-3.5 rounded-xl border border-[rgba(224,84,80,0.12)]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--danger)] mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)]" />
                Anomalies & Risks Found
              </h4>
              <ul className="space-y-1.5">
                {sec.items.map((item, i) => (
                  <li key={i} className="text-xs text-[var(--danger)] font-medium leading-normal flex items-start gap-2">
                    <span className="text-[var(--danger)] mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        if (sec.type === 'actions') {
          return (
            <div key={idx} className="bg-[rgba(15,118,110,0.03)] p-3.5 rounded-xl border border-[rgba(15,118,110,0.12)]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
                Recommended Next Actions
              </h4>
              <ul className="space-y-1.5">
                {sec.items.map((item, i) => (
                  <li key={i} className="text-xs text-[var(--foreground)] font-medium leading-normal flex items-start gap-2">
                    <span className="text-[var(--primary)] mt-0.5">&rarr;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        if (sec.type === 'sources') {
          return (
            <div key={idx} className="bg-[rgba(93,107,102,0.04)] p-3.5 rounded-xl border border-[var(--border)]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)]" />
                Grounding Sources & Files
              </h4>
              <ul className="space-y-1.5">
                {sec.items.map((item, i) => (
                  <li key={i} className="text-[11px] text-[var(--muted-foreground)] leading-normal flex items-start gap-2">
                    <span className="text-[var(--muted-foreground)] mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        return (
          <div key={idx} className="space-y-1">
            {sec.title && <h5 className="text-xs font-semibold text-foreground mt-2">{sec.title}</h5>}
            <ul className="space-y-1">
              {sec.items.map((item, i) => (
                <li key={i} className="text-xs text-[var(--muted-foreground)] leading-normal">{item}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

const AskKaeo = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { messages, loading, dbError, sendMessage } = useAskKaeoChat();
  const [input, setInput] = useState('');
  const [preparedActions, setPreparedActions] = useState<LibbyAction[]>([]);
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  // Track previous client and organization to clear stale actions on scope switch
  const prevClientIdRef = useRef<string | null>(null);
  const prevOrgIdRef = useRef<string | null>(null);

  const loadPreparedActions = useCallback(async () => {
    if (activeClient?.id && activeOrg?.id) {
      const acts = await getAvailableLibbyActionsForContext(activeClient.id, activeOrg.id);
      setPreparedActions(acts);
    }
  }, [activeClient?.id, activeOrg?.id]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Wipes legacy keys once on app load
  useEffect(() => {
    clearAllLibbyActions();
  }, []);

  // Clear stale actions when the active client/org changes, then reload for new scope
  useEffect(() => {
    const newClientId = activeClient?.id ?? null;
    const newOrgId = activeOrg?.id ?? null;
    const prevClientId = prevClientIdRef.current;
    const prevOrgId = prevOrgIdRef.current;

    if ((prevClientId && prevClientId !== newClientId) || (prevOrgId && prevOrgId !== newOrgId)) {
      if (prevClientId && prevOrgId) {
        clearLibbyActions(prevOrgId, prevClientId);
      }
      setPreparedActions([]);
    }

    prevClientIdRef.current = newClientId;
    prevOrgIdRef.current = newOrgId;

    if (newClientId && newOrgId) {
      loadPreparedActions();
    }
  }, [activeClient?.id, activeOrg?.id, loadPreparedActions]);

  useEffect(() => {
    if (activeClient?.id && activeOrg?.id) {
      loadPreparedActions();
    } else {
      setPreparedActions([]);
    }
  }, [loadPreparedActions, messages, activeClient?.id, activeOrg?.id]);

  // Refresh prepared actions when a workspace-wide refresh is triggered
  useWorkspaceRefresh(useCallback(() => {
    loadPreparedActions();
  }, [loadPreparedActions]));

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    await sendMessage(userText);
  };

  const [activeModalAction, setActiveModalAction] = useState<LibbyAction | null>(null);

  const handleExecuteAction = async (action: LibbyAction) => {
    if (!activeClient?.id || !activeOrg?.id) return;
    const result = await applyLibbyAction(activeOrg.id, activeClient.id, action.id, user?.id || undefined);
    if (result.success) {
      toast(result.message, 'success');
      triggerWorkspaceRefresh('libby_action_applied');
      loadPreparedActions();
    } else {
      // Show the real error
      toast(result.message, 'error');
      // If it's a scope mismatch, auto-refresh actions to clear stale suggestions
      const isScopeMismatch = result.message.includes('another business') || result.message.includes('different business') || result.message.includes('out of date') || result.message.includes('no longer exist');
      if (isScopeMismatch) {
        clearLibbyActions(activeOrg.id, activeClient.id);
        loadPreparedActions();
      }
    }
  };

  const handleRejectAction = async (actionId: string) => {
    if (!activeClient?.id || !activeOrg?.id) return;
    const success = await rejectLibbyAction(activeOrg.id, activeClient.id, actionId, user?.id || undefined);
    if (success) {
      toast('Suggestion dismissed.', 'success');
      loadPreparedActions();
    }
  };

  if (!activeClient || !activeOrg) {
    return (
      <div className="h-[70vh] flex items-center justify-center animate-in fade-in duration-500">
        <EmptyState 
          title="No client workspace selected"
          description="Create or select a client workspace to consult with Libby, Kaeo's AI finance assistant."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-start pb-12 animate-in fade-in duration-500">
      
      {/* Left/Center Column: Chat Box */}
      <div className="lg:col-span-2 flex flex-col h-[calc(100vh-10rem)] rounded-2xl overflow-hidden shadow-sm frosted-panel">
        {/* HEADER */}
        <div className="p-4 border-b bg-transparent flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/18 flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-[var(--primary)]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-foreground leading-none">Ask Libby</h2>
                <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/15 shrink-0">
                  Grounded
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-none">
                AI-assisted finance review
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {dbError && (
              <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 px-3 py-1.5 rounded-full border border-warning/20">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Chat not saved. Your answer still works.</span>
              </div>
            )}
          </div>
        </div>


        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center h-full max-w-md mx-auto px-4 py-8">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4 animate-pulse">
                <Sparkles className="w-8 h-8 text-teal-400" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">Ask Libby</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                Libby is Kaeo’s AI finance operator. Ask her to find risks, summarize spend, review vendors, and generate accountant-ready reports.
              </p>
              <div className="w-full space-y-2">
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-2 text-left">Suggested Questions</p>

                {[
                  "What should I fix first?",
                  "Review my transactions",
                  "Which vendors need attention?",
                  "Are we ready for month-end?",
                  "Prepare my accountant pack"
                ].map((query, idx) => (
                  <button
                    key={idx}
                    onClick={async () => {
                      await sendMessage(query);
                    }}
                    className="w-full text-left px-4 py-3 bg-card hover:bg-[var(--muted)] text-foreground font-semibold rounded-xl border border-border/60 hover:border-[var(--primary)]/30 text-xs transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <span className="font-medium">{query}</span>
                    <Sparkles className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[var(--primary)] transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isLimitExceeded = msg.source_json?.mode === 'limit_exceeded';
              const isGreeting = msg.source_json?.mode === 'greeting';
              const isError = msg.source_json?.mode === 'error';

              return (
                <div key={msg.id || idx} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(15,118,110,0.10)' }}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--primary)', boxShadow: '0 0 6px rgba(15,118,110,0.35)' }} />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-1.5 max-w-[80%] md:max-w-[70%]">
                    <div className={`rounded-2xl px-4 py-3 ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm font-medium' : 'bg-muted/40 border border-border/40 text-foreground rounded-tl-sm font-normal'}`}>
                      <div className="text-[13px] leading-relaxed">
                        {renderStructuredContent(msg.content)}
                      </div>
                      {isLimitExceeded && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <button
                            onClick={() => navigate('/billing')}
                            className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold rounded-lg transition-all shadow-md shadow-primary/10 inline-flex items-center gap-1.5 cursor-pointer animate-in fade-in"
                          >
                            <Zap className="w-3.5 h-3.5 text-warning fill-warning" />
                            Upgrade Subscription
                          </button>
                        </div>
                      )}
                      {msg.source_json?.cta === 'open_ai_review' && (
                        <div className="mt-3">
                          <button
                            onClick={() => navigate('/transactions?review_status=ai_suggested')}
                            className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-black text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Open AI Review
                          </button>
                        </div>
                      )}
                      {isGreeting && (
                        <div className="mt-3 max-w-xs">
                          <button
                            onClick={async () => {
                              await sendMessage("Review my transactions");
                            }}
                            className="w-full text-left px-3 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 font-semibold rounded-lg border border-teal-500/20 text-xs transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            "Review my transactions"
                          </button>
                        </div>
                      )}
                      {!isUser && !isGreeting && !isLimitExceeded && !isError && (
                        <div className="mt-2.5 pt-2.5 border-t border-border/10 text-[9px] text-muted-foreground/85 flex items-center gap-1.5 font-medium animate-in fade-in">
                          <Sparkles className="w-2.5 h-2.5" style={{ color: 'var(--primary)' }} />
                          {(() => {
                            const status = msg.source_json?.grounding_status;
                            if (status === 'verified') return 'Verified from Kaeo data';
                            if (status === 'general') return 'General recommendation';
                            return 'Based on Kaeo data';
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {isUser && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center border">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          
          {loading && (
            <div className="flex gap-4 justify-start">
              <div className="flex-shrink-0 mt-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(15,118,110,0.10)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--primary)', boxShadow: '0 0 6px rgba(15,118,110,0.35)' }} />
                </div>
              </div>
              <div className="bg-muted/40 border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'rgba(15,118,110,0.5)', animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'rgba(15,118,110,0.5)', animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'rgba(15,118,110,0.5)', animationDelay: '300ms' }} />
                <span className="text-[10px] text-muted-foreground ml-1.5 font-semibold">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-4 border-t border-[var(--border)] bg-transparent shrink-0">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Libby what to review…"
              className="flex-1 frosted-input border-border/30 placeholder:text-muted-foreground/45"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
          <div className="text-center mt-2.5">
            <p className="text-[10px] text-muted-foreground/80 font-medium">Libby uses your business data to keep answers useful and grounded.</p>
          </div>
        </div>
      </div>

      {/* Right Column: Actions Sidebar */}
      <div className="lg:col-span-1 frosted-card p-5 space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto animate-in fade-in duration-300">
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">Actions Prepared by Libby</h3>
          </div>
          {activeClient?.id && activeOrg?.id && (
            <button
              onClick={async () => {
                clearLibbyActions(activeOrg.id, activeClient.id);
                setPreparedActions([]);
                await loadPreparedActions();
                toast('Libby refreshed suggestions for this business.', 'success');
              }}
              className="text-[10px] text-teal-400 hover:text-teal-300 font-bold transition-colors cursor-pointer px-2 py-1 bg-teal-500/10 rounded-md border border-teal-500/20"
            >
              Refresh Libby
            </button>
          )}
        </div>
        
        {preparedActions.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground space-y-2">
            <p className="text-xs font-semibold">No actions prepared right now.</p>
            <p className="text-[10px] leading-relaxed">
              Libby will suggest automated categories, review queues, or threshold updates when ledger updates are needed.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            {preparedActions.map((act) => {
              const isExecutable = EXECUTABLE_ACTION_TYPES.has(act.action_type);
              const isSafeOrLow = act.risk_level === 'safe' || act.risk_level === 'low';
              return (
                <div key={act.id} className="p-4 bg-white/[0.01] border border-border/20 rounded-xl space-y-2.5 hover:border-border/40 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-foreground leading-snug">{act.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border shrink-0 ${
                        act.risk_level === 'high' ? 'bg-risk/10 text-risk border-risk/20' :
                        act.risk_level === 'medium' ? 'bg-warning/10 text-warning border-warning/20' :
                        act.risk_level === 'low' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                        'bg-success/10 text-success border-success/20'
                      }`}>
                        {act.risk_level}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed font-medium mb-2">{act.description}</p>
                    
                    {/* Metadata detail block */}
                    <div className="space-y-1 mt-2 pt-2 border-t border-border/10">
                      {act.affected_count !== undefined && (
                        <div className="flex justify-between text-[9px] font-medium text-muted-foreground">
                          <span>Affected items:</span>
                          <span className="text-foreground font-semibold">{act.affected_count}</span>
                        </div>
                      )}
                      {act.example_item && (
                        <div className="flex justify-between text-[9px] font-medium text-muted-foreground gap-2">
                          <span className="shrink-0">Example:</span>
                          <span className="text-foreground font-semibold truncate text-right max-w-[120px]">{act.example_item}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2 border-t border-border/10">
                    {isExecutable ? (
                      isSafeOrLow ? (
                        <button
                          onClick={() => handleExecuteAction(act)}
                          className="flex-1 py-1.5 bg-primary hover:opacity-90 text-primary-foreground font-black rounded-lg text-[10px] transition-all cursor-pointer text-center"
                        >
                          Approve
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveModalAction(act)}
                          className="flex-1 py-1.5 bg-warning text-black hover:opacity-90 font-black rounded-lg text-[10px] transition-all cursor-pointer text-center"
                        >
                          Review
                        </button>
                      )
                    ) : (
                      // Non-executable: show Open instead of Approve
                      <button
                        onClick={() => {
                          if (act.entity_type === 'transaction') navigate('/transactions');
                          else if (act.entity_type === 'risk') navigate('/risk-inbox');
                          else if (act.action_type === 'generate_accountant_pack') navigate('/reports');
                          else navigate('/transactions');
                        }}
                        className="flex-1 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg text-[10px] transition-all cursor-pointer text-center border border-border/40 flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        Open manually
                      </button>
                    )}
                    <button
                      onClick={() => handleRejectAction(act.id)}
                      className="flex-1 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg text-[10px] transition-all cursor-pointer text-center border border-border/40"
                    >
                      Dismiss
                    </button>
                    {isExecutable && (
                      <button
                        onClick={() => {
                          if (act.entity_type === 'transaction') {
                            navigate(`/transactions?search=${act.entity_id || ''}`);
                          } else if (act.entity_type === 'risk') {
                            navigate(`/risk-inbox?search=${act.entity_id || ''}`);
                          } else {
                            navigate(`/transactions`);
                          }
                        }}
                        className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-foreground font-bold rounded-lg text-[10px] transition-all cursor-pointer border border-border/40"
                        title="Open details"
                      >
                        Open
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Libby Action Confirmation Modal */}
      {activeModalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="frosted-modal max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-left">
            <h3 className="text-lg font-bold text-foreground">Approve Libby action?</h3>
            
            <div className="space-y-3 bg-white/[0.02] border border-border/10 rounded-xl p-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Action</span>
                <p className="text-xs font-bold text-foreground">{activeModalAction.title}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">What will change</span>
                <p className="text-xs text-muted-foreground leading-relaxed">{activeModalAction.description}</p>
              </div>
              {activeModalAction.affected_count !== undefined && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Affected records count</span>
                  <span className="text-foreground font-semibold">{activeModalAction.affected_count}</span>
                </div>
              )}
              {activeModalAction.example_item && (
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Example item</span>
                  <p className="text-xs text-muted-foreground italic font-medium">"{activeModalAction.example_item}"</p>
                </div>
              )}
              <div className="flex justify-between items-center text-xs">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Risk level</span>
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border shrink-0 ${
                  activeModalAction.risk_level === 'high' ? 'bg-risk/10 text-risk border-risk/20' :
                  activeModalAction.risk_level === 'medium' ? 'bg-warning/10 text-warning border-warning/20' :
                  activeModalAction.risk_level === 'low' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                  'bg-success/10 text-success border-success/20'
                }`}>
                  {activeModalAction.risk_level}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Can be changed later</span>
                <span className="text-xs text-foreground font-medium">
                  {activeModalAction.risk_level === 'high' ? 'No' : 'Yes'}
                </span>
              </div>
            </div>

            {/* Confirmation Warning Copy */}
            <div className="p-3 bg-white/5 rounded-lg border border-border/10 text-xs">
              {activeModalAction.risk_level === 'high' && (
                <p className="text-risk font-semibold">⚠️ This cannot be undone.</p>
              )}
              {activeModalAction.risk_level === 'medium' && (
                <p className="text-warning font-semibold">⚠️ Review the affected records before approving.</p>
              )}
              {(activeModalAction.risk_level === 'safe' || activeModalAction.risk_level === 'low') && (
                <p className="text-success font-medium">💡 Libby will update these selected items. You can change them later.</p>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setActiveModalAction(null)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl text-xs transition-all cursor-pointer border border-border/40"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const act = activeModalAction;
                  setActiveModalAction(null);
                  handleExecuteAction(act);
                }}
                className={`px-4 py-2 font-black rounded-xl text-xs transition-all cursor-pointer shadow-lg ${
                  activeModalAction.risk_level === 'high' ? 'bg-risk text-white hover:opacity-90 shadow-risk/10' :
                  activeModalAction.risk_level === 'medium' ? 'bg-warning text-black hover:opacity-90 shadow-warning/10' :
                  'bg-primary text-primary-foreground hover:opacity-90 shadow-primary/10'
                }`}
              >
                Approve action
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AskKaeo;
