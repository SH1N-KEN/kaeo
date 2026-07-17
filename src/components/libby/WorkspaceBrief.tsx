/**
 * WorkspaceBrief — Intelligent empty state for the Libby chat.
 *
 * Shown when the chat has no real messages yet (only the initial GREETING).
 * Displays real workspace signals: risks, missing proof, readiness, vendor, cash flow.
 *
 * Data is passed as props from the parent (AskKaeo or FloatingAskKaeo)
 * which fetches it once via buildWorkspaceContext() + buildWorkspaceBrief().
 *
 * In compact mode (FloatingAskKaeo), shows only the 3 highest-priority signals.
 */

import React from 'react';
import {
  ShieldAlert,
  Receipt,
  TrendingUp,
  TrendingDown,
  Building2,
  CheckCircle2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { WorkspaceBriefData } from '../../lib/libby/workspaceBriefEngine';

interface WorkspaceBriefProps {
  brief: WorkspaceBriefData | null;
  loading?: boolean;
  onSendMessage: (query: string) => void;
  /** Compact mode for FloatingAskKaeo — shows 3 signals, smaller layout. */
  compact?: boolean;
}

// ─── Signal Card ──────────────────────────────────────────────────────────────

interface SignalCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: 'danger' | 'warning' | 'success' | 'primary' | 'default';
  query: string;
  onSendMessage: (query: string) => void;
}

const accentColors = {
  danger:  { bg: 'rgba(224,84,80,0.06)',   border: 'rgba(224,84,80,0.18)',   icon: 'var(--danger)',          text: 'var(--danger)' },
  warning: { bg: 'rgba(234,179,8,0.06)',   border: 'rgba(234,179,8,0.20)',   icon: 'var(--warning)',         text: 'var(--warning)' },
  success: { bg: 'rgba(34,197,94,0.05)',   border: 'rgba(34,197,94,0.18)',   icon: 'var(--success)',         text: 'var(--success)' },
  primary: { bg: 'rgba(15,118,110,0.06)',  border: 'rgba(15,118,110,0.18)',  icon: 'var(--primary)',         text: 'var(--primary)' },
  default: { bg: 'var(--muted)',           border: 'var(--border)',           icon: 'var(--muted-foreground)', text: 'var(--foreground)' },
};

const SignalCard: React.FC<SignalCardProps> = ({ icon, label, value, sub, accent = 'default', query, onSendMessage }) => {
  const colors = accentColors[accent];
  return (
    <button
      onClick={() => onSendMessage(query)}
      className="flex items-start gap-2.5 p-3 rounded-xl text-left w-full transition-all cursor-pointer group"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = accent === 'default' ? 'rgba(15,118,110,0.25)' : colors.border;
        e.currentTarget.style.background = accent === 'default' ? 'rgba(15,118,110,0.06)' : colors.bg;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = colors.border;
        e.currentTarget.style.background = colors.bg;
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${colors.bg}`, border: `1px solid ${colors.border}` }}
      >
        <span style={{ color: colors.icon }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </p>
        <p className="text-[13px] font-bold leading-tight" style={{ color: colors.text }}>
          {value}
        </p>
        {sub && (
          <p className="text-[10px] mt-0.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
            {sub}
          </p>
        )}
      </div>
      <Sparkles
        className="w-3 h-3 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--primary)' }}
      />
    </button>
  );
};

// ─── WorkspaceBrief ───────────────────────────────────────────────────────────

const WorkspaceBrief: React.FC<WorkspaceBriefProps> = ({
  brief,
  loading = false,
  onSendMessage,
  compact = false,
}) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
        <p className="text-[11px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
          Loading workspace…
        </p>
      </div>
    );
  }

  if (!brief) {
    // Fallback to the original static empty state if brief data is unavailable
    return null;
  }

  const riskAccent = brief.openRisksCount > 0
    ? (brief.highRisksCount > 0 ? 'danger' : 'warning')
    : 'success';

  const proofAccent = brief.missingProofCount > 0 ? 'warning' : 'success';
  const cashAccent = brief.isPositive ? 'success' : 'danger';

  const readinessAccent =
    brief.readinessScore >= 90 ? 'success' :
    brief.readinessScore >= 60 ? 'warning' : 'danger';

  if (compact) {
    // Compact layout for FloatingAskKaeo: 3 priority signals stacked
    return (
      <div className="space-y-2 animate-in fade-in duration-300">
        {/* Greeting */}
        <div className="pb-2">
          <p className="text-[12px] font-bold" style={{ color: 'var(--foreground)' }}>
            {brief.greeting}, {brief.clientName.split(' ')[0]}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
            Here's what needs your attention.
          </p>
        </div>

        <SignalCard
          icon={<ShieldAlert className="w-3.5 h-3.5" />}
          label="Open Risks"
          value={brief.openRisksCount === 0 ? 'All clear' : `${brief.openRisksCount} open`}
          sub={brief.highRisksCount > 0 ? `${brief.highRisksCount} high severity` : undefined}
          accent={riskAccent}
          query="What risks need review?"
          onSendMessage={onSendMessage}
        />

        <SignalCard
          icon={<Receipt className="w-3.5 h-3.5" />}
          label="Missing Proof"
          value={brief.missingProofCount === 0 ? 'All covered' : `${brief.missingProofCount} missing`}
          sub={brief.missingProofCount > 0 ? 'Staff expenses need receipts' : undefined}
          accent={proofAccent}
          query="Which staff/petty expenses need proof?"
          onSendMessage={onSendMessage}
        />

        <SignalCard
          icon={brief.isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          label="Net Cash"
          value={`${brief.isPositive ? '+' : '-'}${brief.netCashFormatted}`}
          sub={`${brief.transactionCount} transactions`}
          accent={cashAccent}
          query="What is my net cash?"
          onSendMessage={onSendMessage}
        />
      </div>
    );
  }

  // Full layout for AskKaeo page: 2-column grid of 6 signals
  return (
    <div className="w-full max-w-xl mx-auto animate-in fade-in duration-300">
      {/* Greeting Header */}
      <div className="text-center mb-5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ background: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.18)' }}
        >
          <Sparkles className="w-5 h-5" style={{ color: 'var(--primary)' }} />
        </div>
        <h3 className="text-[15px] font-bold" style={{ color: 'var(--foreground)' }}>
          {brief.greeting}
        </h3>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          Here's your workspace snapshot for{' '}
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            {brief.clientName}
          </span>
        </p>
      </div>

      {/* 2-column signal grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <SignalCard
          icon={<ShieldAlert className="w-3.5 h-3.5" />}
          label="Open Risks"
          value={brief.openRisksCount === 0 ? 'All clear' : `${brief.openRisksCount} open`}
          sub={
            brief.highRisksCount > 0
              ? `${brief.highRisksCount} high severity`
              : brief.openRisksCount === 0
                ? 'No issues found'
                : 'Medium or low severity'
          }
          accent={riskAccent}
          query="What risks need review?"
          onSendMessage={onSendMessage}
        />

        <SignalCard
          icon={<Receipt className="w-3.5 h-3.5" />}
          label="Missing Proof"
          value={brief.missingProofCount === 0 ? 'All covered' : `${brief.missingProofCount} missing`}
          sub={
            brief.missingProofCount > 0
              ? 'Staff expenses need receipts'
              : 'All staff expenses have proof'
          }
          accent={proofAccent}
          query="Which staff/petty expenses need proof?"
          onSendMessage={onSendMessage}
        />

        <SignalCard
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          label="Report Readiness"
          value={`${brief.readinessScore}%`}
          sub={brief.readinessLabel}
          accent={readinessAccent}
          query="Are we ready for month-end?"
          onSendMessage={onSendMessage}
        />

        <SignalCard
          icon={<Building2 className="w-3.5 h-3.5" />}
          label="Top Vendor"
          value={brief.topVendorName || '—'}
          sub={brief.topVendorName ? brief.topVendorFormatted : 'No vendor data yet'}
          accent={brief.topVendorName ? 'primary' : 'default'}
          query="Which vendors need attention?"
          onSendMessage={onSendMessage}
        />

        <SignalCard
          icon={brief.isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          label="Net Cash"
          value={`${brief.isPositive ? '+' : '-'}${brief.netCashFormatted}`}
          sub={`${brief.transactionCount} transactions`}
          accent={cashAccent}
          query="What is my net cash?"
          onSendMessage={onSendMessage}
        />

        <SignalCard
          icon={<Sparkles className="w-3.5 h-3.5" />}
          label="Recurring Spend"
          value={brief.recurringCommitmentFormatted}
          sub="Estimated monthly floor"
          accent="primary"
          query="What is my recurring spend?"
          onSendMessage={onSendMessage}
        />
      </div>

      {/* Tap hint */}
      <p className="text-center text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
        Tap any card to ask Libby · or type your own question below
      </p>
    </div>
  );
};

export default WorkspaceBrief;
