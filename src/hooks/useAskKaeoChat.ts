import { useState, useCallback } from 'react';
import { useWorkspace } from './useWorkspace';
import { askKaeo } from '../lib/askKaeoEngine';
import { trackUsageEvent } from '../lib/billing';
import { checkUsageEventAllowed } from '../lib/billingGuards';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  created_at: string;
  source_json?: any;
}

const INITIAL_GREETING: ChatMessage = {
  id: 'widget-init',
  role: 'assistant',
  content:
    'Ask me about cash movement, vendors, risks, reports, or what to review first.',
  created_at: new Date().toISOString(),
  source_json: { mode: 'greeting' },
};

/**
 * Lightweight shared hook for the floating Ask Kaeo widget.
 * Does NOT persist to Supabase — keeps messages in-memory only.
 * Calls the same askKaeoEngine as the full /ask-kaeo page.
 */
export function useAskKaeoChat() {
  const { activeClient, activeOrg } = useWorkspace();

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [loading, setLoading] = useState(false);

  const hasContext = !!(activeClient && activeOrg);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !activeClient || !activeOrg) return;

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

      // 2. Add user message
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

      // 4. Call the same askKaeo engine
      try {
        const kaeoReply = await askKaeo(
          trimmed,
          activeClient.id,
          activeOrg.id
        );

        const asstMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: kaeoReply.text,
          intent: kaeoReply.intent,
          created_at: new Date().toISOString(),
          source_json: kaeoReply.source_json,
        };
        setMessages((prev) => [...prev, asstMsg]);
      } catch (err) {
        console.error('[FloatingAskKaeo] Engine error:', err);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              "I couldn't answer that right now. Try again in a moment.",
            created_at: new Date().toISOString(),
            source_json: { mode: 'error' },
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [activeClient, activeOrg]
  );

  const clearMessages = useCallback(() => {
    setMessages([INITIAL_GREETING]);
  }, []);

  return {
    messages,
    loading,
    hasContext,
    sendMessage,
    clearMessages,
  };
}
