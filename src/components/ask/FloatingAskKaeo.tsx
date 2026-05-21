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
import aeLogo from '../../assets/kaeo-ae-logo.png';
import { useAskKaeoChat } from '../../hooks/useAskKaeoChat';

const FloatingAskKaeo: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, loading, hasContext, sendMessage, clearMessages } =
    useAskKaeoChat();

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

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
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-2xl bg-card border border-teal-500/25 shadow-xl shadow-black/20 flex items-center justify-center cursor-pointer group hover:border-teal-500/40 hover:shadow-teal-500/10 transition-all duration-300"
            title="Ask Kaeo — CFO Advisor"
          >
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
              <img
                src={aeLogo}
                alt="Kaeo"
                className="w-4 h-4 object-contain"
              />
            </div>
            {/* Notification dot */}
            <span className="absolute top-2 right-2 w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-[100] w-[calc(100vw-3rem)] sm:w-[400px] max-h-[620px] flex flex-col rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/30 overflow-hidden"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-card/80 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center shrink-0">
                  <img
                    src={aeLogo}
                    alt="Kaeo"
                    className="w-4.5 h-4.5 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold tracking-tight text-foreground leading-tight">
                    Ask Kaeo
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      CFO Advisor
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      Data-grounded
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Link
                  to="/ask-kaeo"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                  title="Open full advisor"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <button
                  onClick={clearMessages}
                  className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
              {!hasContext ? (
                /* No workspace / no data state */
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                    <UploadCloud className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground mb-1">
                      No workspace selected
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px]">
                      Create a workspace and upload finance files first, then I
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
              ) : (
                /* Message list */
                messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const isLimitExceeded =
                    msg.source_json?.mode === 'limit_exceeded';

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${
                        isUser ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {/* AI avatar */}
                      {!isUser && (
                        <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/25 flex items-center justify-center shrink-0 mt-0.5">
                          <img
                            src={aeLogo}
                            alt="Kaeo"
                            className="w-3.5 h-3.5 object-contain"
                          />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-muted/40 border border-border/40 text-foreground rounded-tl-sm'
                        }`}
                      >
                        {msg.content}

                        {/* Limit exceeded CTA */}
                        {isLimitExceeded && (
                          <button
                            onClick={() => {
                              setIsOpen(false);
                              navigate('/billing');
                            }}
                            className="mt-3 px-3 py-1.5 bg-primary text-primary-foreground text-[11px] font-bold rounded-lg hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Zap className="w-3 h-3 text-warning fill-warning" />
                            Upgrade Plan
                          </button>
                        )}

                        {/* Grounded badge for non-greeting AI messages */}
                        {!isUser &&
                          msg.source_json?.mode !== 'greeting' &&
                          msg.source_json?.mode !== 'limit_exceeded' &&
                          msg.source_json?.mode !== 'error' && (
                            <p className="text-[9px] text-muted-foreground mt-2 pt-2 border-t border-border/30 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-teal-400" />
                              Grounded in Kaeo data
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
                  <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/25 flex items-center justify-center shrink-0 mt-0.5">
                    <img
                      src={aeLogo}
                      alt="Kaeo"
                      className="w-3.5 h-3.5 object-contain"
                    />
                  </div>
                  <div className="bg-muted/40 border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    <div
                      className="w-1.5 h-1.5 bg-teal-400/60 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-teal-400/60 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-teal-400/60 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
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
                <form
                  onSubmit={handleSend}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Kaeo what to review…"
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
                    Answers grounded in your imported financial data.
                  </p>
                  <Link
                    to="/ask-kaeo"
                    onClick={() => setIsOpen(false)}
                    className="text-[9px] font-bold text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1"
                  >
                    Open full advisor
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
