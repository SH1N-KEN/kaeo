import React from 'react';

interface SectionCardProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  action,
  children,
  className = '',
  bodyClassName = '',
  noPadding = false,
}) => {
  const hasHeader = title || description || action;

  return (
    <div className={`kaeo-card overflow-hidden ${className}`}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-[var(--border)]">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[15px] font-semibold text-[var(--foreground)] tracking-tight leading-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5 leading-snug">
                {description}
              </p>
            )}
          </div>
          {action && (
            <div className="flex-shrink-0">{action}</div>
          )}
        </div>
      )}
      <div className={noPadding ? bodyClassName : `p-5 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
};

export default SectionCard;
