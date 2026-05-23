import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../hooks/useWorkspace';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { generateCFOReport, formatReportCurrency } from '../lib/reportEngine';
import { FileText, Plus, AlertCircle, Eye, Calendar, ShieldAlert, Loader2, Zap, DownloadCloud } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { trackUsageEvent } from '../lib/billing';
import { checkUsageEventAllowed } from '../lib/billingGuards';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import { generateMonthEndReviewPlan } from '../lib/aiReviewEngine';

export default function Reports() {
  const { activeOrg, activeClient } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchVal = searchParams.get('search') || '';

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [transactionCount, setTransactionCount] = useState(0);
  const [schemaError, setSchemaError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [readinessPlan, setReadinessPlan] = useState<any>(null);
  const { toast } = useToast();

  const filteredReports = React.useMemo(() => {
    if (!searchVal) return reports;
    const term = searchVal.toLowerCase();
    return reports.filter(r => 
      r.title?.toLowerCase().includes(term)
    );
  }, [reports, searchVal]);

  useEffect(() => {
    if (activeOrg && activeClient) {
      checkDataAndFetchReports();
      fetchReadinessProjections();
    } else {
      setLoading(false);
    }
  }, [activeOrg, activeClient]);

  const fetchReadinessProjections = async () => {
    if (!activeOrg || !activeClient) return;
    try {
      const [txRes, riskRes, sugRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('client_id', activeClient.id),
        supabase.from('risk_events').select('*').eq('client_id', activeClient.id),
        supabase.from('ai_review_suggestions').select('*').eq('client_id', activeClient.id).eq('status', 'pending'),
      ]);

      const txs = txRes.data || [];
      const rks = riskRes.data || [];
      const sugs = sugRes.data || [];

      const plan = generateMonthEndReviewPlan(txs, rks, sugs);
      setReadinessPlan(plan);
    } catch (e) {
      console.error('Error fetching projections:', e);
    }
  };

  const checkDataAndFetchReports = async () => {
    if (!activeOrg || !activeClient) return;
    setLoading(true);
    setSchemaError(false);
    setError(null);

    try {
      // Check transactions
      const { count: txCount, error: txError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', activeOrg.id)
        .eq('client_id', activeClient.id);
      
      if (txError) throw txError;
      setTransactionCount(txCount || 0);

      // Fetch reports
      const { data, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .eq('organization_id', activeOrg.id)
        .eq('client_id', activeClient.id)
        .order('created_at', { ascending: false });

      if (reportsError) {
        if (reportsError.message?.includes('does not exist')) {
          setSchemaError(true);
        } else {
          throw reportsError;
        }
      } else {
        setReports(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!activeOrg || !activeClient || !user) return;
    setGenerating(true);
    setError(null);
    setShowUpgrade(false);

    try {
      // Enforce monthly report generation limit
      const limitCheck = await checkUsageEventAllowed(activeOrg.id, 'report_generated', 1);
      if (!limitCheck.allowed) {
        setError(limitCheck.message || 'Report generation limit reached for this billing cycle. Please upgrade your plan in settings.');
        setShowUpgrade(true);
        setGenerating(false);
        return;
      }

      // 1. Fetch all required data
      const [txRes, vendorRes, riskRes, noteRes, fileRes, importRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('organization_id', activeOrg.id).eq('client_id', activeClient.id),
        supabase.from('vendors').select('*').eq('organization_id', activeOrg.id).eq('client_id', activeClient.id),
        supabase.from('risk_events').select('*').eq('organization_id', activeOrg.id).eq('client_id', activeClient.id),
        supabase.from('notes').select('*').eq('organization_id', activeOrg.id).eq('client_id', activeClient.id),
        supabase.from('uploaded_files').select('*').eq('organization_id', activeOrg.id).eq('client_id', activeClient.id),
        supabase.from('imports').select('*').eq('organization_id', activeOrg.id).eq('client_id', activeClient.id)
      ]);

      if (txRes.error) throw txRes.error;
      if (vendorRes.error) throw vendorRes.error;
      if (riskRes.error) throw riskRes.error;
      if (noteRes.error) throw noteRes.error;
      if (fileRes.error) throw fileRes.error;
      if (importRes.error) throw importRes.error;

      // 2. Generate report data
      const generatedData = await generateCFOReport({
        organization: activeOrg,
        client: activeClient,
        transactions: txRes.data || [],
        vendors: vendorRes.data || [],
        riskEvents: riskRes.data || [],
        notes: noteRes.data || [],
        uploadedFiles: fileRes.data || [],
        imports: importRes.data || [],
        generatedBy: user.id
      });

      // 3. Save to database
      const { data: newReport, error: insertError } = await supabase
        .from('reports')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          title: generatedData.title,
          report_type: generatedData.report_type,
          period_start: generatedData.period_start,
          period_end: generatedData.period_end,
          summary_json: generatedData.summary_json,
          sections_json: generatedData.sections_json,
          source_json: generatedData.source_json,
          generated_by: user.id
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.message?.includes('does not exist')) {
          setSchemaError(true);
          return;
        }
        throw insertError;
      }

      // Track usage: report generated
      if (activeOrg && activeClient) {
        trackUsageEvent({
          organizationId: activeOrg.id,
          clientId: activeClient.id,
          eventType: 'report_generated',
          quantity: 1,
          userId: user.id
        });
      }

      // 4. Navigate to new report
      if (newReport) {
        navigate(`/reports/${newReport.id}`);
      }

    } catch (err: any) {
      console.error('Error generating report:', err);
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (!activeClient || !activeOrg) {
    return (
      <div className="h-[70vh] flex items-center justify-center animate-in fade-in duration-500">
        <EmptyState 
          title="No client workspace selected"
          description="Select a client workspace to view or compile professional CFO-ready reporting packages."
        />
      </div>
    );
  }

  if (schemaError) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-6 max-w-2xl mx-auto flex items-start space-x-4">
          <AlertCircle className="h-6 w-6 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-lg mb-1">Reports schema missing. Run latest migration.</h3>
            <p className="opacity-90">The reports table is missing from the database. Please run the <code className="bg-black/10 px-1 py-0.5 rounded">0009_reports.sql</code> migration in Supabase to continue.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading reports...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {readinessPlan && readinessPlan.totalCount > 0 && (
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-5 flex items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center text-teal-400 shrink-0">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Month-End Readiness Optimizer</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed font-medium">
                Approve <strong className="text-teal-400">{readinessPlan.safeCount} safe suggestions</strong> to move readiness from{' '}
                <strong className="text-risk">{readinessPlan.currentScore}%</strong> to approximately{' '}
                <strong className="text-success">{readinessPlan.projectedScore}%</strong> (estimated projection).
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/transactions?review_status=ai_suggested')}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Optimize Readiness
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Accountant-ready CFO outputs for {activeClient.name}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!activeOrg || !activeClient) return;
              try {
                const { data, error } = await supabase
                  .from('transactions')
                  .select('*')
                  .eq('organization_id', activeOrg.id)
                  .eq('client_id', activeClient.id)
                  .order('transaction_date', { ascending: false });

                if (error) throw error;
                if (!data || data.length === 0) {
                  toast('No transactions found', 'error');
                  return;
                }

                // Generate CSV
                const headers = ['Date', 'Description', 'Amount (INR)', 'Type', 'Category', 'Source', 'Review Status'];
                const rows = data.map(tx => [
                  tx.transaction_date?.split('T')[0] || '',
                  `"${(tx.description || '').replace(/"/g, '""')}"`,
                  tx.amount,
                  tx.type,
                  tx.category || 'Uncategorized',
                  tx.source_provider || 'Manual',
                  tx.review_status || 'new'
                ]);

                const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `kaeo_accountant_pack_${activeClient.name.replace(/\\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                if (user) {
                  await supabase.from('audit_events').insert({
                    organization_id: activeOrg.id,
                    client_id: activeClient.id,
                    user_id: user.id,
                    action: 'accountant_pack_exported',
                    resource_type: 'report',
                    resource_id: 'csv',
                    metadata_json: { rows: data.length }
                  });
                }
                
                toast('Accountant Pack downloaded successfully', 'success');
              } catch (err: any) {
                toast(err.message, 'error');
              }
            }}
            disabled={transactionCount === 0}
            className="bg-muted text-foreground px-4 py-2 rounded-md font-medium flex items-center hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-border"
          >
            <DownloadCloud className="h-4 w-4 mr-2" />
            Accountant Pack (CSV)
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={generating || transactionCount === 0}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium flex items-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-risk/5 border border-risk/10 rounded-xl flex gap-3 items-start animate-in shake-in">
          <AlertCircle className="w-5 h-5 text-risk/70 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm text-risk/80 font-bold">{showUpgrade ? 'Usage Limit Exceeded' : 'Generation Failed'}</h4>
            <p className="text-xs text-risk/60 mt-1">{error}</p>
            {showUpgrade && (
              <button
                onClick={() => navigate('/billing')}
                className="mt-3 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold rounded-lg transition-all shadow-md shadow-primary/10 inline-flex items-center gap-1.5 animate-in fade-in"
              >
                <Zap className="w-3.5 h-3.5 text-warning fill-warning" />
                Upgrade Subscription
              </button>
            )}
          </div>
          <button onClick={() => setError(null)} className="text-[10px] font-black text-risk/60 hover:text-risk uppercase">Dismiss</button>
        </div>
      )}

      {transactionCount === 0 ? (
        <div className="bg-muted/30 border rounded-lg p-12 text-center flex flex-col items-center">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No data available</h3>
          <p className="text-muted-foreground mb-6">Import transactions before generating reports.</p>
          <button
            onClick={() => navigate('/files')}
            className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 font-medium"
          >
            Go to File Imports
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-muted/30 border rounded-lg p-12 text-center flex flex-col items-center">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No reports yet</h3>
          <p className="text-muted-foreground mb-6">Generate your first CFO report for {activeClient.name} using the imported transaction data.</p>
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 font-medium flex items-center"
          >
            {generating ? 'Generating...' : 'Generate First Report'}
          </button>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-card border rounded-2xl p-16 text-center text-muted-foreground">
          <p className="text-sm font-semibold">No matching reports found for "{searchVal}"</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredReports.map((report) => (
            <div key={report.id} className="bg-card border rounded-lg p-5 flex flex-col hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs font-medium bg-muted px-2 py-1 rounded-full text-muted-foreground">
                  {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(report.created_at))}
                </span>
              </div>
              
              <h3 className="font-semibold text-lg mb-1 truncate" title={report.title}>{report.title}</h3>
              
              {report.period_start && report.period_end ? (
                <p className="text-sm text-muted-foreground flex items-center mb-4">
                  <Calendar className="h-3 w-3 mr-1.5" />
                  {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(report.period_start))} - {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(report.period_end))}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center mb-4">
                  <Calendar className="h-3 w-3 mr-1.5" />
                  All time
                </p>
              )}

              <div className="space-y-2 mt-auto pt-4 border-t border-border/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Transactions</span>
                  <span className="font-medium">{report.summary_json?.transactionCount || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Net Cash</span>
                  <span className={`font-medium ${
                    (report.summary_json?.netCashMovement || 0) >= 0 ? 'text-success' : 'text-risk'
                  }`}>
                    {report.summary_json?.netCashMovement !== undefined ? 
                      formatReportCurrency(report.summary_json.netCashMovement, activeClient.base_currency || 'INR') 
                      : '₹0'}
                  </span>
                </div>
                {(report.summary_json?.openRisksCount > 0) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Open Risks</span>
                    <span className="font-medium text-risk flex items-center">
                      <ShieldAlert className="h-3 w-3 mr-1" />
                      {report.summary_json.openRisksCount}
                    </span>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => navigate(`/reports/${report.id}`)}
                className="w-full mt-4 bg-secondary/50 text-secondary-foreground hover:bg-secondary py-2 rounded-md font-medium text-sm transition-colors flex items-center justify-center"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Report
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
