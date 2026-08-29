import React from 'react';

type StatusChipVariant =
  | 'reviewed'
  | 'needs_review'
  | 'new'
  | 'ignored'
  | 'resolved'
  | 'duplicate'
  | 'mismatch'
  | 'uncategorized'
  | 'high_risk'
  | 'medium_risk'
  | 'low_risk'
  | 'export_ready'
  | 'synced'
  | 'critical';

interface StatusChipProps {
  variant: StatusChipVariant;
  label?: string;
  className?: string;
  dot?: boolean;
}

const chipConfig: Record<StatusChipVariant, { label: string; className: string; dotColor?: string }> = {
  reviewed:       { label: 'Reviewed',         className: 'chip chip-reviewed',       dotColor: '#168A68' },
  needs_review:   { label: 'Needs Review',      className: 'chip chip-needs-review',   dotColor: '#B87516' },
  new:            { label: 'New',               className: 'chip chip-new',            dotColor: '#52615D' },
  ignored:        { label: 'Ignored',           className: 'chip chip-ignored',        dotColor: '#788581' },
  resolved:       { label: 'Resolved',          className: 'chip chip-reviewed',       dotColor: '#0E9F91' },
  duplicate:      { label: 'Duplicate',         className: 'chip chip-duplicate',      dotColor: '#7853AA' },
  mismatch:       { label: 'Invoice Mismatch',  className: 'chip chip-mismatch',       dotColor: '#B87516' },
  uncategorized:  { label: 'Uncategorized',     className: 'chip chip-uncategorized',  dotColor: '#52615D' },
  high_risk:      { label: 'High Risk',         className: 'chip chip-high-risk',      dotColor: '#C83F45' },
  medium_risk:    { label: 'Medium Risk',       className: 'chip chip-medium-risk',    dotColor: '#B87516' },
  low_risk:       { label: 'Low Risk',          className: 'chip chip-low-risk',       dotColor: '#168A68' },
  export_ready:   { label: 'Export Ready',      className: 'chip chip-export-ready',   dotColor: '#0E9F91' },
  synced:         { label: 'Synced',            className: 'chip chip-synced',         dotColor: '#3979B9' },
  critical:       { label: 'Critical',          className: 'chip chip-critical',       dotColor: '#C83F45' },
};

export const StatusChip: React.FC<StatusChipProps> = ({ variant, label, className = '', dot = false }) => {
  const config = chipConfig[variant] || chipConfig['new'];
  const displayLabel = label ?? config.label;

  return (
    <span className={`${config.className} ${className}`}>
      {dot && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: config.dotColor }}
        />
      )}
      {displayLabel}
    </span>
  );
};

/** Map review_status string to StatusChip variant */
export function reviewStatusToVariant(status: string | null | undefined): StatusChipVariant {
  switch (status) {
    case 'reviewed':    return 'reviewed';
    case 'needs_review':return 'needs_review';
    case 'ignored':     return 'ignored';
    case 'resolved':    return 'resolved';
    case 'new':
    default:            return 'new';
  }
}

/** Map risk severity to variant */
export function severityToVariant(severity: string | null | undefined): StatusChipVariant {
  switch (severity) {
    case 'critical': return 'critical';
    case 'high':     return 'high_risk';
    case 'medium':   return 'medium_risk';
    case 'low':      return 'low_risk';
    default:         return 'medium_risk';
  }
}

export default StatusChip;
