import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value?: number;
    isPositive?: boolean;
    isNeutral?: boolean;
    label?: string;
    direction?: 'up' | 'down';
  };
  className?: string;
  valueClassName?: string;
  onClick?: () => void;
  accentColor?: 'default' | 'success' | 'danger' | 'warning' | 'primary';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  className = '',
  valueClassName = '',
  onClick,
  accentColor = 'default',
}) => {
  const accentMap = {
    default: { icon: 'bg-[var(--muted)] text-[var(--muted-foreground)]' },
    success: { icon: 'bg-[rgba(22,138,91,0.10)] text-[#168A5B]' },
    danger:  { icon: 'bg-[rgba(194,65,58,0.10)] text-[#C2413A]' },
    warning: { icon: 'bg-[rgba(183,121,31,0.10)] text-[#B7791F]' },
    primary: { icon: 'bg-[rgba(15,118,110,0.10)] text-[#0F766E]' },
  };

  const valueColorMap = {
    default: 'text-[var(--foreground)]',
    success: 'text-[#168A5B]',
    danger:  'text-[#C2413A]',
    warning: 'text-[#B7791F]',
    primary: 'text-[#0F766E]',
  };

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className={`kaeo-card ${onClick ? 'kaeo-card-clickable cursor-pointer' : ''} p-5 flex flex-col justify-between h-full min-h-[120px] ${className}`}
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--muted-foreground)] leading-tight">
          {title}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                trend.isNeutral
                  ? 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                  : trend.isPositive
                    ? 'bg-[rgba(22,138,91,0.10)] text-[#168A5B]'
                    : 'bg-[rgba(194,65,58,0.10)] text-[#C2413A]'
              }`}
            >
              {!trend.isNeutral && (
                (trend.direction === 'down' || (trend.direction === undefined && !trend.isPositive))
                  ? <TrendingDown className="w-3 h-3" />
                  : <TrendingUp className="w-3 h-3" />
              )}
              {trend.label !== undefined ? trend.label : `${trend.value}%`}
            </span>
          )}
          {icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accentMap[accentColor].icon}`}>
              {icon}
            </div>
          )}
        </div>
      </div>

      {/* Value */}
      <div>
        <div className={`text-2xl font-bold tracking-tight leading-none ${valueClassName || valueColorMap[accentColor]}`}>
          {value}
        </div>
        {description && (
          <p className="text-[12px] text-[var(--muted-foreground)] mt-1.5 font-normal leading-snug">
            {description}
          </p>
        )}
      </div>
    </Tag>
  );
};

export default MetricCard;
