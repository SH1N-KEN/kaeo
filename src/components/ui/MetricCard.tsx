import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  description, 
  icon, 
  trend,
  className = "" 
}) => {
  return (
    <div className={`bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 group ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-muted/50 rounded-xl group-hover:bg-primary/10 transition-colors duration-500">
          {icon}
        </div>
        {trend && (
          <div className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${trend.isPositive ? 'bg-success/10 text-success' : 'bg-risk/10 text-risk'}`}>
            {trend.isPositive ? '+' : '-'}{trend.value}%
          </div>
        )}
      </div>
      
      <div>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 mb-1">{title}</h4>
        <div className="text-xl font-bold tracking-tight text-foreground">{value}</div>
        {description && (
          <p className="text-[10px] text-muted-foreground/60 mt-1 font-medium leading-tight">{description}</p>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
