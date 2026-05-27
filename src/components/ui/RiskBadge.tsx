import React from 'react';

type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

interface RiskBadgeProps {
  severity: RiskSeverity | string;
  className?: string;
  showDot?: boolean;
}

const severityConfig: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  critical: {
    label: 'Critical',
    bg:     'rgba(194,65,58,0.10)',
    text:   '#C2413A',
    border: 'rgba(194,65,58,0.22)',
    dot:    '#C2413A',
  },
  high: {
    label: 'High',
    bg:     'rgba(183,121,31,0.10)',
    text:   '#B7791F',
    border: 'rgba(183,121,31,0.22)',
    dot:    '#B7791F',
  },
  medium: {
    label: 'Medium',
    bg:     'rgba(212,146,42,0.10)',
    text:   '#D4922A',
    border: 'rgba(212,146,42,0.22)',
    dot:    '#D4922A',
  },
  low: {
    label: 'Low',
    bg:     'rgba(22,138,91,0.08)',
    text:   '#168A5B',
    border: 'rgba(22,138,91,0.18)',
    dot:    '#168A5B',
  },
};

const RiskBadge: React.FC<RiskBadgeProps> = ({ severity, className = '', showDot = true }) => {
  const config = severityConfig[severity?.toLowerCase()] || severityConfig['medium'];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}
      style={{
        background:   config.bg,
        color:        config.text,
        borderColor:  config.border,
      }}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: config.dot }}
        />
      )}
      {config.label}
    </span>
  );
};

export default RiskBadge;
