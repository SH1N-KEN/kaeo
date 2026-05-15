import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-card border border-dashed rounded-xl">
    <div className="p-4 bg-muted rounded-full mb-4">
      <Inbox className="w-8 h-8 text-muted-foreground" />
    </div>
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
    {action}
  </div>
);

export default EmptyState;
