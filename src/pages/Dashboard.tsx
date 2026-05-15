import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  AlertCircle, 
  FileText, 
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import MetricCard from '../components/ui/MetricCard';
import StatusBadge from '../components/ui/StatusBadge';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Financial Overview</h1>
        <p className="text-muted-foreground">Real-time health of your business finances.</p>
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
          trendType="down" // Higher expenses is usually "down" for health but "up" in value
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
                <span className="text-xs text-muted-foreground">Client: TechNova Solutions</span>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
          <span className="text-muted-foreground text-sm mb-1">Open Risks</span>
          <span className="text-3xl font-bold text-risk">12</span>
        </div>
        <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
          <span className="text-muted-foreground text-sm mb-1">Files Uploaded</span>
          <span className="text-3xl font-bold">156</span>
        </div>
        <div className="bg-card border rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
          <span className="text-muted-foreground text-sm mb-1">Data Quality Warnings</span>
          <span className="text-3xl font-bold text-warning">8</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
