import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import { askKaeo } from '../lib/askKaeoEngine';
import { Send, AlertCircle, Bot, User, Sparkles } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  created_at: string;
}

const AskKaeo = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [dbError, setDbError] = useState<boolean>(false);
  
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
              content: 'Hello. I am Kaeo. I can analyze your financial summary, top vendors, and risk profile based on your imported data. What would you like to review?',
              created_at: new Date().toISOString()
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
          content: 'Hello. I am Kaeo. I can analyze your financial summary, top vendors, and risk profile based on your imported data. What would you like to review?',
          created_at: new Date().toISOString()
        }
      ]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeClient || !activeOrg) return;

    const userText = input.trim();
    setInput('');
    
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

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
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, asstMsg]);
      
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
        created_at: new Date().toISOString()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

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
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Deterministic CFO Advisor <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">Phase 7</span>
            </p>
          </div>
        </div>
        {dbError && (
          <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 px-3 py-1.5 rounded-full border border-warning/20">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Chat not saved. Your answer still works.</span>
          </div>
        )}
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id || idx} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="flex-shrink-0 mt-1">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                </div>
              )}
              
              <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-4 ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border rounded-tl-sm shadow-sm'}`}>
                {msg.intent && (
                  <div className="text-[10px] font-mono uppercase text-muted-foreground mb-2 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                    {msg.intent.replace(/_/g, ' ')}
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap leading-relaxed opacity-90">
                  {msg.content}
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
          <p className="text-[10px] text-muted-foreground">Kaeo answers are generated from your imported data. AI market research will be enabled in Phase 8.</p>
        </div>
      </div>
    </div>
  );
};

export default AskKaeo;
