import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import { askKaeo } from '../lib/askKaeoEngine';
import { trackUsageEvent } from '../lib/billing';
import { checkUsageEventAllowed } from '../lib/billingGuards';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  created_at: string;
  source_json?: any;
}

interface AskKaeoChatContextValue {
  messages: ChatMessage[];
  loading: boolean;
  hasContext: boolean;
  dbError: boolean;
  threadId: string | null;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  refreshThread: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AskKaeoChatContext = createContext<AskKaeoChatContextValue | undefined>(undefined);

const GREETING: ChatMessage = {
  id: 'kaeo-init',
  role: 'assistant',
  content:
    'Ask me what to review, which vendor looks risky, or how ready you are for month-end.',
  created_at: new Date().toISOString(),
  source_json: { mode: 'greeting' },
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const AskKaeoChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { activeClient, activeOrg } = useWorkspace();

  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [loading, setLoading] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  // Guard: only load thread once per client change
  const loadedClientRef = useRef<string | null>(null);

  const hasContext = !!(activeClient && activeOrg);

  // Load / create thread when client changes
  useEffect(() => {
    if (!activeClient || !activeOrg) {
      setMessages([GREETING]);
      setThreadId(null);
      loadedClientRef.current = null;
      return;
    }
    // Skip if already loaded for this client
    if (loadedClientRef.current === activeClient.id) return;
    loadedClientRef.current = activeClient.id;
    refreshThread();
  }, [activeClient?.id, activeOrg?.id]);

  const refreshThread = useCallback(async () => {
    if (!activeClient || !activeOrg) return;

    try {
      // Try most recent thread
      const { data: threads, error: threadErr } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('client_id', activeClient.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (threadErr) throw threadErr;

      if (threads && threads.length > 0) {
        const tid = threads[0].id;
        setThreadId(tid);

        const { data: msgs, error: msgErr } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('thread_id', tid)
          .order('created_at', { ascending: true });

        if (msgErr) throw msgErr;
        setMessages(
          msgs && msgs.length > 0 ? (msgs as ChatMessage[]) : [GREETING]
        );
        setDbError(false);
      } else {
        // Create new thread
        const { data: newThread, error: createErr } = await supabase
          .from('chat_threads')
          .insert({
            organization_id: activeOrg.id,
            client_id: activeClient.id,
            title: 'Libby session',
          })
          .select('id')
          .single();

        if (createErr) throw createErr;
        if (newThread) {
          setThreadId(newThread.id);
          setMessages([GREETING]);
          setDbError(false);
        }
      }
    } catch (err) {
      console.warn('[LibbyChat] DB unavailable, falling back to memory:', err);
      setDbError(true);
      setMessages([GREETING]);
    }
  }, [activeClient, activeOrg]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !activeClient || !activeOrg || loading) return;

      // 1. Billing guard
      const limitCheck = await checkUsageEventAllowed(
        activeOrg.id,
        'ai_message_sent',
        1
      );
      if (!limitCheck.allowed) {
        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: trimmed,
          created_at: new Date().toISOString(),
        };
        const asstMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            limitCheck.message ||
            'AI advisor monthly message limit reached. Upgrade your plan to ask unlimited CFO questions.',
          created_at: new Date().toISOString(),
          source_json: { mode: 'limit_exceeded' },
        };
        setMessages((prev) => [...prev, userMsg, asstMsg]);
        return;
      }

      // 2. User message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      // 3. Track usage
      trackUsageEvent({
        organizationId: activeOrg.id,
        clientId: activeClient.id,
        eventType: 'ai_message_sent',
        quantity: 1,
      });

      // 4. Persist user message
      if (threadId && !dbError) {
        const { error } = await supabase.from('chat_messages').insert({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          thread_id: threadId,
          role: 'user',
          content: trimmed,
        });
        if (error) setDbError(true);
      }

      // Intercept special queries
      const lowerText = trimmed.toLowerCase();
      if (lowerText.includes('add a new client') || lowerText.includes('add client') || lowerText.includes('add a client') || lowerText.includes('new client')) {
        const content = "I can help you add a new client business workspace to Kaeo. Click the action button below to open the creation form.";
        const asstMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content,
          created_at: new Date().toISOString(),
          source_json: { cta: 'open_add_client_business' }
        };
        setMessages((prev) => [...prev, asstMsg]);
        if (threadId && !dbError) {
          await supabase.from('chat_messages').insert({
            organization_id: activeOrg.id,
            client_id: activeClient.id,
            thread_id: threadId,
            role: 'assistant',
            content,
            source_json: { cta: 'open_add_client_business' }
          });
        }
        setLoading(false);
        return;
      }

      if (lowerText.includes('add another business') || lowerText.includes('add business') || lowerText.includes('add a business') || lowerText.includes('new business')) {
        const content = "I can help you add another company or business profile to your workspace. Click the action button below to open the creation form.";
        const asstMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content,
          created_at: new Date().toISOString(),
          source_json: { cta: 'open_add_business' }
        };
        setMessages((prev) => [...prev, asstMsg]);
        if (threadId && !dbError) {
          await supabase.from('chat_messages').insert({
            organization_id: activeOrg.id,
            client_id: activeClient.id,
            thread_id: threadId,
            role: 'assistant',
            content,
            source_json: { cta: 'open_add_business' }
          });
        }
        setLoading(false);
        return;
      }

      // 5. Ask the engine
      try {
        const reply = await askKaeo(trimmed, activeClient.id, activeOrg.id);

        const asstMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: reply.text,
          intent: reply.intent,
          created_at: new Date().toISOString(),
          source_json: reply.source_json,
        };
        setMessages((prev) => [...prev, asstMsg]);

        // Persist assistant message
        if (threadId && !dbError) {
          const { error } = await supabase.from('chat_messages').insert({
            organization_id: activeOrg.id,
            client_id: activeClient.id,
            thread_id: threadId,
            role: 'assistant',
            content: reply.text,
            intent: reply.intent,
            source_json: reply.source_json,
          });
          if (error) setDbError(true);
        }
      } catch (err) {
        console.error('[LibbyChat] Engine error:', err);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              "I couldn't answer that right now. Please ensure you have imported transaction data and try again.",
            created_at: new Date().toISOString(),
            source_json: { mode: 'error' },
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [activeClient, activeOrg, threadId, dbError, loading]
  );

  const clearMessages = useCallback(() => {
    setMessages([GREETING]);
  }, []);

  return (
    <AskKaeoChatContext.Provider
      value={{
        messages,
        loading,
        hasContext,
        dbError,
        threadId,
        sendMessage,
        clearMessages,
        refreshThread,
      }}
    >
      {children}
    </AskKaeoChatContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAskKaeoChat(): AskKaeoChatContextValue {
  const ctx = useContext(AskKaeoChatContext);
  if (!ctx) {
    throw new Error('useAskKaeoChat must be used within AskKaeoChatProvider');
  }
  return ctx;
}
