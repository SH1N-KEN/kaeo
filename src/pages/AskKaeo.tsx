import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { useAskKaeoChat } from '../hooks/useAskKaeoChat';
import { Send, AlertCircle, User, Shield, Layers, Zap, Sparkles } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';
import aeLogo from '../assets/kaeo-ae-logo.png';

const AskKaeo = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const navigate = useNavigate();
  const { messages, loading, dbError, sendMessage } = useAskKaeoChat();
  const [input, setInput] = useState('');
  const [showMetadata, setShowMetadata] = useState(false);
  
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
          
          <button 
            onClick={() => setShowMetadata(!showMetadata)} 
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 flex items-center gap-1.5 shadow-sm cursor-pointer ${
              showMetadata 
                ? 'bg-success/10 text-success border-success/20 hover:bg-success/20' 
                : 'text-muted-foreground hover:text-foreground border-border hover:bg-muted'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {showMetadata ? 'Hide Audit Log' : 'Show Audit Log'}
          </button>
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isAi = msg.source_json?.mode === 'ai_assisted' || msg.source_json?.mode === 'ai_assisted_locked_numbers';
          const aiConfidence = msg.source_json?.ai_confidence;
          const aiCaveats = msg.source_json?.caveats || [];
          const sourceSummary = msg.source_json?.source_summary;
          const needsExt = msg.source_json?.needs_external_research;
          const fallbackReason = msg.source_json?.fallback_reason;
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
                  {showMetadata && msg.intent && (
                    <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2 flex flex-wrap gap-2 justify-between items-center bg-muted/30 p-2 rounded border border-border/40 font-semibold">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${isAi ? 'bg-success' : 'bg-blue-500'}`}></span>
                          Intent: {msg.intent.replace(/_/g, ' ')}
                        </span>
                        <span className="flex items-center gap-1">
                          Mode: {msg.source_json?.mode || 'deterministic'}
                        </span>
                      </div>
                      {fallbackReason && (
                        <span className="text-[9px] text-warning bg-warning/10 px-2 py-0.5 rounded border border-warning/20 font-medium">
                          Fallback Reason: {fallbackReason}
                        </span>
                      )}
                    </div>
                  )}
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
                      Answered from verified Kaeo data.
                    </div>
                  )}
                </div>

                {/* AI METADATA FOOTER (IF AI MODE) */}
                {!isUser && isAi && showMetadata && (
                  <div className="px-2 mt-1 space-y-2">
                    {/* Upper Metadata Row */}
                    <div className="flex flex-wrap gap-2 items-center text-[10px] text-muted-foreground">
                      <span className={`px-2 py-0.5 rounded border font-semibold uppercase ${
                        aiConfidence === 'high' ? 'bg-success/10 text-success border-success/20' :
                        aiConfidence === 'medium' ? 'bg-warning/10 text-warning border-warning/20' :
                        'bg-risk/10 text-risk border-risk/20'
                      }`}>
                        Confidence: {aiConfidence || 'medium'}
                      </span>
                      {needsExt && (
                        <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
                          Live Research Triggered
                        </span>
                      )}
                    </div>

                    {/* Source Summary Counts */}
                    {sourceSummary && (
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground bg-muted/40 p-2 rounded-lg border border-border/40 font-medium">
                        <Layers className="w-3 h-3 text-muted-foreground/70" />
                        <span>Sources analyzed:</span>
                        <span className="font-semibold text-foreground">{sourceSummary.transactions_used} txs</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-border"></span>
                        <span className="font-semibold text-foreground">{sourceSummary.vendors_used} vendors</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-border"></span>
                        <span className="font-semibold text-foreground">{sourceSummary.risks_used} risks</span>
                      </div>
                    )}

                    {/* Caveats list */}
                    {aiCaveats.length > 0 && (
                      <div className="mt-1 text-[9px] text-muted-foreground/80 space-y-0.5 bg-muted/20 p-2 rounded border border-border/20 font-medium">
                        <span className="font-bold text-[10px] block mb-1 text-foreground/85">CFO Notes:</span>
                        {aiCaveats.map((cav: string, cavIdx: number) => (
                          <div key={cavIdx} className="flex gap-1.5 items-start">
                            <span className="text-[8px] mt-0.5">•</span>
                            <span>{cav}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {!isUser && !isAi && fallbackReason && (
                  <div className="px-2 mt-1">
                    <p className="text-[10px] text-muted-foreground/80 italic flex items-center gap-1 font-medium">
                      <Shield className="w-3 h-3 text-muted-foreground/75 shrink-0" />
                      AI was unavailable, so Kaeo answered directly from verified internal data.
                    </p>
                  </div>
                )}
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
        })}
        
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
