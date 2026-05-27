import React from 'react';
import { FileText, Plus } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = <FileText className="w-7 h-7 text-[var(--muted-foreground)]" style={{ opacity: 0.5 }} />,
  action,
  secondaryAction,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: { container: 'py-10 px-6', iconBox: 'w-12 h-12', title: 'text-base', body: 'text-xs' },
    md: { container: 'py-16 px-8', iconBox: 'w-16 h-16', title: 'text-lg', body: 'text-sm' },
    lg: { container: 'py-24 px-12', iconBox: 'w-20 h-20', title: 'text-xl', body: 'text-sm' },
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center ${sizeClasses.container} text-center`}>
      {/* Icon */}
      <div
        className={`${sizeClasses.iconBox} rounded-2xl flex items-center justify-center mb-5 border border-dashed border-[var(--border)]`}
        style={{ background: 'var(--muted)' }}
      >
        {icon}
      </div>

      {/* Text */}
      <h3 className={`${sizeClasses.title} font-semibold tracking-tight text-[var(--foreground)] mb-2`}>
        {title}
      </h3>
      <p className={`${sizeClasses.body} text-[var(--muted-foreground)] max-w-sm leading-relaxed mb-6`}>
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {action && (
            <button
              onClick={action.onClick}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="btn-secondary"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
