import React, { useState, useEffect } from 'react';
import { 
  Users, 
  TrendingUp, 
  Zap, 
  Loader2,
  ChevronRight,
  ShieldCheck,
  Search,
  Filter
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import { analyzeVendorsForClient } from '../lib/vendorEngine';
import EmptyState from '../components/ui/EmptyState';
import MetricCard from '../components/ui/MetricCard';

const Vendors: React.FC = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalSpend: 0,
    recurringCount: 0,
    reviewNeeded: 0
  });

  useEffect(() => {
    if (activeClient) fetchVendors();
  }, [activeClient]);

  const fetchVendors = async () => {
    if (!activeClient) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('total_spend', { ascending: false });

      if (error) throw error;
      setVendors(data || []);

      const s = (data || []).reduce((acc, v) => {
        acc.totalSpend += Number(v.total_spend);
        if (v.recurrence_pattern === 'monthly') acc.recurringCount++;
        if (v.recommendation.startsWith('Review') || v.recommendation.startsWith('Downgrade')) acc.reviewNeeded++;
        return acc;
      }, { totalSpend: 0, recurringCount: 0, reviewNeeded: 0 });
      setStats(s);

    } catch (err) {
      console.error('[Vendors] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!activeClient || !activeOrg) return;
    setAnalyzing(true);
    try {
      await analyzeVendorsForClient(activeOrg.id, activeClient.id);
      await fetchVendors();
    } catch (err) {
      console.error('[Vendors] Analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  if (!activeClient) {
    return <EmptyState title="No client selected" description="Select a client to view spend advisor." />;
  }

  if (loading && vendors.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse font-medium">Loading vendor intelligence...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Spend Advisor</h1>
            <div className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded border border-primary/20 uppercase tracking-tighter">AI Enabled</div>
          </div>
          <p className="text-sm text-muted-foreground">Strategic vendor management for <span className="text-foreground font-semibold">{activeClient.name}</span></p>
        </div>
        
        <button 
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-6 py-3 bg-foreground text-background rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-foreground/10 disabled:opacity-50"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {vendors.length > 0 ? 'Re-analyze Spend' : 'Analyze Spend'}
        </button>
      </div>

      {vendors.length === 0 ? (
        <div className="bg-card/30 border border-dashed border-border/60 rounded-3xl p-20 flex flex-col items-center justify-center text-center space-y-5">
          <div className="w-16 h-16 bg-muted/30 rounded-2xl flex items-center justify-center border border-border/50 text-muted-foreground/30">
            <Users className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">No vendor data yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Import transactions first, then run the Spend Advisor to detect vendors and get recommendations.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard 
              title="Cumulative Vendor Spend" 
              value={formatCurrency(stats.totalSpend)} 
              description="Total processed outflows"
              icon={<TrendingUp className="w-4 h-4 text-primary" />} 
            />
            <MetricCard 
              title="Recurring Vendors" 
              value={stats.recurringCount.toString()} 
              description="Monthly/Weekly subscriptions"
              icon={<Zap className="w-4 h-4 text-warning" />} 
            />
            <MetricCard 
              title="Optimization Potential" 
              value={stats.reviewNeeded.toString()} 
              description="Vendors flagged for CFO review"
              icon={<ShieldCheck className="w-4 h-4 text-success" />} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b bg-muted/10 flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Vendor Portfolio
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="text" placeholder="Search vendors..." className="bg-muted/50 border-none rounded-lg py-1.5 pl-9 pr-4 text-[10px] w-40 outline-none focus:ring-1 ring-primary/30" />
                    </div>
                    <button className="p-1.5 hover:bg-muted rounded-lg transition-colors border border-border/50">
                      <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-border/50">
                  {vendors.map((vendor) => (
                    <div key={vendor.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-muted/20 transition-colors group">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{vendor.display_name}</h4>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${vendor.recurrence_pattern === 'monthly' ? 'bg-warning/10 text-warning border border-warning/20' : 'bg-muted text-muted-foreground border border-border/50'}`}>
                            {vendor.recurrence_pattern}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                          <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {vendor.transaction_count} txns</span>
                          <span>•</span>
                          <span>Since {new Date(vendor.first_seen).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-12 text-right">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Total Spend</p>
                          <p className="text-sm font-bold">{formatCurrency(vendor.total_spend)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Monthly Avg</p>
                          <p className="text-sm font-bold text-foreground/80">{formatCurrency(vendor.monthly_average)}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 space-y-6">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Strategic Recommendations
                </h3>
                
                <div className="space-y-4">
                  {vendors.filter(v => v.recommendation !== 'Keep: Essential vendor with stable history.').slice(0, 5).map((vendor) => (
                    <div key={vendor.id} className="p-4 bg-background/50 rounded-xl border border-border/50 space-y-3 shadow-sm hover:border-primary/30 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{vendor.display_name}</span>
                        <div className={`w-2 h-2 rounded-full ${vendor.recommendation.startsWith('Review') ? 'bg-warning' : vendor.recommendation.startsWith('Downgrade') ? 'bg-risk' : 'bg-success'}`} />
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                        "{vendor.recommendation}"
                      </p>
                      <button className="w-full py-2 bg-muted/50 hover:bg-primary/10 hover:text-primary text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest">
                        Apply Strategy
                      </button>
                    </div>
                  ))}
                  
                  {vendors.length > 0 && vendors.every(v => v.recommendation.includes('Keep')) && (
                    <div className="py-8 text-center space-y-3">
                      <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center mx-auto text-success">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-muted-foreground font-medium px-4">Portfolio healthy. All vendors identified as essential.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Vendors;
