import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAskKaeoChat } from '../hooks/useAskKaeoChat';
import { Send, AlertCircle, User, Shield, Zap, Sparkles } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';
import aeLogo from '../assets/kaeo-ae-logo.png';

const AskKaeo = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const navigate = useNavigate();
  const { messages, loading, dbError, sendMessage } = useAskKaeoChat();
  const [input, setInput] = useState('');
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    await sendMessage(userText);
  };

  if (!activeClient || !activeOrg) {
    return (
      <div className="h-[70vh] flex items-center justify-center animate-in fade-in duration-500">
        <EmptyState 
          title="No client workspace selected"
          description="Create or select a client workspace to consult with Kaeo, your intelligent CFO."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-background max-w-4xl mx-auto rounded-2xl border overflow-hidden shadow-sm">
      {/* HEADER */}
      <div className="p-4 border-b bg-card/50 backdrop-blur-sm flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center shrink-0">
            <img src={aeLogo} alt="Kaeo" className="w-4.5 h-4.5 object-contain" />
          </div>
          <div>
            <h2 className="font-semibold tracking-tight">Ask Kaeo</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
              CFO Advisor
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
            <h3 className="text-lg font-bold text-foreground mb-1">Your AI Finance Advisor</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              Ask Kaeo anything about your financial data, transactions, vendor risks, or month-end preparation.
            </p>
            <div className="w-full space-y-2">
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-2 text-left">Suggested Questions</p>
              {[
                "What should I fix first?",
                "Which vendors look risky?",
                "Are we ready for month-end?",
                "What changed after my latest upload?",
                "What should I send my accountant?"
              ].map((query, idx) => (
                <button
                  key={idx}
                  onClick={async () => {
                    await sendMessage(query);
                  }}
                  className="w-full text-left px-4 py-3 bg-card hover:bg-white/5 text-foreground font-semibold rounded-xl border border-border/60 hover:border-teal-500/30 text-xs transition-all cursor-pointer flex items-center justify-between group"
                >
                  <span>{query}</span>
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground group-hover:text-teal-400 transition-colors shrink-0" />
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
                  <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/25 flex items-center justify-center">
                    <img src={aeLogo} alt="Kaeo" className="w-4 h-4 object-contain" />
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%]">
                <div className={`rounded-2xl px-5 py-4 ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border rounded-tl-sm shadow-sm'}`}>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed opacity-95">
                    {msg.content}
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
                    <div className="mt-3 pt-3 border-t border-border/50 text-[10px] text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Shield className="w-3 h-3 text-teal-400" />
                      {msg.source_json?.mode === 'deterministic' ? 'Answered from verified Kaeo data.' : 'Grounded in verified Kaeo data.'}
                    </div>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="flex-shrink-0 mt-1">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          );
        }))}
        
        {loading && (
          <div className="flex gap-4 justify-start">
            <div className="flex-shrink-0 mt-1">
              <div className="h-8 w-8 rounded-lg bg-teal-500/10 border border-teal-500/25 flex items-center justify-center">
                <img src={aeLogo} alt="Kaeo" className="w-4 h-4 object-contain" />
              </div>
            </div>
            <div className="bg-card border rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-teal-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-teal-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-teal-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-[11px] text-muted-foreground ml-1 font-semibold">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-card/80 backdrop-blur-md border-t">
        <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto flex items-end gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your net cash, top vendors, or open risks..."
              className="w-full bg-background border rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground/50 border-border/60"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="h-[46px] px-4 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <div className="text-center mt-2">
          <p className="text-[10px] text-muted-foreground font-medium">Kaeo uses your business data and live research when needed to keep answers useful and grounded.</p>
        </div>
      </div>
    </div>
  );
};

export default AskKaeo;
