import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  description?: string;
  icon?: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  trend, 
  trendType = 'neutral', 
  description,
  icon 
}) => {
  const trendColor = {
    up: 'text-success',
    down: 'text-risk',
    neutral: 'text-muted-foreground'
  }[trendType];

  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className="p-2 bg-muted rounded-lg">
          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
        {trend && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${trendColor}`}>
              {trend}
            </span>
            <span className="text-xs text-muted-foreground">
              {description}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
