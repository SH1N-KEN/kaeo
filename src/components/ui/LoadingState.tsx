import React from 'react';

const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    <p className="text-muted-foreground font-medium animate-pulse">Loading Kaeo Workspace...</p>
  </div>
);

export default LoadingState;
