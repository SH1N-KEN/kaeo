import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { parseFinancialFile } from '../lib/fileParser';
import { normalizeIngestedRows } from '../lib/ingestion/transactionNormalizer';
import { reconcileTransactions } from '../lib/reconciliation/reconciliationEngine';
import { formatReconciliationReportJSON, formatReconciliationReport } from '../lib/reconciliation/reconciliationReport';

const Reconciliation: React.FC = () => {
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [stripeFile, setStripeFile] = useState<File | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [showTopMatches, setShowTopMatches] = useState(false);

  const bankInputRef = useRef<HTMLInputElement>(null);
  const stripeInputRef = useRef<HTMLInputElement>(null);

  const handleBankUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBankFile(e.target.files[0]);
    }
  };

  const handleStripeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setStripeFile(e.target.files[0]);
    }
  };

  const runReconciliation = async () => {
    if (!bankFile || !stripeFile) return;
    setIsReconciling(true);
    setReport(null);

    try {
      // 1. Parse files
      const bankParsed = await parseFinancialFile(bankFile);
      const stripeParsed = await parseFinancialFile(stripeFile);

      // 2. Normalize
      const bankNorm = normalizeIngestedRows(bankParsed.allRows, bankParsed.suggestedMapping, { provider: bankParsed.provider, currency: 'INR' });
      const stripeNorm = normalizeIngestedRows(stripeParsed.allRows, stripeParsed.suggestedMapping, { provider: stripeParsed.provider, currency: 'INR' });

      // Exclude simple noise from bank (like interest) for better operating comparison
      const operatingBankTxns = bankNorm.transactions.filter(t => !t.description.toLowerCase().includes('interest'));

      // 3. Reconcile
      const rawReport = reconcileTransactions(operatingBankTxns, stripeNorm.transactions, 'processor');
      
      // 4. Format for UI
      const jsonReport = formatReconciliationReportJSON(rawReport);
      setReport({ ...jsonReport, raw: rawReport });
    } catch (err) {
      console.error(err);
      alert('Failed to run reconciliation');
    } finally {
      setIsReconciling(false);
    }
  };

  const downloadReport = () => {
    if (!report?.raw) return;
    const txt = formatReconciliationReport(report.raw);
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation_report_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <PageHeader 
        title="Multi-Source Reconciliation" 
        description="Match transactions across bank statements and payment processors"
      />

      {/* Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bank Upload */}
        <div 
          className="relative border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-muted/30 transition-colors cursor-pointer group bg-card shadow-sm"
          onClick={() => bankInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={bankInputRef} 
            onChange={handleBankUpload} 
            accept=".csv,.xlsx" 
            className="hidden" 
          />
          <div className="w-12 h-12 bg-teal-50 dark:bg-teal-900/20 text-teal-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-medium mb-1">Bank Statement</h3>
          <p className="text-sm text-muted-foreground mb-4">Accepts CSV, XLSX</p>
          {bankFile ? (
            <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-3 py-1.5 rounded-full text-sm font-medium">
              <FileSpreadsheet className="w-4 h-4" />
              {bankFile.name}
            </div>
          ) : (
            <div className="text-sm text-teal-600 font-medium">Click to upload</div>
          )}
        </div>

        {/* Processor Upload */}
        <div 
          className="relative border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-muted/30 transition-colors cursor-pointer group bg-card shadow-sm"
          onClick={() => stripeInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={stripeInputRef} 
            onChange={handleStripeUpload} 
            accept=".csv,.xlsx" 
            className="hidden" 
          />
          <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-medium mb-1">Payment Processor Export</h3>
          <p className="text-sm text-muted-foreground mb-4">Accepts CSV, XLSX (Stripe, PayPal, etc.)</p>
          {stripeFile ? (
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-3 py-1.5 rounded-full text-sm font-medium">
              <FileSpreadsheet className="w-4 h-4" />
              {stripeFile.name}
            </div>
          ) : (
            <div className="text-sm text-orange-600 font-medium">Click to upload</div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex justify-center">
        <button
          onClick={runReconciliation}
          disabled={!bankFile || !stripeFile || isReconciling}
          className={`flex items-center gap-2 px-8 py-3 rounded-lg text-white font-medium transition-all transform hover:scale-105 active:scale-95 shadow-md ${
            !bankFile || !stripeFile ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed shadow-none' : 'bg-teal-600 hover:bg-teal-700'
          }`}
        >
          {isReconciling ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Reconciling...
            </>
          ) : (
            <>
              <ArrowRight className="w-5 h-5" />
              Reconcile
            </>
          )}
        </button>
      </div>

      {/* Results Section */}
      {report && (
        <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
          <div className="border-t border-border pt-8">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-teal-500" />
              Reconciliation Complete
            </h2>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-card rounded-xl p-5 shadow-sm border border-border flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
                <span className="text-sm font-medium text-muted-foreground mb-2">Matched Pairs</span>
                <span className="text-3xl font-bold text-teal-600 dark:text-teal-400">{report.summary?.matchedBankTxnsCount}</span>
              </div>
              <div className="bg-card rounded-xl p-5 shadow-sm border border-border flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-teal-500" />
                <span className="text-sm font-medium text-muted-foreground mb-2">Match Rate</span>
                <span className="text-3xl font-bold text-teal-600 dark:text-teal-400">{report.summary?.matchRate}%</span>
              </div>
              <div className="bg-card rounded-xl p-5 shadow-sm border border-border flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                <span className="text-sm font-medium text-muted-foreground mb-2">Unmatched Processor</span>
                <span className="text-3xl font-bold text-orange-600 dark:text-orange-500">{report.summary?.unmatchedStripeTxnsCount}</span>
              </div>
              <div className="bg-card rounded-xl p-5 shadow-sm border border-border flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gray-400" />
                <span className="text-sm font-medium text-muted-foreground mb-2">Unmatched Bank</span>
                <span className="text-3xl font-bold text-gray-700 dark:text-gray-300">{report.summary?.unmatchedBankTxnsCount}</span>
              </div>
            </div>

            {/* Unmatched Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Left: Processor */}
              <div className="bg-orange-50/50 dark:bg-orange-950/20 rounded-xl border border-orange-200 dark:border-orange-900 overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-orange-100/50 dark:bg-orange-900/40 border-b border-orange-200 dark:border-orange-900 font-medium text-orange-800 dark:text-orange-400 flex items-center justify-between">
                  <span>Unmatched Processor Transactions</span>
                  <span className="bg-orange-200 dark:bg-orange-800 text-xs px-2 py-1 rounded-full">{report.summary?.unmatchedStripeTxnsCount}</span>
                </div>
                <div className="p-0 overflow-y-auto max-h-80">
                  {(report.unmatchedStripeTxns?.length ?? 0) === 0 ? (
                    <div className="p-4 text-sm text-orange-600 text-center italic">All processor transactions matched!</div>
                  ) : (
                    <ul className="divide-y divide-orange-200/50 dark:divide-orange-900/50">
                      {report.unmatchedStripeTxns?.map((t: any, i: number) => (
                        <li key={i} className="p-3 text-sm flex items-center gap-3 hover:bg-orange-100/30 dark:hover:bg-orange-900/20 transition-colors">
                          <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <div className="font-semibold text-orange-700 dark:text-orange-300 w-20">₹{t.amount}</div>
                          <div className="flex-1 truncate font-medium text-gray-800 dark:text-gray-200">{t.description}</div>
                          <div className="text-xs text-orange-600 dark:text-orange-400">{t.date}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Right: Bank */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-border font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span>Unmatched Bank Transactions</span>
                  <span className="bg-gray-200 dark:bg-gray-700 text-xs px-2 py-1 rounded-full text-gray-800 dark:text-gray-200">{report.summary?.unmatchedBankTxnsCount}</span>
                </div>
                <div className="p-0 overflow-y-auto max-h-80">
                  {(report.unmatchedBankTxns?.length ?? 0) === 0 ? (
                    <div className="p-4 text-sm text-gray-500 text-center italic">All bank transactions matched!</div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {report.unmatchedBankTxns?.map((t: any, i: number) => (
                        <li key={i} className="p-3 text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors">
                          <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                          <div className="flex-1 truncate font-medium text-gray-700 dark:text-gray-300">{t.description}</div>
                          <div className="font-semibold text-gray-600 dark:text-gray-400">₹{t.amount}</div>
                          <div className="text-xs text-muted-foreground">{t.date}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Matched Pairs (Collapsible) */}
            <div className="bg-card border border-border rounded-xl shadow-sm mb-8 overflow-hidden">
              <button 
                onClick={() => setShowTopMatches(!showTopMatches)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <div className="font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                  Matched Pairs ({report.matches?.length ?? 0})
                </div>
                {showTopMatches ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
              </button>
              
              {showTopMatches && (
                <div className="border-t border-border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                        <tr>
                          <th className="px-5 py-3 text-left">Confidence</th>
                          <th className="px-5 py-3 text-left">Merchant</th>
                          <th className="px-5 py-3 text-right">Amount</th>
                          <th className="px-5 py-3 text-right">Bank Date → Processor Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {report.matches?.slice(0, 10).map((m: any, i: number) => (
                          <tr key={i} className="hover:bg-muted/20 transition-colors">
                            <td className="px-5 py-3">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                m.confidence >= 90 ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                                m.confidence >= 70 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              }`}>
                                {m.confidence}%
                              </span>
                            </td>
                            <td className="px-5 py-3 font-medium text-foreground max-w-[200px] truncate" title={m.bankDescription}>
                              {m.bankDescription}
                            </td>
                            <td className="px-5 py-3 text-right font-semibold">₹{m.amount}</td>
                            <td className="px-5 py-3 text-right text-muted-foreground flex justify-end items-center gap-2">
                              {m.bankDate} <ArrowRight className="w-3 h-3" /> {m.stripeDate}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(report.matches?.length ?? 0) > 10 && (
                    <div className="px-5 py-3 text-center text-xs text-muted-foreground bg-muted/20 border-t border-border">
                      Showing top 10 matches. Export report to see all {report.matches?.length ?? 0} pairs.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Export Button */}
            <div className="flex justify-end">
              <button 
                onClick={downloadReport}
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export Reconciliation Report (TXT)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reconciliation;
