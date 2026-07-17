/**
 * AskLibbyButton — Reusable entry point button for Ask Libby.
 *
 * Dispatches the `open-ask-libby` CustomEvent that FloatingAskKaeo listens for.
 * Used across Dashboard, RiskInbox, Vendors, Reports pages.
 *
 * No state. No hooks. Pure UI + event dispatch.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';

interface AskLibbyButtonProps {
  /** The query that will be pre-sent to Libby when the panel opens. */
  query: string;
  /** Button label. Defaults to "Ask Libby". */
  label?: string;
  /** Visual variant. 'inline' = icon+text, 'icon' = icon only. */
  variant?: 'inline' | 'icon';
  className?: string;
}

const AskLibbyButton: React.FC<AskLibbyButtonProps> = ({
  query,
  label = 'Ask Libby',
  variant = 'inline',
  className = '',
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('open-ask-libby', { detail: { query } }));
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
