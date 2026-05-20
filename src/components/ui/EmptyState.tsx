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
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  title, 
  description, 
  icon = <FileText className="w-10 h-10 text-muted-foreground/40" />, 
  action 
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-500">
      <div className="w-20 h-20 bg-muted/30 rounded-3xl flex items-center justify-center mb-6 border border-border/50 shadow-inner">
        {icon}
      </div>
      <h3 className="text-xl font-bold tracking-tight mb-2 text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 bg-foreground text-background rounded-md font-semibold hover:opacity-90 transition-all flex items-center gap-2 text-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
