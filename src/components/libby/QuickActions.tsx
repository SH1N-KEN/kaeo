/**
 * QuickActions — Row of pre-composed query chips above the chat input.
 *
 * Each chip calls onSendMessage(query) which routes through the real
 * Libby engine (useAskKaeoChat → askKaeo → detectIntent → AI).
 * No hardcoded responses.
 *
 * Props:
 *   onSendMessage — the sendMessage function from useAskKaeoChat
 *   loading       — disabled when Libby is thinking
 *   compact       — true in FloatingAskKaeo (shows 3 chips), false in full page (5 chips)
 */

import React from 'react';
import { Sparkles, TrendingUp, ShieldAlert, Receipt, Building2 } from 'lucide-react';

interface QuickAction {
  label: string;
  query: string;
  icon: React.ReactNode;
}

const ALL_QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Summarise Month',
    query: 'Give me a full monthly summary',
    icon: <Sparkles className="w-3 h-3" />,
  },
  {
    label: 'Review Risks',
    query: 'What risks need review?',
    icon: <ShieldAlert className="w-3 h-3" />,
  },
  {
    label: 'Missing Proof',
    query: 'Which staff/petty expenses need proof?',
    icon: <Receipt className="w-3 h-3" />,
  },
  {
    label: 'Vendor Analysis',
    query: 'Which vendors need attention?',
    icon: <Building2 className="w-3 h-3" />,
  },
  {
    label: 'Cash Flow',
    query: 'What is my net cash?',
    icon: <TrendingUp className="w-3 h-3" />,
  },
];

// Compact mode shows only the 3 highest-value actions
const COMPACT_ACTIONS = ALL_QUICK_ACTIONS.slice(0, 3);

interface QuickActionsProps {
  onSendMessage: (query: string) => Promise<void> | void;
  loading: boolean;
  /** If true, shows 3 chips in a compact row (for FloatingAskKaeo). Default: false (5 chips). */
  compact?: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({ onSendMessage, loading, compact = false }) => {
  const actions = compact ? COMPACT_ACTIONS : ALL_QUICK_ACTIONS;

  return (
    <div
      className={`flex flex-wrap gap-1.5 ${compact ? 'px-0 pb-2' : 'pb-3'}`}
      role="group"
      aria-label="Quick Libby actions"
    >
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => onSendMessage(action.query)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border shrink-0"
          style={{
            background: 'var(--muted)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
          onMouseEnter={e => {
            if (!loading) {
              e.currentTarget.style.background = 'rgba(15,118,110,0.08)';
              e.currentTarget.style.borderColor = 'rgba(15,118,110,0.25)';
              e.currentTarget.style.color = 'var(--primary)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--muted)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--foreground)';
          }}
        >
          <span style={{ color: 'var(--primary)', opacity: 0.8 }}>{action.icon}</span>
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default QuickActions;
