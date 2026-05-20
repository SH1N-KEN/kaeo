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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
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
          className="bg-foreground text-background px-4 py-2 rounded-md font-semibold text-xs cursor-pointer hover:opacity-90 transition-all"
        >
          Back to Reports
        </button>
      </div>
    );
  }

  const { sections_json: sections, summary_json: summary } = report;

  return (
    <div className="pb-24 print:pb-0 print:block">
      {/* Screen only top bar */}
      <div className="print:hidden max-w-5xl mx-auto mb-6 flex justify-between items-center">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Reports
        </button>
        <button
          onClick={handlePrint}
          className="bg-foreground text-background px-4 py-2 rounded-md flex items-center font-semibold shadow-sm hover:opacity-90 transition-colors text-xs cursor-pointer"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print / Save as PDF
        </button>
      </div>

      {/* The Printable Report Container */}
      <div className="print-container bg-card md:border rounded-xl shadow-none max-w-5xl mx-auto overflow-hidden print:overflow-visible border-border">
        
        {/* HEADER */}
        <div className="p-8 md:p-12 border-b border-border">
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
              <p className="font-medium text-foreground">{summary.period}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase text-xs font-semibold tracking-wider mb-1">Generated</p>
              <p className="font-medium text-foreground">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(report.created_at))}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase text-xs font-semibold tracking-wider mb-1">Transactions</p>
              <p className="font-medium text-foreground">{summary.transactionCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground uppercase text-xs font-semibold tracking-wider mb-1">Net Cash</p>
              <p className={`font-medium ${summary.netCashMovement >= 0 ? 'text-success' : 'text-risk'}`}>
                {formatReportCurrency(summary.netCashMovement)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-12 space-y-12 print-content print:block print:space-y-0">
          
          {/* EXECUTIVE SUMMARY */}
          <section className="print-section print:break-inside-avoid">
            <h2 className="text-2xl font-bold border-b border-border pb-2 mb-4">Executive Summary</h2>
            <p className="text-lg leading-relaxed text-foreground/90 font-medium">
              {sections.deterministicText}
            </p>
          </section>

          {/* FINANCIAL SUMMARY */}
          <section className="print-section print:break-inside-avoid">
            <h2 className="text-2xl font-bold border-b border-border pb-2 mb-6">Financial Summary</h2>
            <div className={`grid grid-cols-1 md:${sections.financialSummary.refunds > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-6`}>
              <div className="bg-muted/30 p-6 rounded-xl border border-border">
                <p className="text-muted-foreground text-sm font-medium mb-1">Total Income</p>
                <p className="text-3xl font-bold text-success">{formatReportCurrency(sections.financialSummary.income)}</p>
                <p className="text-xs text-muted-foreground mt-2">{sections.financialSummary.incomeCount} transactions</p>
              </div>
              {sections.financialSummary.refunds > 0 && (
                <div className="bg-muted/30 p-6 rounded-xl border border-border">
                  <p className="text-muted-foreground text-sm font-medium mb-1">Refunds / Recoveries</p>
                  <p className="text-3xl font-bold text-success">{formatReportCurrency(sections.financialSummary.refunds)}</p>
                  <p className="text-xs text-muted-foreground mt-2">{sections.financialSummary.refundCount || 0} transactions</p>
                </div>
              )}
              <div className="bg-muted/30 p-6 rounded-xl border border-border">
                <p className="text-muted-foreground text-sm font-medium mb-1">Total Expenses</p>
                <p className="text-3xl font-bold text-foreground">{formatReportCurrency(sections.financialSummary.expenses)}</p>
                <p className="text-xs text-muted-foreground mt-2">{sections.financialSummary.expenseCount} transactions</p>
              </div>
              <div className="bg-muted/30 p-6 rounded-xl border border-border">
                <p className="text-muted-foreground text-sm font-medium mb-1">Net Cash Movement</p>
                <p className={`text-3xl font-bold ${summary.netCashMovement >= 0 ? 'text-success' : 'text-risk'}`}>
                  {formatReportCurrency(summary.netCashMovement)}
                </p>
              </div>
            </div>
          </section>

          {/* VENDOR SUMMARY */}
          <section className="print-section print:break-inside-auto">
            <h2 className="text-2xl font-bold border-b border-border pb-2 mb-6">Vendor Analysis</h2>
            
            <div className="flex justify-between items-end mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                {sections.vendorSummary.topVendors.length === 5 ? 'Top 5 Expense Sources' : 'Top Expense Sources'}
              </h3>
              {summary.recurringCommitment > 0 && (
                <div className="text-xs font-bold bg-muted px-3 py-1.5 rounded-md border border-border text-muted-foreground uppercase tracking-wider">
                  Recurring Commitment: <span className="text-foreground">{formatReportCurrency(summary.recurringCommitment)} /mo</span>
                </div>
              )}
            </div>

            {sections.vendorSummary.topVendors && sections.vendorSummary.topVendors.length > 0 ? (
              <div className="border border-border rounded-xl overflow-hidden print:overflow-visible">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-black tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Vendor</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold text-right">Total Spend</th>
                      <th className="px-4 py-3 font-semibold text-center">Recurring</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sections.vendorSummary.topVendors.map((vendor: any, idx: number) => (
                      <tr key={idx} className="bg-card">
                        <td className="px-4 py-3 font-bold text-foreground">{vendor.normalized_name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-medium">{vendor.category || 'Uncategorized'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">{formatReportCurrency(vendor.totalSpend)}</td>
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
          <section className="print-section print:break-inside-auto print:break-before-page">
            <h2 className="text-2xl font-bold border-b border-border pb-2 mb-6 flex items-center">
              Risk Assessment
              {summary.openRisksCount > 0 && (
                <span className="ml-3 text-xs font-bold bg-risk/10 text-risk px-2.5 py-1 rounded-md border border-risk/20 flex items-center uppercase tracking-wider">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {summary.openRisksCount} Open
                </span>
              )}
            </h2>

            {sections.riskSummary.allRisks && sections.riskSummary.allRisks.length > 0 ? (
              <div className="border border-border rounded-xl overflow-hidden print:overflow-visible">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-black tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Risk Title</th>
                      <th className="px-4 py-3 font-semibold">Severity</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Exposure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sections.riskSummary.allRisks.map((risk: any, idx: number) => (
                      <tr key={idx} className="bg-card">
                        <td className="px-4 py-3 font-bold text-foreground">{risk.title}</td>
                        <td className="px-4 py-3">
                          <span className={`capitalize font-bold text-xs ${risk.severity === 'high' || risk.severity === 'critical' ? 'text-rose-500' : risk.severity === 'medium' ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            {risk.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground font-medium">{risk.status.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">{risk.amount_at_risk ? formatReportCurrency(risk.amount_at_risk) : '-'}</td>
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
            <section className="print-section print:break-inside-auto">
              <h2 className="text-2xl font-bold border-b border-border pb-2 mb-6 flex items-center">
                Review Notes
              </h2>
              <div className="space-y-4">
                {sections.noteSummary.map((note: any, idx: number) => (
                  <div key={idx} className="bg-muted/30 border border-border rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold flex items-center text-sm text-foreground">
                        <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground" />
                        Regarding: {note.relatedRiskTitle}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">
                        {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }).format(new Date(note.created_at))}
                      </div>
                    </div>
                    <p className="text-sm text-foreground/95 pl-6 border-l-2 border-border ml-2 leading-relaxed font-medium">
                      "{note.text}"
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* DATA QUALITY & CAVEATS */}
          <section className="print-section print:break-inside-avoid text-sm">
            <h2 className="text-xl font-bold border-b border-border pb-2 mb-4">Data Quality & Caveats</h2>
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600/90 dark:text-amber-500 rounded-xl p-5">
              <div className="flex items-start">
                <Info className="h-5 w-5 mr-3 shrink-0 mt-0.5" />
                <ul className="list-disc pl-4 space-y-1 font-medium">
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
          <section className="print-section print:break-before-page print:break-inside-auto text-sm pt-8 border-t border-border print:border-t-0 print:pt-0">
            <p className="text-muted-foreground font-medium mb-3">Source Files Included in Report:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {sections.sourceFiles && sections.sourceFiles.length > 0 ? (
                sections.sourceFiles.map((file: any, idx: number) => (
                  <div key={idx} className="bg-muted/50 rounded-md px-3 py-2 flex items-center truncate border border-border/40">
                    <FileText className="h-3 w-3 mr-2 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs text-foreground font-semibold">{file.fileName}</span>
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
