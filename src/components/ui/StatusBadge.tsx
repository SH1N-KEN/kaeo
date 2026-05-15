import React from 'react';

type Status = 'high' | 'medium' | 'low' | 'success' | 'info';

interface StatusBadgeProps {
  status: Status;
  label: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const styles = {
    high: 'bg-risk/10 text-risk border-risk/20',
    medium: 'bg-warning/10 text-warning border-warning/20',
    low: 'bg-muted-slate/10 text-muted-slate border-muted-slate/20',
    success: 'bg-success/10 text-success border-success/20',
    info: 'bg-info/10 text-info border-info/20',
  }[status];

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
