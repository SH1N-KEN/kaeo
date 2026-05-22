import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  AlertCircle, 
  Search, 
  Filter, 
  ArrowUpRight,
  MoreVertical,
  Loader2,
  PieChart,
  Building2,
  Calendar,
  Zap
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import { analyzeVendorsForClient } from '../lib/vendorEngine';
import EmptyState from '../components/ui/EmptyState';
import MetricCard from '../components/ui/MetricCard';
import type { Vendor } from '../types/finance';

interface EnrichedVendor extends Vendor {
  openRisksCount: number;
  duplicateCount: number;
}

const Vendors: React.FC = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [vendors, setVendors] = useState<EnrichedVendor[]>([]);
  const [txCount, setTxCount] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeClient) {
      fetchTxCount();
      fetchVendors();
    }
  }, [activeClient]);

  const fetchTxCount = async () => {
    if (!activeClient) return;
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', activeClient.id)
      .in('type', ['expense', 'vendor_payment', 'subscription']);
    setTxCount(count || 0);
  };

  const fetchVendors = async () => {
    if (!activeClient) return;
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('vendors')
        .select('*')
        .eq('client_id', activeClient.id)
        .order('total_spend', { ascending: false });

      if (fetchErr) throw fetchErr;
      
      const { data: risksData } = await supabase
        .from('risk_events')
        .select('*')
        .eq('client_id', activeClient.id)
        .eq('status', 'open');

      const enriched = (data || []).map(v => {
        const vendorRisks = (risksData || []).filter(r => 
          r.vendor_id === v.id || r.evidence_json?.vendor_name === v.name
        );
        let dupCount = 0;
        vendorRisks.forEach(r => {
          if (r.risk_type.includes('duplicate')) {
            dupCount += Number(r.evidence_json?.transaction_count || 1);
          }
        });
        
        return {
          ...v,
          openRisksCount: vendorRisks.length,
          duplicateCount: dupCount,
        };
      });

      setVendors(enriched);
    } catch (err: any) {
      console.error('[Vendors] Fetch error:', err);
      if (err.message?.includes('column') && err.message?.includes('does not exist')) {
        setError('Database schema is out of date. Run latest Phase 5 repair migration (0007).');
      } else {
        setError(err.message || 'Failed to fetch vendor intelligence.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!activeClient || !activeOrg) return;
    setAnalyzing(true);
    setError(null);
    try {
      await analyzeVendorsForClient(activeOrg.id, activeClient.id);
      await fetchVendors();
    } catch (err: any) {
      console.error('[Vendors] Analysis failed:', err);
      if (err.message?.includes('column') && err.message?.includes('does not exist')) {
        setError('Database schema is out of date. Run latest Phase 5 repair migration (0007).');
      } else {
        setError('Strategic analysis failed: ' + err.message);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const formatCurrency = (val: number) => {
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(absVal);
    return isNegative ? `-${formatted}` : formatted;
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = vendors.reduce((acc, v) => {
    acc.totalSpend += Number(v.total_spend);
    if (v.recommendation === 'review' || v.recommendation === 'replace' || v.recommendation === 'cancel_candidate') acc.needsReview++;
    if (v.recurrence_pattern === 'monthly') acc.recurringSpend += Number(v.monthly_average);
    return acc;
  }, { totalSpend: 0, needsReview: 0, recurringSpend: 0 });

  if (!activeClient || !activeOrg) {
    return (
      <div className="h-[70vh] flex items-center justify-center animate-in fade-in duration-500">
        <EmptyState 
          title="No client workspace selected" 
          description="Select a client workspace to view strategic vendor analysis and spend advisor." 
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Spend Advisor</h1>
            <div className="px-2 py-0.5 bg-muted text-foreground text-[10px] font-black rounded-md border border-border uppercase tracking-tighter">CFO Intelligence</div>
          </div>
          <p className="text-sm text-muted-foreground">Strategic vendor portfolio analysis for <span className="text-foreground font-semibold">{activeClient.name}</span></p>
        </div>
        
        <button 
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-6 py-3 bg-foreground text-background rounded-md font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 text-xs cursor-pointer"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PieChart className="w-4 h-4" />}
          {vendors.length > 0 ? 'Refresh Intelligence' : 'Analyze Spend'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-risk/5 border border-risk/20 rounded-md flex gap-3 items-center">
          <AlertCircle className="w-5 h-5 text-risk shrink-0" />
          <p className="text-xs text-risk font-medium">{error}</p>
        </div>
      )}

      {loading && vendors.length === 0 ? (
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground animate-pulse font-medium">Aggregating vendor intelligence...</p>
        </div>
      ) : txCount === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-20 flex flex-col items-center justify-center text-center space-y-5">
          <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center border border-border text-muted-foreground/30">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">No vendor data found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Import transactions first to enable automated vendor portfolio analysis.
            </p>
          </div>
        </div>
      ) : vendors.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-20 flex flex-col items-center justify-center text-center space-y-5">
          <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center border border-border text-muted-foreground/60">
            <Zap className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">Ready for analysis</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              We found {txCount} expense transactions. Click 'Analyze Spend' to generate your vendor portfolio.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard 
              title="Total Portfolio Spend" 
              value={formatCurrency(stats.totalSpend)} 
              valueClassName="text-risk"
              description="Across all detected vendors"
              icon={<TrendingUp className="w-4 h-4 text-risk" />} 
              className="border border-border rounded-lg bg-card"
            />
            <MetricCard 
              title="Recurring Commitment" 
              value={formatCurrency(stats.recurringSpend)} 
              valueClassName="text-warning"
              description="Estimated monthly burn"
              icon={<Zap className="w-4 h-4 text-warning" />} 
              className="border border-border rounded-lg bg-card"
            />
            <MetricCard 
              title="Action Required" 
              value={stats.needsReview.toString()} 
              valueClassName="text-risk"
              description="Vendors flagged for review"
              icon={<AlertCircle className="w-4 h-4 text-risk" />} 
              className="border border-border rounded-lg bg-card"
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search vendors or categories..." 
                className="w-full bg-card border border-border rounded-md pl-12 pr-4 py-3 text-sm outline-none focus:border-neutral-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 bg-muted border border-border rounded-md text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 transition-colors cursor-pointer">
                <Filter className="w-3 h-3" /> Filter
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVendors.map((vendor) => {
              let badgeBgBorder = 'bg-muted border-border/50';
              let badgeText = 'text-muted-foreground';
              
              if (vendor.recommendation === 'keep') {
                badgeBgBorder = 'bg-success/5 border-success/20';
                badgeText = 'text-success';
              } else if (vendor.recommendation === 'review') {
                badgeBgBorder = 'bg-warning/5 border-warning/20';
                badgeText = 'text-warning';
              } else if (vendor.recommendation && ['replace', 'cancel_candidate'].includes(vendor.recommendation)) {
                badgeBgBorder = 'bg-risk/5 border-risk/20';
                badgeText = 'text-risk';
              }

              return (
                <div key={vendor.id} className="bg-card border border-border rounded-xl p-6 hover:border-muted-foreground transition-all group flex flex-col h-full">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center border border-border/50 transition-transform">
                        <Building2 className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground leading-tight">{vendor.name}</h3>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{vendor.category || 'Uncategorized'}</p>
                      </div>
                    </div>
                    <button className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground cursor-pointer">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Total Spend</p>
                      <p className="font-bold text-risk">{formatCurrency(vendor.total_spend)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Recurrence</p>
                      <p className="font-bold text-foreground capitalize">{vendor.recurrence_pattern}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="px-2 py-1 bg-muted/40 rounded-md text-[9px] font-bold text-muted-foreground uppercase tracking-widest border border-border/30">
                      {vendor.transaction_count} Txs
                    </span>
                    <span className="px-2 py-1 bg-muted/40 rounded-md text-[9px] font-bold text-muted-foreground uppercase tracking-widest border border-border/30">
                      Last: {new Date(vendor.last_seen).toLocaleDateString()}
                    </span>
                    {vendor.openRisksCount > 0 && (
                      <span className="px-2 py-1 bg-warning/10 rounded-md text-[9px] font-bold text-warning uppercase tracking-widest border border-warning/20 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {vendor.openRisksCount} Open Risks
                      </span>
                    )}
                    {vendor.duplicateCount > 0 && (
                      <span className="px-2 py-1 bg-risk/10 rounded-md text-[9px] font-bold text-risk uppercase tracking-widest border border-risk/20 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {vendor.duplicateCount} Duplicates
                      </span>
                    )}
                  </div>

                  <div className="mt-auto space-y-4">
                    <div className={`p-4 rounded-md border ${badgeBgBorder}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className={`w-3.5 h-3.5 ${badgeText}`} />
                        <p className={`text-[10px] font-black uppercase tracking-widest ${badgeText}`}>
                          {vendor.recommendation === 'keep' ? 'Strategic Hold' : 'Action: ' + (vendor.recommendation ? vendor.recommendation.replace('_', ' ') : 'review')}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                        {vendor.recommendation_reason}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                        <Calendar className="w-3 h-3" /> Since {new Date(vendor.first_seen).toLocaleDateString()}
                      </div>
                      <button className="p-2 bg-muted rounded-md group-hover:bg-muted-foreground/15 transition-all cursor-pointer">
                        <ArrowUpRight className="w-4 h-4 text-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Vendors;
