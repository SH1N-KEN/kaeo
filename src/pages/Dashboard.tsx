import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  AlertCircle, 
  FileText, 
  CheckCircle2,
  AlertTriangle,
  Plus
} from 'lucide-react';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';
import { useWorkspace } from '../hooks/useWorkspace';
import KaeoHome from './KaeoHome';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';

const Dashboard: React.FC = () => {
  const { organizations, activeOrg, activeClient, loading, createClient } = useWorkspace();

  if (loading) {
    return <LoadingState />;
  }

  // If no organization exists, show guided onboarding
  if (organizations.length === 0) {
    return <KaeoHome />;
  }

  // If organization exists but no client is selected/exists
  if (!activeClient) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <EmptyState 
          title="No client workspace selected"
          description="Select an existing client or create a new one to start managing financial data."
          action={
            <button 
              onClick={() => {
                const name = prompt('Enter client name:');
                if (name && activeOrg) createClient(name, activeOrg.id);
              }}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create your first client
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Financial Overview</h1>
          <p className="text-muted-foreground">Real-time health for <span className="text-foreground font-medium">{activeClient.name}</span>.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-muted/50 border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            Monthly
          </button>
          <button className="px-4 py-2 bg-muted/50 border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            Custom Range
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          title="Total Revenue"
          value="₹42,50,000"
          trend="+12.5%"
          trendType="up"
          description="vs last month"
          icon={<TrendingUp className="w-5 h-5 text-success" />}
        />
        <MetricCard
          title="Total Expenses"
          value="₹28,30,000"
          trend="+4.2%"
          trendType="down"
          description="vs last month"
          icon={<ArrowDownRight className="w-5 h-5 text-risk" />}
        />
        <MetricCard
          title="Net Cash Movement"
          value="₹14,20,000"
          trend="+18.3%"
          trendType="up"
          description="vs last month"
          icon={<ArrowUpRight className="w-5 h-5 text-info" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Critical Risks
            </h2>
            <button className="text-sm text-primary hover:underline">View all</button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
              <div className="flex flex-col">
                <span className="font-medium text-sm">GST Filing Overdue</span>
                <span className="text-xs text-muted-foreground">Client: {activeClient.name}</span>
              </div>
              <StatusBadge status="high" label="Overdue" />
            </div>
            <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
              <div className="flex flex-col">
                <span className="font-medium text-sm">Suspicious Transaction</span>
                <span className="text-xs text-muted-foreground">Amount: ₹1,50,000</span>
              </div>
              <StatusBadge status="medium" label="Flagged" />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-info" />
              Recent Files
            </h2>
            <button className="text-sm text-primary hover:underline">Manage files</button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
              <div className="flex flex-col">
                <span className="font-medium text-sm">HDFC_Bank_Stmt_Apr24.pdf</span>
                <span className="text-xs text-muted-foreground">Uploaded 2h ago • 124 transactions</span>
              </div>
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div className="flex items-center justify-between p-4 bg-background border rounded-lg">
              <div className="flex flex-col">
                <span className="font-medium text-sm">Invoice_VND_882.png</span>
                <span className="text-xs text-muted-foreground">Uploaded 5h ago • Missing vendor info</span>
              </div>
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
