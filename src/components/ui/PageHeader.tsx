import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: {
    label: string;
    variant?: 'default' | 'success' | 'danger' | 'warning';
  };
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  tertiaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  rightContent?: React.ReactNode;
  className?: string;
}

const badgeVariantMap = {
  default: 'bg-[rgba(15,118,110,0.10)] text-[#0F766E] border-[rgba(15,118,110,0.20)]',
  success: 'bg-[rgba(22,138,91,0.10)] text-[#168A5B] border-[rgba(22,138,91,0.20)]',
  danger:  'bg-[rgba(194,65,58,0.10)] text-[#C2413A] border-[rgba(194,65,58,0.20)]',
  warning: 'bg-[rgba(183,121,31,0.10)] text-[#B7791F] border-[rgba(183,121,31,0.20)]',
};

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  rightContent,
  className = '',
}) => {
  return (
    <div className={`flex flex-col md:flex-row md:items-start justify-between gap-4 mb-5 ${className}`}>
      {/* Left: title + description */}
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
          <h1 className="page-title">{title}</h1>
          {badge && (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeVariantMap[badge.variant || 'default']}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        {description && (
          <p className="page-subtitle max-w-2xl">{description}</p>
        )}
      </div>

      {/* Right: actions */}
      {(primaryAction || secondaryAction || tertiaryAction || rightContent) && (
        <div className="flex items-center gap-2.5 flex-shrink-0 flex-wrap">
          {rightContent}
          {tertiaryAction && (
            <button
              onClick={tertiaryAction.onClick}
              className="btn-secondary btn-sm flex items-center gap-1.5"
            >
              {tertiaryAction.icon}
              {tertiaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="btn-secondary btn-sm flex items-center gap-1.5"
            >
              {secondaryAction.icon}
              {secondaryAction.label}
            </button>
          )}
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="btn-primary btn-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {primaryAction.icon}
              {primaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
