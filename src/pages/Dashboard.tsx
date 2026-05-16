import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertCircle,
  FileText,
  Plus
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import EmptyState from '../components/ui/EmptyState';
import MetricCard from '../components/ui/MetricCard';

const Dashboard: React.FC = () => {
  const { activeClient } = useWorkspace();

  if (!activeClient) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <EmptyState 
          title="No client workspace selected"
          description="Create or select a client workspace to view financial insights."
        />
      </div>
    );
  }

  // Phase 3 Dashboard: No fake numbers.
  // We'll show empty states or placeholders for metrics until Phase 4.

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Financial Overview</h1>
          <p className="text-muted-foreground">Insights and intelligence for <span className="text-foreground font-semibold">{activeClient.name}</span>.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-xl text-sm font-semibold transition-all">
            Download Report
          </button>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
            <Plus className="w-4 h-4" /> Add Transaction
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Revenue" 
          value="—" 
          trend="0%" 
          trendType="up" 
          icon={<TrendingUp className="w-5 h-5 text-success" />} 
        />
        <MetricCard 
          title="Total Expenses" 
          value="—" 
          trend="0%" 
          trendType="down" 
          icon={<TrendingDown className="w-5 h-5 text-risk" />} 
        />
        <MetricCard 
          title="Net Cash Movement" 
          value="—" 
          trend="0%" 
          trendType="neutral" 
          icon={<DollarSign className="w-5 h-5 text-primary" />} 
        />
        <MetricCard 
          title="Risk Level" 
          value="None" 
          description="Safe" 
          icon={<AlertCircle className="w-5 h-5 text-muted-foreground" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-card border rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-2">
            <FileText className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-bold">No financial data yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Upload and map a finance file to start building your dashboard insights and AI CFO reports.
          </p>
          <button 
            onClick={() => window.location.href = '/files'}
            className="mt-4 px-6 py-2.5 bg-foreground text-background rounded-xl font-bold hover:opacity-90 transition-all"
          >
            Upload Finance File
          </button>
        </div>

        <div className="bg-card border rounded-2xl p-6 space-y-6">
          <h3 className="font-bold text-lg">AI CFO Insights</h3>
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Once you upload transaction data, I'll start analyzing your burn rate, runway, and vendor spending patterns.
            </p>
          </div>
          <div className="space-y-4 opacity-50">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-10 h-10 bg-muted rounded-lg shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
