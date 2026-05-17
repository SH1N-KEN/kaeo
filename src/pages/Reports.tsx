import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../hooks/useWorkspace';
import { useNavigate } from 'react-router-dom';
import { generateCFOReport } from '../lib/reportEngine';
import { FileText, Plus, AlertCircle, Eye, Calendar, Layers, ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';

export default function Reports() {
  const { activeOrg, activeClient } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [transactionCount, setTransactionCount] = useState(0);
  const [schemaError, setSchemaError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeOrg && activeClient) {
      checkDataAndFetchReports();
    } else {
      setLoading(false);
    }
  }, [activeOrg, activeClient]);

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

    try {
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

  if (!activeClient) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Layers className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Client Selected</h2>
        <p className="text-muted-foreground">Select a client to view and generate reports.</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Accountant-ready CFO outputs for {activeClient.name}
          </p>
        </div>
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

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-4 flex items-center">
          <AlertCircle className="h-5 w-5 mr-3 shrink-0" />
          <p>{error}</p>
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
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
                    {report.summary_json?.netCashMovement ? 
                      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(report.summary_json.netCashMovement) 
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
