import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import { askKaeo } from '../lib/askKaeoEngine';
import { Send, AlertCircle, Bot, User, Sparkles, Shield, Layers, Zap } from 'lucide-react';
import { trackUsageEvent } from '../lib/billing';
import { checkUsageEventAllowed } from '../lib/billingGuards';
import EmptyState from '../components/ui/EmptyState';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  created_at: string;
  source_json?: any;
}

const AskKaeo = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [dbError, setDbError] = useState<boolean>(false);
  const [showMetadata, setShowMetadata] = useState(false);
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeClient && activeOrg) {
      loadOrCreateThread();
    }
  }, [activeClient, activeOrg]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const loadOrCreateThread = async () => {
    if (!activeClient || !activeOrg) return;
    
    try {
      // 1. Try to load the most recent thread for this client
      const { data: threads, error: threadError } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('client_id', activeClient.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (threadError) throw threadError;

      if (threads && threads.length > 0) {
        const activeThreadId = threads[0].id;
        setThreadId(activeThreadId);
        
        // Load messages for this thread
        const { data: msgData, error: msgError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('thread_id', activeThreadId)
          .order('created_at', { ascending: true });
          
        if (msgError) throw msgError;
        setMessages(msgData || []);
        
        // Log fallback reasons to console
        msgData?.forEach(m => {
          if (m.role === 'assistant' && m.source_json?.fallback_reason) {
            console.warn(`[Ask Kaeo Loaded Fallback] Message ${m.id}: ${m.source_json.fallback_reason}`);
          }
        });
        
        // Removed determining latest message mode
        setDbError(false);
      } else {
        // 2. Create a new thread
        const { data: newThread, error: createError } = await supabase
          .from('chat_threads')
          .insert({
            organization_id: activeOrg.id,
            client_id: activeClient.id,
            title: 'Ask Kaeo session'
          })
          .select('id')
          .single();
          
        if (createError) throw createError;
        if (newThread) {
          setThreadId(newThread.id);
          setMessages([
            {
              id: 'init',
              role: 'assistant',
              content: 'Hello. I am Kaeo, your AI business advisor. I can analyze your financial summaries, top vendor spend, recurring commitments, and risk profile based on your verified data. What strategic questions can I answer for you today?',
              created_at: new Date().toISOString(),
              source_json: { mode: 'ai_assisted' }
            }
          ]);
          setDbError(false);
        }
      }
    } catch (error) {
      console.warn("Database unavailable or migration missing. Falling back to memory.", error);
      setDbError(true);
      setMessages([
        {
          id: 'init-mem',
          role: 'assistant',
          content: 'Hello. I am Kaeo, your AI business advisor. I can analyze your financial summaries, top vendor spend, recurring commitments, and risk profile based on your verified data. What strategic questions can I answer for you today?',
          created_at: new Date().toISOString(),
          source_json: { mode: 'ai_assisted' }
        }
      ]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeClient || !activeOrg) return;

    const userText = input.trim();
    setInput('');

    // 1. Enforce AI advisor messaging limit
    const limitCheck = await checkUsageEventAllowed(activeOrg.id, 'ai_message_sent', 1);
    if (!limitCheck.allowed) {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userText,
        created_at: new Date().toISOString()
      };
      const asstMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: limitCheck.message || 'AI advisor monthly message limit reached. Upgrade your plan to ask unlimited CFO questions.',
        created_at: new Date().toISOString(),
        source_json: { mode: 'limit_exceeded' }
      };
      setMessages(prev => [...prev, userMsg, asstMsg]);
      return;
    }
    
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Track usage: AI message sent
    if (activeOrg) {
      trackUsageEvent({
        organizationId: activeOrg.id,
        clientId: activeClient.id,
        eventType: 'ai_message_sent',
        quantity: 1
      });
    }

    // Save User Msg
    if (threadId && !dbError) {
      const { error } = await supabase.from('chat_messages').insert({
        organization_id: activeOrg.id,
        client_id: activeClient.id,
        thread_id: threadId,
        role: 'user',
        content: userText
      });
      if (error) setDbError(true);
    }

    // Engine logic
    try {
      const kaeoReply = await askKaeo(userText, activeClient.id, activeOrg.id);
      
      const asstMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: kaeoReply.text,
        intent: kaeoReply.intent,
        created_at: new Date().toISOString(),
        source_json: kaeoReply.source_json
      };

      setMessages(prev => [...prev, asstMsg]);
      // Mode setting removed
      if (kaeoReply.source_json?.fallback_reason) {
        console.warn(`[Ask Kaeo Fallback] Raw Reason: ${kaeoReply.source_json.fallback_reason}`);
      }
      
      // Save Assistant Msg
      if (threadId && !dbError) {
        const { error } = await supabase.from('chat_messages').insert({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          thread_id: threadId,
          role: 'assistant',
          content: kaeoReply.text,
          intent: kaeoReply.intent,
          source_json: kaeoReply.source_json
        });
        if (error) setDbError(true);
      }
    } catch (err) {
      console.error("Ask Kaeo Engine Error:", err);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I encountered an error processing that request. Please ensure you have imported transaction data.",
        created_at: new Date().toISOString(),
        source_json: { mode: 'deterministic' }
      }]);
    } finally {
      setIsTyping(false);
    }
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
          <div className="p-2 bg-primary/20 rounded-lg">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold tracking-tight">Ask Kaeo</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
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
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 flex items-center gap-1.5 shadow-sm ${
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

          return (
            <div key={msg.id || idx} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="flex-shrink-0 mt-1">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border ${isAi ? 'bg-success/10 border-success/30' : 'bg-primary/20 border-primary/30'}`}>
                    <Bot className={`h-4 w-4 ${isAi ? 'text-success' : 'text-primary'}`} />
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%]">
                <div className={`rounded-2xl px-5 py-4 ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border rounded-tl-sm shadow-sm'}`}>
                  {showMetadata && msg.intent && (
                    <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2 flex flex-wrap gap-2 justify-between items-center bg-muted/30 p-2 rounded border border-border/40">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-semibold">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${isAi ? 'bg-success' : 'bg-blue-500'}`}></span>
                          Intent: {msg.intent.replace(/_/g, ' ')}
                        </span>
                        <span className="flex items-center gap-1 font-semibold">
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
                  {msg.source_json?.mode === 'limit_exceeded' && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <button
                        onClick={() => navigate('/billing')}
                        className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold rounded-lg transition-all shadow-md shadow-primary/10 inline-flex items-center gap-1.5 animate-in fade-in"
                      >
                        <Zap className="w-3.5 h-3.5 text-warning fill-warning" />
                        Upgrade Subscription
                      </button>
                    </div>
                  )}
                  {!isUser && !isAi && msg.source_json?.mode !== 'limit_exceeded' && (
                    <div className="mt-3 pt-3 border-t border-border/50 text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-blue-500/70" />
                      Answered from verified Kaeo data.
                    </div>
                  )}
                </div>

                {/* AI METADATA FOOTER (IF AI MODE) */}
                {!isUser && isAi && showMetadata && (
                  <div className="px-2 mt-1 space-y-2">
                    {/* Upper Metadata Row */}
                    <div className="flex flex-wrap gap-2 items-center text-[10px] text-muted-foreground">
                      <span className={`px-2 py-0.5 rounded border font-medium uppercase ${
                        aiConfidence === 'high' ? 'bg-success/10 text-success border-success/20' :
                        aiConfidence === 'medium' ? 'bg-warning/10 text-warning border-warning/20' :
                        'bg-risk/10 text-risk border-risk/20'
                      }`}>
                        Confidence: {aiConfidence || 'medium'}
                      </span>
                      {needsExt && (
                        <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded font-medium">
                          Live Research Triggered
                        </span>
                      )}
                    </div>

                    {/* Source Summary Counts */}
                    {sourceSummary && (
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground bg-muted/40 p-2 rounded-lg border border-border/40">
                        <Layers className="w-3 h-3 text-muted-foreground/70" />
                        <span>Sources analyzed:</span>
                        <span className="font-semibold text-foreground">{sourceSummary.transactions_used} txs</span>
                        <span className="w-1 h-1 rounded-full bg-border"></span>
                        <span className="font-semibold text-foreground">{sourceSummary.vendors_used} vendors</span>
                        <span className="w-1 h-1 rounded-full bg-border"></span>
                        <span className="font-semibold text-foreground">{sourceSummary.risks_used} risks</span>
                      </div>
                    )}

                    {/* Caveats list */}
                    {aiCaveats.length > 0 && (
                      <div className="mt-1 text-[9px] text-muted-foreground/80 space-y-0.5 bg-muted/20 p-2 rounded border border-border/20">
                        <span className="font-semibold text-[10px] block mb-1 text-foreground/80">CFO Notes:</span>
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
                    <p className="text-[10px] text-muted-foreground/80 italic flex items-center gap-1">
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
        
        {isTyping && (
          <div className="flex gap-4 justify-start">
            <div className="flex-shrink-0 mt-1">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </div>
            </div>
            <div className="bg-card border rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
              className="w-full bg-background border rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              disabled={isTyping}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="h-[46px] px-4 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <div className="text-center mt-2">
          <p className="text-[10px] text-muted-foreground">Kaeo uses your business data and live research when needed to keep answers useful and grounded.</p>
        </div>
      </div>
    </div>
  );
};

export default AskKaeo;
