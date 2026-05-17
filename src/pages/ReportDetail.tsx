import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../hooks/useWorkspace';
import { ArrowLeft, Printer, AlertTriangle, Info, CheckCircle2, FileText, AlertCircle, MessageSquare } from 'lucide-react';
import { formatReportCurrency } from '../lib/reportEngine';

export default function ReportDetail() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { activeOrg, activeClient } = useWorkspace();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeOrg && activeClient && reportId) {
      fetchReport();
    } else {
      setLoading(false);
    }
  }, [activeOrg, activeClient, reportId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .eq('organization_id', activeOrg!.id)
        .eq('client_id', activeClient!.id)
        .single();

      if (error) throw error;
      setReport(data);
    } catch (err: any) {
      console.error('Error fetching report detail:', err);
      setError('Report not found or access denied.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Report Not Found</h2>
        <p className="text-muted-foreground mb-6">{error || 'The requested report could not be loaded.'}</p>
        <button
          onClick={() => navigate('/reports')}
          className="bg-primary text-primary-foreground px-4 py-2 rounded font-medium"
        >
          Back to Reports
        </button>
      </div>
    );
  }

  const { sections_json: sections, summary_json: summary } = report;

  // Render logic for print layout vs screen layout is mostly CSS, but we can structure the HTML properly.

  return (
    <div className="pb-24">
      {/* Screen only top bar */}
      <div className="print:hidden max-w-5xl mx-auto mb-6 flex justify-between items-center">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Reports
        </button>
        <button
          onClick={handlePrint}
          className="bg-primary text-primary-foreground px-4 py-2 rounded flex items-center font-medium shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print / Save as PDF
        </button>
      </div>

      {/* The Printable Report Container */}
      <div className="print-container bg-card md:border rounded-lg shadow-sm max-w-5xl mx-auto overflow-hidden">
        
        {/* HEADER */}
        <div className="p-8 md:p-12 border-b">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">CFO Report</h1>
              <p className="text-xl text-muted-foreground">{summary.clientName}</p>
            </div>
            <div className="text-right">
              <div className="font-bold text-2xl tracking-tight">Kaeo</div>
              <p className="text-sm text-muted-foreground">Financial Intelligence</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-muted-foreground uppercase text-xs font-semibold tracking-wider mb-1">Period</p>
              <p className="font-medium">{summary.period}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase text-xs font-semibold tracking-wider mb-1">Generated</p>
              <p className="font-medium">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(report.created_at))}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase text-xs font-semibold tracking-wider mb-1">Transactions</p>
              <p className="font-medium">{summary.transactionCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase text-xs font-semibold tracking-wider mb-1">Net Cash</p>
              <p className={`font-medium ${summary.netCashMovement >= 0 ? 'text-success' : 'text-risk'}`}>
                {formatReportCurrency(summary.netCashMovement)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-12 space-y-12 print-content">
          
          {/* EXECUTIVE SUMMARY */}
          <section className="print-section">
            <h2 className="text-2xl font-bold border-b pb-2 mb-4">Executive Summary</h2>
            <p className="text-lg leading-relaxed text-foreground/90">
              {sections.deterministicText}
            </p>
          </section>

          {/* FINANCIAL SUMMARY */}
          <section className="print-section">
            <h2 className="text-2xl font-bold border-b pb-2 mb-6">Financial Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-muted/30 p-6 rounded-lg border">
                <p className="text-muted-foreground text-sm font-medium mb-1">Total Income</p>
                <p className="text-3xl font-bold text-success">{formatReportCurrency(sections.financialSummary.income)}</p>
                <p className="text-xs text-muted-foreground mt-2">{sections.financialSummary.incomeCount} transactions</p>
              </div>
              <div className="bg-muted/30 p-6 rounded-lg border">
                <p className="text-muted-foreground text-sm font-medium mb-1">Total Expenses</p>
                <p className="text-3xl font-bold">{formatReportCurrency(sections.financialSummary.expenses)}</p>
                <p className="text-xs text-muted-foreground mt-2">{sections.financialSummary.expenseCount} transactions</p>
              </div>
              <div className="bg-muted/30 p-6 rounded-lg border">
                <p className="text-muted-foreground text-sm font-medium mb-1">Net Cash Movement</p>
                <p className={`text-3xl font-bold ${summary.netCashMovement >= 0 ? 'text-success' : 'text-risk'}`}>
                  {formatReportCurrency(summary.netCashMovement)}
                </p>
              </div>
            </div>
          </section>

          {/* VENDOR SUMMARY */}
          <section className="print-section print-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-6">Vendor Analysis</h2>
            
            <div className="flex justify-between items-end mb-4">
              <h3 className="text-lg font-semibold">
                {sections.vendorSummary.topVendors.length === 5 ? 'Top 5 Expense Sources' : 'Top Expense Sources'}
              </h3>
              {summary.recurringCommitment > 0 && (
                <div className="text-sm font-medium bg-muted px-3 py-1 rounded-full">
                  Estimated Recurring Commitment: <span className="text-foreground">{formatReportCurrency(summary.recurringCommitment)} /mo</span>
                </div>
              )}
            </div>

            {sections.vendorSummary.topVendors && sections.vendorSummary.topVendors.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 font-medium">Vendor</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium text-right">Total Spend</th>
                      <th className="px-4 py-3 font-medium text-center">Recurring</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sections.vendorSummary.topVendors.map((vendor: any, idx: number) => (
                      <tr key={idx} className="bg-card">
                        <td className="px-4 py-3 font-medium">{vendor.normalized_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{vendor.category || 'Uncategorized'}</td>
                        <td className="px-4 py-3 text-right">{formatReportCurrency(vendor.totalSpend)}</td>
                        <td className="px-4 py-3 text-center">
                          {vendor.is_recurring && <CheckCircle2 className="h-4 w-4 mx-auto text-muted-foreground" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground italic">No expense vendors identified.</p>
            )}
          </section>

          {/* RISK SUMMARY */}
          <section className="print-section print-break-inside-avoid">
            <h2 className="text-2xl font-bold border-b pb-2 mb-6 flex items-center">
              Risk Assessment
              {summary.openRisksCount > 0 && (
                <span className="ml-3 text-xs font-medium bg-risk/10 text-risk px-2 py-1 rounded-full flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {summary.openRisksCount} Open
                </span>
              )}
            </h2>

            {sections.riskSummary.allRisks && sections.riskSummary.allRisks.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 font-medium">Risk Title</th>
                      <th className="px-4 py-3 font-medium">Severity</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Exposure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sections.riskSummary.allRisks.map((risk: any, idx: number) => (
                      <tr key={idx} className="bg-card">
                        <td className="px-4 py-3 font-medium">{risk.title}</td>
                        <td className="px-4 py-3">
                          <span className={`capitalize ${risk.severity === 'high' ? 'text-destructive' : risk.severity === 'medium' ? 'text-risk' : 'text-muted-foreground'}`}>
                            {risk.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{risk.status.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-right">{risk.amount_at_risk ? formatReportCurrency(risk.amount_at_risk) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground italic">
                {sections.riskSummary.totalRisksCount === 0
                  ? 'No risk events have been generated. Run Identify Risks from Risk Inbox.'
                  : 'No risk events detected.'}
              </p>
            )}
          </section>

          {/* NOTES / REVIEW LOG */}
          {sections.noteSummary && sections.noteSummary.length > 0 && (
            <section className="print-section print-break-inside-avoid">
              <h2 className="text-2xl font-bold border-b pb-2 mb-6 flex items-center">
                Review Notes
              </h2>
              <div className="space-y-4">
                {sections.noteSummary.map((note: any, idx: number) => (
                  <div key={idx} className="bg-muted/30 border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium flex items-center text-sm">
                        <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground" />
                        Regarding: {note.relatedRiskTitle}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }).format(new Date(note.created_at))}
                      </div>
                    </div>
                    <p className="text-sm text-foreground/90 pl-6 border-l-2 border-primary/20 ml-2">
                      "{note.text}"
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* DATA QUALITY & CAVEATS */}
          <section className="print-section print-break-inside-avoid text-sm">
            <h2 className="text-xl font-bold border-b pb-2 mb-4">Data Quality & Caveats</h2>
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600/90 dark:text-amber-500 rounded-lg p-5">
              <div className="flex items-start">
                <Info className="h-5 w-5 mr-3 shrink-0 mt-0.5" />
                <ul className="list-disc pl-4 space-y-1">
                  <li>{sections.caveats.importedDataCaveat}</li>
                  {sections.caveats.expenseOnly && (
                    <li>This appears to be an expense-only dataset. Income and net cash calculations may not reflect the complete financial picture.</li>
                  )}
                  {sections.caveats.unknownCount > 0 && (
                    <li>{sections.caveats.unknownCount} transactions could not be reliably classified as income or expense.</li>
                  )}
                  {sections.caveats.missingDates > 0 && (
                    <li>{sections.caveats.missingDates} transactions are missing dates.</li>
                  )}
                  {sections.caveats.missingDescriptions > 0 && (
                    <li>{sections.caveats.missingDescriptions} transactions are missing descriptions.</li>
                  )}
                </ul>
              </div>
            </div>
          </section>

          {/* SOURCE FILES */}
          <section className="print-section print-break-inside-avoid text-sm pt-8 border-t">
            <p className="text-muted-foreground font-medium mb-3">Source Files Included in Report:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {sections.sourceFiles && sections.sourceFiles.length > 0 ? (
                sections.sourceFiles.map((file: any, idx: number) => (
                  <div key={idx} className="bg-muted/50 rounded px-3 py-2 flex items-center truncate">
                    <FileText className="h-3 w-3 mr-2 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs">{file.fileName}</span>
                  </div>
                ))
              ) : (
                <span className="text-muted-foreground italic text-xs">No files recorded</span>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
