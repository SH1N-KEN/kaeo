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
    return null;
  }

  // Compile active attention points
  const attentionItems: string[] = [];
  if (brief.unreviewedCount > 0) {
    attentionItems.push(`${brief.unreviewedCount} transaction${brief.unreviewedCount !== 1 ? 's' : ''} need review`);
  }
  if (brief.missingProofAmount > 0) {
    const formattedAmt = '₹' + Math.round(brief.missingProofAmount).toLocaleString('en-IN');
    attentionItems.push(`${formattedAmt} missing proof`);
  }
  if (brief.categoryTrendStr) {
    attentionItems.push(brief.categoryTrendStr);
  }
  if (brief.hasDuplicateVendor) {
    attentionItems.push('Duplicate vendor detected');
  } else if (brief.openRisksCount > 0) {
    attentionItems.push(`${brief.openRisksCount} open risk${brief.openRisksCount !== 1 ? 's' : ''} detected`);
  }

  const attentionCount = attentionItems.length;

  const recommendations = [
    { label: 'Review Risks', query: 'What risks need review?' },
    { label: 'Compare This Month', query: 'Give me a full monthly summary' },
    { label: 'Vendor Analysis', query: 'Which vendors need attention?' },
    { label: 'Generate Executive Summary', query: 'Are we ready for month-end?' },
  ];

  return (
    <div className={`w-full mx-auto animate-in fade-in duration-300 ${compact ? 'max-w-xs' : 'max-w-xl'} flex flex-col gap-4 text-left`}>
      {/* Header */}
      <div>
        <h3 className={`font-bold text-foreground ${compact ? 'text-sm' : 'text-base'}`}>
          {brief.greeting}.
        </h3>
        <p className={`text-muted-foreground mt-0.5 ${compact ? 'text-[11px]' : 'text-xs'}`}>
          {attentionCount > 0
            ? `${attentionCount} thing${attentionCount !== 1 ? 's' : ''} need your attention today.`
            : 'Workspace is all clear today.'}
        </p>
      </div>

      {/* Bulleted summary card */}
      {attentionCount > 0 && (
        <div className="frosted-card border border-border/40 p-4 rounded-xl space-y-2 bg-muted/5">
          <ul className={`space-y-1.5 ${compact ? 'text-[11px]' : 'text-xs'}`}>
            {attentionItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-foreground/90 font-medium">
                <span className="text-[var(--primary)] mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      <div className="space-y-2">
        <span className={`font-black uppercase tracking-wider text-muted-foreground/80 ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
          Recommendations
        </span>
        <div className="flex flex-wrap gap-2">
          {recommendations.map((rec, idx) => (
            <button
              key={idx}
              onClick={() => onSendMessage(rec.query)}
              className={`frosted-card border border-border/40 hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5 transition-all duration-200 rounded-xl font-semibold text-foreground/90 hover:text-foreground text-left cursor-pointer flex items-center justify-between gap-2 group ${
                compact ? 'px-3 py-2 text-[10px]' : 'px-4 py-3 text-xs w-full'
              }`}
            >
              <span>{rec.label}</span>
              <Sparkles className="w-3 h-3 text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceBrief;
