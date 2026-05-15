import React from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-risk/5 border border-risk/20 rounded-xl">
    <div className="p-4 bg-risk/10 rounded-full mb-4">
      <AlertCircle className="w-8 h-8 text-risk" />
    </div>
    <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
    <p className="text-muted-foreground max-w-sm mb-6">{message}</p>
    {onRetry && (
      <button 
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 bg-risk text-white rounded-lg hover:bg-risk/90 transition-colors"
      >
        <RefreshCcw className="w-4 h-4" />
        Try Again
      </button>
    )}
  </div>
);

export default ErrorState;
