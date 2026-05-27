import React from 'react';

type Status = 'high' | 'medium' | 'low' | 'success' | 'info' | 'warning' | 'critical' | 'neutral';

interface StatusBadgeProps {
  status: Status;
  label: string;
  className?: string;
}

const statusStyles: Record<Status, string> = {
  critical: 'bg-[rgba(194,65,58,0.10)] text-[#C2413A] border-[rgba(194,65,58,0.20)]',
  high:     'bg-[rgba(183,121,31,0.10)] text-[#B7791F] border-[rgba(183,121,31,0.20)]',
  medium:   'bg-[rgba(212,146,42,0.10)] text-[#D4922A] border-[rgba(212,146,42,0.20)]',
  warning:  'bg-[rgba(183,121,31,0.10)] text-[#B7791F] border-[rgba(183,121,31,0.20)]',
  low:      'bg-[rgba(93,107,102,0.08)] text-[#5D6B66] border-[rgba(93,107,102,0.16)]',
  neutral:  'bg-[rgba(93,107,102,0.08)] text-[#5D6B66] border-[rgba(93,107,102,0.16)]',
  success:  'bg-[rgba(22,138,91,0.10)] text-[#168A5B] border-[rgba(22,138,91,0.20)]',
  info:     'bg-[rgba(37,99,235,0.08)] text-[#2563EB] border-[rgba(37,99,235,0.16)]',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className = '' }) => {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusStyles[status]} ${className}`}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
