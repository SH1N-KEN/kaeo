/**
 * AskLibbyButton — Reusable entry point button for Ask Libby.
 *
 * Dispatches the `open-ask-libby` CustomEvent that FloatingAskKaeo listens for.
 * Used across Dashboard, RiskInbox, Vendors, Reports, and Reconciliation pages.
 *
 * When `reconciliationContext` is provided the Libby panel will call the
 * `reconciliation-ai` Edge Function instead of `ask-kaeo-ai`, giving
 * page-appropriate agentic behaviour while keeping the same UI surface.
 *
 * No state. No hooks. Pure UI + event dispatch.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';

export interface ReconciliationContext {
  exceptionType: 'REVIEW' | 'UNRESOLVED' | 'AMBIGUOUS' | 'DISCREPANCY' | 'UNUSUAL_PATTERN' | string;
  processorTxn: Record<string, any> | null;
  bankTxn: Record<string, any> | null;
  discrepancy: string;
  amount: number;
  dateGap: number;
}

interface AskLibbyButtonProps {
  /** The query that will be pre-sent to Libby when the panel opens. */
  query: string;
  /** Button label. Defaults to "Ask Libby". */
  label?: string;
  /** Visual variant. 'inline' = icon+text, 'icon' = icon only. */
  variant?: 'inline' | 'icon';
  className?: string;
  /**
   * When provided, Libby will call the reconciliation-ai Edge Function
   * instead of ask-kaeo-ai, then display the structured result as a chat message.
   */
  reconciliationContext?: ReconciliationContext;
}

const AskLibbyButton: React.FC<AskLibbyButtonProps> = ({
  query,
  label = 'Ask Libby',
  variant = 'inline',
  className = '',
  reconciliationContext,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('open-ask-libby', {
        detail: { query, reconciliation_context: reconciliationContext ?? null },
      })
    );
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        title={label}
        aria-label={label}
        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 ${className}`}
        style={{
          background: 'rgba(15,118,110,0.08)',
          border: '1px solid rgba(15,118,110,0.18)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(15,118,110,0.16)';
          e.currentTarget.style.borderColor = 'rgba(15,118,110,0.32)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(15,118,110,0.08)';
          e.currentTarget.style.borderColor = 'rgba(15,118,110,0.18)';
        }}
      >
        <Sparkles className="w-3 h-3" style={{ color: 'var(--primary)' }} />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${className}`}
      style={{
        background: 'rgba(15,118,110,0.07)',
        border: '1px solid rgba(15,118,110,0.16)',
        color: 'var(--primary)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(15,118,110,0.14)';
        e.currentTarget.style.borderColor = 'rgba(15,118,110,0.28)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(15,118,110,0.07)';
        e.currentTarget.style.borderColor = 'rgba(15,118,110,0.16)';
      }}
    >
      <Sparkles className="w-3 h-3 shrink-0" style={{ color: 'var(--primary)' }} />
      {label}
    </button>
  );
};

export default AskLibbyButton;
