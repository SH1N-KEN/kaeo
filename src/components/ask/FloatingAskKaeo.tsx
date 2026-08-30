import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  X,
  Send,
  Sparkles,
  ExternalLink,
  Trash2,
  UploadCloud,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAskKaeoChat } from '../../hooks/useAskKaeoChat';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Plus } from 'lucide-react';
import WorkspaceBrief from '../libby/WorkspaceBrief';
import QuickActions from '../libby/QuickActions';
import SuggestedActionChips, { extractSuggestedActions } from '../libby/SuggestedActionChips';
import GroundingStatusCard from '../libby/GroundingStatusCard';
import FinanceInsightCard, { parseInsightSections } from '../libby/FinanceInsightCard';
import { buildWorkspaceContext } from '../../lib/libby/contextEngine';
import { buildWorkspaceBrief, type WorkspaceBriefData } from '../../lib/libby/workspaceBriefEngine';
import { supabase } from '../../lib/supabase';

const cleanUserMessage = (content: string): string => {
  if (!content) return content;
  return content
    .replace(/\s*\(Risk:.*?\)/gi, '')
    .replace(/\s*\(Vendor:.*?\)/gi, '')
    .replace(/\s*\(Report:.*?\)/gi, '')
    .replace(/\s*\(KPI:.*?\)/gi, '')
    .replace(/\s*\(Transaction:.*?\)/gi, '');
};

const shortenMessage = (content: string, userQuery: string): string => {
  if (!content) return content;
  
  const q = (userQuery || '').toLowerCase();
  const askedForMath = q.includes('math') || q.includes('calculated') || q.includes('formula') || q.includes('breakdown') || q.includes('why is net');
  
  let formatted = content;
  
  // 1. Strip equations if not asked
  if (!askedForMath) {
    const mathEquationRegex = /([₹$]|Rs\.?|INR)?\s*[\d,.]+\s*[\+\-\*\/]\s*([₹$]|Rs\.?|INR)?\s*[\d,.]+\s*([\+\-\*\/]\s*([₹$]|Rs\.?|INR)?\s*[\d,.]+)*\s*=\s*([₹$]|Rs\.?|INR)?\s*[\d,.]+/g;
    formatted = formatted.replace(mathEquationRegex, '');
  }

  // Split content into blocks
  const blocks = formatted.split('\n\n');
  const shortBlocks: string[] = [];

  for (const block of blocks) {
    const cleanBlock = block.trim();
    if (!cleanBlock) continue;

    const lower = cleanBlock.toLowerCase();
    
    // Slice off "Summary:" label if it starts with it
    if (lower.startsWith('summary:')) {
      const remaining = cleanBlock.slice(8).trim();
      shortBlocks.push(remaining);
      continue;
    }

    // Skip "Why:" section entirely to keep floating responses concise
    if (lower.startsWith('why:')) {
      continue;
    }

    // Handle "Impact:" / "Evidence:" section by extracting its bullets
    if (lower.startsWith('impact:') || lower.startsWith('evidence:')) {
      const lines = cleanBlock.split('\n').slice(1);
      if (lines.length > 0) {
        shortBlocks.push(lines.join('\n'));
      }
      continue;
    }
    
    // Skip suggested actions section in shortenMessage since they will be rendered as interactive chips below
    if (lower.startsWith('suggested actions:') || lower.startsWith('next:')) {
      continue;
    }

    // Handle caveats ("Watch out:")
    if (lower.startsWith('watch out:')) {
      const lines = cleanBlock.split('\n').slice(1);
      if (lines.length > 0) {
        shortBlocks.push(lines.join('\n'));
      }
      continue;
    }

    // Otherwise, keep the block
    shortBlocks.push(cleanBlock);
  }

  // Combine the blocks
  const combined = shortBlocks.join('\n\n');

  // Limit bullets to max 3
  const lines = combined.split('\n');
  let bulletCount = 0;
  const filteredLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');
    if (isBullet) {
      bulletCount++;
      if (bulletCount <= 3) {
        filteredLines.push(line);
      }
    } else {
      filteredLines.push(line);
    }
  }
  
  return filteredLines.join('\n');
};

const FloatingAskKaeo: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, loading, hasContext, sendMessage, clearMessages } =
    useAskKaeoChat();
  const { 
    setModalMode, 
    setClientToEdit, 
    setIsCreateModalOpen,
    activeClient,
    activeOrg,
  } = useWorkspace();

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [workspaceBrief, setWorkspaceBrief] = useState<WorkspaceBriefData | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const briefLoadedRef = useRef<string | null>(null);

  // ── Unified insertion-order message list ──
  // Both regular Libby messages and reconciliation AI messages are appended
  // here in the order they actually arrived — no sorting needed.
  type UnifiedMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    source_json?: Record<string, any>;
    _source: 'chat' | 'recon';
  };
  const [unifiedMessages, setUnifiedMessages] = useState<UnifiedMessage[]>([]);
  const prevChatCountRef = useRef(0);
  const [reconLoading, setReconLoading] = useState(false);

  // Sync NEW chat messages into the unified list as they arrive (diff-based)
  useEffect(() => {
    if (messages.length < prevChatCountRef.current) {
      // Messages were cleared — reset unified list entirely
      prevChatCountRef.current = 0;
      setUnifiedMessages([]);
      return;
    }
    const newMsgs = messages.slice(prevChatCountRef.current);
    if (newMsgs.length > 0) {
      prevChatCountRef.current = messages.length;
      setUnifiedMessages(prev => [
        ...prev,
        ...newMsgs.map(m => ({ ...m, _source: 'chat' as const })),
      ]);
    }
  }, [messages]);

  const isLoadingAny = loading || reconLoading;

  // Has any non-greeting messages
  const hasRealMessages = unifiedMessages.some(
    (m) => m.source_json?.mode !== 'greeting' || m.role === 'user'
  );

  // Detect empty state (only the initial GREETING present)
  const isEmptyState = !hasRealMessages;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [unifiedMessages, isLoadingAny]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Escape key closes widget
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Listen to open-ask-libby event — handles both general queries and reconciliation investigations
  useEffect(() => {
    const handleOpenAsk = async (e: Event) => {
      const customEvent = e as CustomEvent<{
        query?: string;
        reconciliation_context?: {
          exceptionType: string;
          processorTxn: Record<string, any> | null;
          bankTxn: Record<string, any> | null;
          discrepancy: string;
          amount: number;
          dateGap: number;
        } | null;
      }>;

      setIsOpen(true);
      const reconCtx = customEvent.detail?.reconciliation_context;

      if (reconCtx) {
        // ── Reconciliation path: call reconciliation-ai edge function ──
        const userQuery = customEvent.detail?.query ?? 'Investigate this reconciliation exception.';
        const userMsgId = `recon-user-${Date.now()}`;
        const asstMsgId = `recon-asst-${Date.now() + 1}`;

        // Push user message directly into the unified list
        setUnifiedMessages(prev => [
          ...prev,
          { id: userMsgId, role: 'user', content: userQuery, _source: 'recon' as const },
        ]);
        setReconLoading(true);

        try {
          const payload = {
            exceptionType: reconCtx.exceptionType,
            evidence: {
              processorTxn: reconCtx.processorTxn,
              bankTxn: reconCtx.bankTxn,
              discrepancy: reconCtx.discrepancy,
              amount: reconCtx.amount,
              dateGap: reconCtx.dateGap,
            },
          };

          const { data, error } = await supabase.functions.invoke('reconciliation-ai', {
            body: payload,
          });

          let assistantText: string;
          if (error || !data) {
            assistantText =
              'I couldn\'t reach the reconciliation analysis service right now. Please try again shortly.';
          } else {
            // Format the structured response as a readable Libby message
            const likelihood = data.likelihood ?? 'unknown';
            const confidence = data.confidence ?? 0;
            const action = data.recommendedAction ?? 'INVESTIGATE';
            const assessment = data.assessment ?? 'Unable to assess.';
            const reasoning = data.reasoning ?? '';

            assistantText =
              `### Summary\n` +
              `${assessment}\n\n` +
              `### Why\n` +
              `${reasoning}\n\n` +
              `### Evidence\n` +
              `• Likelihood: ${likelihood}\n` +
              `• Confidence: ${confidence}%\n\n` +
              `### Suggested Actions\n` +
              `• ${action === 'APPROVE' ? 'Mark as resolved — variance is within expected processor fee range.' :
                  action === 'REJECT' ? 'Escalate to finance team — discrepancy exceeds acceptable threshold.' :
                  action === 'REQUEST_DOCUMENTATION' ? 'Request supporting documentation from the payment processor.' :
                  'Investigate further — review processor and bank statements manually.'}`;
          }

          setUnifiedMessages(prev => [
            ...prev,
            {
              id: asstMsgId,
              role: 'assistant',
              content: assistantText,
              source_json: { intent: 'reconciliation_investigation', mode: 'reconciliation' },
              _source: 'recon' as const,
            },
          ]);
        } catch (err: any) {
          setUnifiedMessages(prev => [
            ...prev,
            {
              id: asstMsgId,
              role: 'assistant',
              content: `I couldn't investigate this exception right now. Please try again. ${err.message}`,
              source_json: { mode: 'error' },
              _source: 'recon' as const,
            },
          ]);
        } finally {
          setReconLoading(false);
        }
      } else if (customEvent.detail?.query) {
        // ── General Libby path ──
        sendMessage(customEvent.detail.query);
      }
    };

    window.addEventListener('open-ask-libby', handleOpenAsk);
    return () => window.removeEventListener('open-ask-libby', handleOpenAsk);
  }, [sendMessage]);

  // Lazily load workspace brief when empty state is visible
  useEffect(() => {
    if (!activeClient?.id || !activeOrg?.id || !isOpen || !isEmptyState) return;
    if (briefLoadedRef.current === activeClient.id) return;
    briefLoadedRef.current = activeClient.id;
    setBriefLoading(true);
    buildWorkspaceContext(activeClient.id, activeOrg.id)
      .then(ctx => setWorkspaceBrief(buildWorkspaceBrief(ctx)))
      .catch(() => setWorkspaceBrief(null))
      .finally(() => setBriefLoading(false));
  }, [activeClient?.id, activeOrg?.id, isOpen, isEmptyState]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoadingAny) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const handleClearAll = () => {
    clearMessages();
    // Reset unified list; the useEffect will re-sync from the cleared messages array
    setUnifiedMessages([]);
    prevChatCountRef.current = 0;
  };

  return (
    <>
      {/* ── Floating Trigger Button ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            key="fab-container"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="fixed bottom-4 right-4 z-[100] group"
          >
            {/* Tooltip on hover */}
            <div
              className="absolute bottom-full right-0 mb-2.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 pointer-events-none"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--primary)',
                backdropFilter: 'blur(12px)',
                boxShadow: 'var(--shadow-popover)',
              }}
            >
              Ask Libby what to review
            </div>

            <button
              onClick={() => setIsOpen(true)}
              aria-label="Open Libby advisor"
              className="flex items-center gap-2 h-9 px-3.5 rounded-full cursor-pointer transition-all duration-200"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-card)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(15,118,110,0.35)';
                e.currentTarget.style.boxShadow = 'var(--shadow-popover)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'var(--shadow-card)';
              }}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--primary)' }} />

              {/* Label */}
              <span className="leading-none font-semibold text-xs" style={{ color: 'var(--foreground)' }}>Ask Libby</span>

              {/* Status dot — teal pulse */}
              <span className="relative flex h-1.5 w-1.5 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40" style={{ background: 'var(--primary)' }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 opacity-70" style={{ background: 'var(--primary)' }} />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed bottom-4 right-4 z-[100] w-[calc(100vw-24px)] sm:w-[380px] max-h-[calc(100vh-32px)] sm:max-h-[580px] flex flex-col rounded-2xl overflow-hidden frosted-card shadow-2xl"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-[var(--border)] bg-transparent">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.18)' }}>
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground leading-none">Libby</span>
                    <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/15 shrink-0">
                      Grounded
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-none">
                    AI Finance Advisor
                  </span>
                </div>
              </div>

            <div className="flex items-center gap-0.5">
                <Link
                  to="/libby"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-muted-foreground hover:text-foreground transition-all duration-150"
                  title="Open Libby"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
                {hasRealMessages && (
                  <button
                    onClick={handleClearAll}
                    className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer"
                    title="Clear chat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
              {!hasContext ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.18)' }}>
                    <UploadCloud className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground mb-1">
                      No workspace selected
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px]">
                      Create a workspace and upload finance files first, then Libby
                      can analyze your numbers.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/files');
                    }}
                    className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Go to Files
                  </button>
                </div>
              ) : unifiedMessages.length === 0 ? (
                <div className="flex flex-col justify-center py-4 px-1 gap-3">
                  <WorkspaceBrief
                    brief={workspaceBrief}
                    loading={briefLoading}
                    onSendMessage={sendMessage}
                    compact={true}
                  />
                </div>
              ) : (
                unifiedMessages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  const isLimitExceeded = msg.source_json?.mode === 'limit_exceeded';
                  const isGreeting = msg.source_json?.mode === 'greeting';
                  const isError = msg.source_json?.mode === 'error';

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* AI avatar — clean teal dot */}
                      {!isUser && (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(15,118,110,0.10)' }}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--primary)', boxShadow: '0 0 6px rgba(15,118,110,0.35)' }} />
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5 max-w-[80%] w-full">
                        <div
                          className={`rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap w-full ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-tr-sm px-4 py-3 font-medium'
                              : parseInsightSections(msg.content)
                                ? 'bg-transparent border-none p-0'
                                : 'bg-muted/40 border border-border/40 text-foreground rounded-tl-sm font-normal px-4 py-3'
                          }`}
                        >
                          {isUser ? (
                            // Truncate long reconciliation queries to a clean label
                            cleanUserMessage(msg.content).length > 120
                              ? cleanUserMessage(msg.content).slice(0, 80).trimEnd() + '…'
                              : cleanUserMessage(msg.content)
                          ) : parseInsightSections(msg.content) ? (
                            <FinanceInsightCard content={msg.content} intent={msg.source_json?.intent} />
                          ) : (
                            shortenMessage(msg.content, idx > 0 ? unifiedMessages[idx - 1].content : '')
                          )}

                          {/* Limit exceeded CTA */}
                          {isLimitExceeded && (
                            <button
                              onClick={() => {
                                setIsOpen(false);
                                navigate('/billing');
                              }}
                              className="mt-3 px-3 py-1.5 bg-primary text-primary-foreground text-[11px] font-bold rounded-lg hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Zap className="w-3.5 h-3.5 text-warning fill-warning" />
                              Upgrade Plan
                            </button>
                          )}

                          {/* AI Review CTA */}
                          {msg.source_json?.cta === 'open_ai_review' && (
                            <button
                              onClick={() => {
                                setIsOpen(false);
                                navigate('/transactions?review_status=ai_suggested');
                              }}
                              className="mt-3 px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-black text-[11px] font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Open AI Review
                            </button>
                          )}

                          {/* Open Add Client Business CTA */}
                          {msg.source_json?.cta === 'open_add_client_business' && (
                            <button
                              onClick={() => {
                                setIsOpen(false);
                                setModalMode('create_client_business');
                                setClientToEdit(null);
                                setIsCreateModalOpen(true);
                              }}
                              className="mt-3 px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-black text-[11px] font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Open Add Client Business
                            </button>
                          )}

                          {/* Open Add Business CTA */}
                          {msg.source_json?.cta === 'open_add_business' && (
                            <button
                              onClick={() => {
                                setIsOpen(false);
                                setModalMode('create_business');
                                setClientToEdit(null);
                                setIsCreateModalOpen(true);
                              }}
                              className="mt-3 px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-black text-[11px] font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Open Add Business
                            </button>
                          )}

                          {/* Quick Action Suggestion for greeting */}
                          {isGreeting && (
                            <div className="mt-3">
                              <button
                                onClick={async () => {
                                  await sendMessage("Review my transactions");
                                }}
                                className="w-full text-left px-3 py-2 font-semibold rounded-lg text-[10px] transition-all cursor-pointer flex items-center gap-1.5"
                                style={{ background: 'rgba(15,118,110,0.08)', color: 'var(--primary)', border: '1px solid rgba(15,118,110,0.18)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(15,118,110,0.14)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,118,110,0.08)'; }}
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                "Review my transactions"
                              </button>
                            </div>
                          )}

                          {/* Grounded badge — skip for reconciliation results */}
                          {!isUser && !isGreeting && !isLimitExceeded && !isError
                            && msg.source_json?.mode !== 'reconciliation'
                            && (
                            <GroundingStatusCard sourceJson={msg.source_json} />
                          )}
                        </div>
                        {/* Suggested action chips — skip for reconciliation results */}
                        {!isUser && msg.source_json?.mode !== 'reconciliation' && (
                          <SuggestedActionChips actions={extractSuggestedActions(msg.content)} />
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing indicator */}
              {isLoadingAny && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(15,118,110,0.10)' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--primary)', boxShadow: '0 0 6px rgba(15,118,110,0.35)' }} />
                  </div>
                  <div className="bg-muted/40 border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'rgba(15,118,110,0.5)', animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'rgba(15,118,110,0.5)', animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'rgba(15,118,110,0.5)', animationDelay: '300ms' }} />
                    <span className="text-[10px] text-muted-foreground ml-1.5 font-semibold">
                      Thinking…
                    </span>
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* ── Input Area ── */}
            {hasContext && (
              <div className="px-4 py-3.5 shrink-0 border-t border-[var(--border)] bg-transparent">
                {/* Quick Actions — compact 3-chip row */}
                <div className="mb-2">
                  <QuickActions onSendMessage={sendMessage} loading={loading} compact={true} />
                </div>
                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Libby what to review…"
                    disabled={isLoadingAny}
                    className="flex-1 frosted-input border-border/30 placeholder:text-muted-foreground/45"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoadingAny}
                    className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
                <div className="flex items-center justify-between mt-2.5 px-0.5">
                  <p className="text-[9px] text-muted-foreground/80 font-medium">
                    Answers grounded in your financial data.
                  </p>
                  <Link
                    to="/libby"
                    onClick={() => setIsOpen(false)}
                    className="text-[9px] font-bold transition-colors flex items-center gap-1 hover:opacity-80"
                    style={{ color: 'var(--primary)' }}
                  >
                    Open Libby
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingAskKaeo;
