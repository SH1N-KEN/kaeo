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
    
    // Skip "Why:" section entirely to keep floating responses concise
    if (lower.startsWith('why:')) {
      continue;
    }
    
    // Handle recommended actions ("Next:")
    if (lower.startsWith('next:')) {
      const lines = cleanBlock.split('\n').slice(1);
      if (lines.length > 0) {
        shortBlocks.push(lines.join('\n'));
      }
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
    setIsCreateModalOpen 
  } = useWorkspace();

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Has any non-greeting messages
  const hasRealMessages = messages.some(
    (m) => m.source_json?.mode !== 'greeting' || m.role === 'user'
  );

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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

  // Listen to open-ask-libby event to open widget and send query
  useEffect(() => {
    const handleOpenAsk = (e: Event) => {
      const customEvent = e as CustomEvent<{ query?: string }>;
      setIsOpen(true);
      if (customEvent.detail?.query) {
        sendMessage(customEvent.detail.query);
      }
    };
    window.addEventListener('open-ask-libby', handleOpenAsk);
    return () => window.removeEventListener('open-ask-libby', handleOpenAsk);
  }, [sendMessage]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input;
    setInput('');
    await sendMessage(text);
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
              className="absolute bottom-full right-0 mb-2.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 pointer-events-none border"
              style={{
                background: 'rgba(11, 15, 14, 0.95)',
                borderColor: 'rgba(16, 185, 129, 0.25)',
                color: '#10b981',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
              }}
            >
              Ask Libby what to review
            </div>

            <button
              onClick={() => setIsOpen(true)}
              aria-label="Open Libby advisor"
              className={`
                flex items-center gap-2
                h-9 px-3.5 rounded-full
                bg-card/90 backdrop-blur-md
                border border-emerald-500/20
                shadow-md shadow-black/5
                dark:shadow-black/20
                text-foreground text-xs font-semibold
                hover:border-emerald-400/40 hover:bg-card hover:shadow-lg
                transition-all duration-200
                cursor-pointer
              `}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />

              {/* Label */}
              <span className="leading-none text-foreground font-semibold">Ask Libby</span>

              {/* Status dot — mint pulse */}
              <span className="relative flex h-1.5 w-1.5 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400/70" />
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
            className="fixed bottom-4 right-4 z-[100] w-[calc(100vw-2rem)] sm:w-[380px] max-h-[580px] flex flex-col rounded-2xl border border-border/60 bg-card/97 backdrop-blur-xl shadow-2xl shadow-black/10 dark:shadow-black/30 overflow-hidden"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40 bg-card/80 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold tracking-tight text-foreground leading-tight">
                    Libby
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      AI-assisted finance review
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Grounded in Kaeo data
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Link
                  to="/libby"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl hover:bg-[var(--muted)] text-muted-foreground hover:text-foreground transition-colors"
                  title="Open Libby"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                {hasRealMessages && (
                  <button
                    onClick={clearMessages}
                    className="p-2 rounded-xl hover:bg-[var(--muted)] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Clear chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl hover:bg-[var(--muted)] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
              {!hasContext ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <UploadCloud className="w-5 h-5 text-emerald-400" />
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
              ) : messages.length === 0 ? (
                <div className="flex flex-col justify-center py-4 px-1 gap-3">
                  <div className="text-center mb-1">
                    <p className="text-xs font-bold text-foreground mb-0.5">
                      Ask Libby CFO Advisor
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Choose a quick question below or type your own query.
                    </p>
                  </div>
                  <div className="space-y-1.5">
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
                        className="w-full text-left px-3 py-2 bg-card hover:bg-[var(--muted)] text-foreground font-semibold rounded-xl border border-border/50 hover:border-emerald-500/30 text-xs transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <span className="truncate pr-2">{query}</span>
                        <Sparkles className="w-3 h-3 text-muted-foreground group-hover:text-teal-400 transition-colors shrink-0" />
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
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* AI avatar — clean teal dot */}
                      {!isUser && (
                        <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-muted/40 border border-border/40 text-foreground rounded-tl-sm'
                        }`}
                      >
                        {isUser ? msg.content : shortenMessage(msg.content, idx > 0 ? messages[idx - 1].content : '')}

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
                              className="w-full text-left px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold rounded-lg border border-emerald-500/20 text-[10px] transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3 h-3" />
                              "Review my transactions"
                            </button>
                          </div>
                        )}

                        {/* Grounded badge */}
                        {!isUser && !isGreeting && !isLimitExceeded && !isError && (
                          <p className="text-[9px] text-muted-foreground mt-2 pt-2 border-t border-border/30 flex items-center gap-1 font-medium animate-in fade-in">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                            {(() => {
                              const status = msg.source_json?.grounding_status;
                              if (status === 'general') return 'General recommendation';
                              if (status === 'general_vendor_knowledge') return 'General vendor knowledge';
                              if (status === 'inferred_not_confirmed') return 'Inferred, not confirmed';
                              if (status === 'needs_clarification') return 'Needs clarification';
                              if (status === 'app_guidance') return 'App guidance';
                              return 'Based on Kaeo data';
                            })()}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing indicator */}
              {loading && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.5)' }} />
                  </div>
                  <div className="bg-muted/40 border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
              <div className="px-4 py-3 border-t border-border/40 bg-card/80 backdrop-blur-md shrink-0">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Libby what to review…"
                    disabled={loading}
                    className="flex-1 bg-muted/30 border border-border/40 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[9px] text-muted-foreground">
                    Answers grounded in your financial data.
                  </p>
                  <Link
                    to="/libby"
                    onClick={() => setIsOpen(false)}
                    className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
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
