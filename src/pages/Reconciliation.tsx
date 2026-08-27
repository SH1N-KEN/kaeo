import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  XCircle,
  Clock,
  RefreshCw,
  History
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { parseFinancialFile } from '../lib/fileParser';
import { normalizeIngestedRows } from '../lib/ingestion/transactionNormalizer';
import { reconcileTransactionsPipeline } from '../lib/reconciliation/reconciliationEngine';
import type { ReconciliationRunResult, ReconciliationRecord } from '../types/reconciliation';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import {
  createReconciliationRun,
  getLatestReconciliationRun,
  listReconciliationRuns,
  getReconciliationRecords,
  getReconciliationRun,
  reconstructReconciliationResult
} from '../lib/reconciliation/reconciliationRepository';
import type { ReconciliationRunDb } from '../lib/reconciliation/reconciliationRepository';

const Reconciliation: React.FC = () => {
  const { activeOrg, activeClient, loading: workspaceLoading } = useWorkspace();

  const [bankFile, setBankFile] = useState<File | null>(null);
  const [processorFile, setProcessorFile] = useState<File | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReconciliationRunResult | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const [historyRuns, setHistoryRuns] = useState<ReconciliationRunDb[]>([]);
  const [isLoadingLatest, setIsLoadingLatest] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [loadedRun, setLoadedRun] = useState<ReconciliationRunDb | null>(null);

  const bankInputRef = useRef<HTMLInputElement>(null);
  const processorInputRef = useRef<HTMLInputElement>(null);

  // Load latest run and history list when activeOrg/activeClient changes
  useEffect(() => {
    const fetchLatestAndHistory = async () => {
      if (!activeOrg) return;
      setIsLoadingLatest(true);
      setError(null);
      try {
        // Fetch history list
        const runs = await listReconciliationRuns(activeOrg.id, activeClient?.id || null);
        setHistoryRuns(runs);

        // Fetch latest run
        const latest = await getLatestReconciliationRun(activeOrg.id, activeClient?.id || null);
        if (latest) {
          const records = await getReconciliationRecords(latest.id);
          const reconResult = reconstructReconciliationResult(latest, records);
          setResult(reconResult);
          setActiveRunId(latest.id);
          setLoadedRun(latest);
        } else {
          setResult(null);
          setActiveRunId(null);
          setLoadedRun(null);
        }
      } catch (err: any) {
        console.error('Error loading latest run:', err);
        setError('Failed to restore latest reconciliation run.');
      } finally {
        setIsLoadingLatest(false);
      }
    };

    fetchLatestAndHistory();
  }, [activeOrg?.id, activeClient?.id]);

  const loadHistoricalRun = async (runId: string) => {
    setIsLoadingLatest(true);
    setError(null);
    try {
      const run = await getReconciliationRun(runId);
      const records = await getReconciliationRecords(runId);
      const reconResult = reconstructReconciliationResult(run, records);
      setResult(reconResult);
      setActiveRunId(runId);
      setLoadedRun(run);
    } catch (err: any) {
      console.error('Error loading historical run:', err);
      setError('Failed to load historical run.');
    } finally {
      setIsLoadingLatest(false);
    }
  };

  const handleBankUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      setBankFile(e.target.files[0]);
    }
  };

  const handleProcessorUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      setProcessorFile(e.target.files[0]);
    }
  };

  const runReconciliation = async () => {
    if (!bankFile || !processorFile || !activeOrg) return;
    setIsReconciling(true);
    setResult(null);
    setError(null);
    setLoadedRun(null);
    setActiveRunId(null);

    try {
      // 1. Parse files
      const bankParsed = await parseFinancialFile(bankFile);
      const processorParsed = await parseFinancialFile(processorFile);

      if (bankParsed.allRows.length === 0 || processorParsed.allRows.length === 0) {
        throw new Error('One or both files are empty.');
      }

      // 2. Normalize
      const bankNorm = normalizeIngestedRows(bankParsed.allRows, bankParsed.suggestedMapping, { provider: bankParsed.provider, currency: 'INR' });
      const processorNorm = normalizeIngestedRows(processorParsed.allRows, processorParsed.suggestedMapping, { provider: processorParsed.provider, currency: 'INR' });

      // 3. Reconcile Pipeline
      const runResult = await reconcileTransactionsPipeline(bankNorm.transactions, processorNorm.transactions);

      // 4. Save metadata to uploaded_files (to get UUIDs)
      let bankFileId: string | null = null;
      try {
        const { data: bankFileData, error: bankFileErr } = await supabase
          .from('uploaded_files')
          .insert({
            organization_id: activeOrg.id,
            client_id: activeClient?.id || null,
            file_name: bankFile.name,
            file_type: bankFile.name.split('.').pop() || 'csv',
            file_size: bankFile.size,
            storage_path: `simulated/${bankFile.name}`,
            status: 'parsed',
            metadata: {
              row_count: bankParsed.allRows.length,
              provider_detected: bankParsed.provider
            }
          })
          .select()
          .single();
        if (bankFileErr) throw bankFileErr;
        if (bankFileData) bankFileId = bankFileData.id;
      } catch (err) {
        console.error('Failed to register bank file in uploaded_files:', err);
      }

      let processorFileId: string | null = null;
      try {
        const { data: procFileData, error: procFileErr } = await supabase
          .from('uploaded_files')
          .insert({
            organization_id: activeOrg.id,
            client_id: activeClient?.id || null,
            file_name: processorFile.name,
            file_type: processorFile.name.split('.').pop() || 'csv',
            file_size: processorFile.size,
            storage_path: `simulated/${processorFile.name}`,
            status: 'parsed',
            metadata: {
              row_count: processorParsed.allRows.length,
              provider_detected: processorParsed.provider
            }
          })
          .select()
          .single();
        if (procFileErr) throw procFileErr;
        if (procFileData) processorFileId = procFileData.id;
      } catch (err) {
        console.error('Failed to register processor file in uploaded_files:', err);
      }

      // 5. Persist run atomically
      const sourceMetadata = {
        bank_file_name: bankFile.name,
        processor_file_name: processorFile.name,
        bank_file_size: bankFile.size,
        processor_file_size: processorFile.size,
        bank_row_count: bankParsed.allRows.length,
        processor_row_count: processorParsed.allRows.length
      };

      const newRunId = await createReconciliationRun(
        activeOrg.id,
        activeClient?.id || null,
        bankFileId,
        processorFileId,
        runResult.summary,
        runResult.results,
        sourceMetadata
      );

      // 6. Fetch full persisted run info
      const runDetails = await getReconciliationRun(newRunId);

      // 7. Update UI State
      setResult(runResult);
      setActiveRunId(newRunId);
      setLoadedRun(runDetails);

      // 8. Refresh runs list history
      const runs = await listReconciliationRuns(activeOrg.id, activeClient?.id || null);
      setHistoryRuns(runs);

      console.log("RECON REPORT:", JSON.stringify(runResult, null, 2));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during reconciliation.');
    } finally {
      setIsReconciling(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    const txt = JSON.stringify(result, null, 2);
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation_report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'MATCHED': return <span className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"><Check className="w-3 h-3" /> Reconciled</span>;
      case 'REVIEW': return <span className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Attention Required</span>;
      case 'UNRESOLVED': return <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"><XCircle className="w-3 h-3" /> Unresolved Exception</span>;
      case 'PENDING': return <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Pending Payout</span>;
      case 'PROCESSING': return <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Processing</span>;
      case 'CHARGEBACK': return <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Chargeback Exception</span>;
      case 'DUPLICATE': return <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Duplicate Record</span>;
      case 'REFUND': return <span className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Refund Event</span>;
      case 'OUT_OF_SCOPE': return <span className="bg-gray-100 text-gray-650 dark:bg-gray-850 dark:text-gray-400 px-2 py-1 rounded-full text-xs font-medium">Out of Scope</span>;
      default: return <span className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 px-2 py-1 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  const getAmountStr = (r: ReconciliationRecord | undefined) => {
    if (!r || !r.transaction || r.transaction.amount === 0) return '---';
    return `₹${Math.abs(r.transaction.amount || 0).toLocaleString()}`;
  };

  const getDateStr = (r: ReconciliationRecord | undefined) => {
    if (!r || !r.transaction) return '---';
    return r.transaction.transaction_date || '---';
  };

  if (workspaceLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Reconciliation Control"
        description="Dual-source ledger matching and settlement verification"
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {isLoadingLatest && !result ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Restoring latest reconciliation run...</p>
        </div>
      ) : (
        <>
          {!result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                className="relative border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-muted/30 transition-colors cursor-pointer group bg-card shadow-sm"
                onClick={() => bankInputRef.current?.click()}
              >
                <input type="file" ref={bankInputRef} onChange={handleBankUpload} accept=".csv,.xlsx" className="hidden" />
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-medium mb-1">Bank Statement</h3>
                {bankFile ? (
                  <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 px-3 py-1.5 rounded-full text-sm font-medium mt-2">
                    <FileSpreadsheet className="w-4 h-4" /> {bankFile.name}
                  </div>
                ) : <p className="text-sm text-muted-foreground mt-2">Click to upload bank ledger (CSV, XLSX)</p>}
              </div>

              <div
                className="relative border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-muted/30 transition-colors cursor-pointer group bg-card shadow-sm"
                onClick={() => processorInputRef.current?.click()}
              >
                <input type="file" ref={processorInputRef} onChange={handleProcessorUpload} accept=".csv,.xlsx" className="hidden" />
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-medium mb-1">Payment Processor Export</h3>
                {processorFile ? (
                  <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 px-3 py-1.5 rounded-full text-sm font-medium mt-2">
                    <FileSpreadsheet className="w-4 h-4" /> {processorFile.name}
                  </div>
                ) : <p className="text-sm text-muted-foreground mt-2">Click to upload processor ledger (CSV, XLSX)</p>}
              </div>
            </div>
          )}

          {!result && (
            <div className="flex justify-center">
              <button
                onClick={runReconciliation}
                disabled={!bankFile || !processorFile || isReconciling}
                className={`flex items-center gap-2 px-8 py-3 rounded-lg text-white font-medium transition-all transform hover:scale-105 active:scale-95 shadow-md ${!bankFile || !processorFile ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed shadow-none' : 'bg-gray-900 dark:bg-gray-100 dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200'
                  }`}
              >
                {isReconciling ? <><Loader2 className="w-5 h-5 animate-spin" /> Running Control...</> : <><ArrowRight className="w-5 h-5" /> Run Reconciliation Pipeline</>}
              </button>
            </div>
          )}

          {result && (
            <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">

              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-teal-500" />
                    Reconciliation Complete
                  </h2>
                  {loadedRun && (
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Last run:{' '}
                        {new Date(loadedRun.created_at).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}{' '}
                        ·{' '}
                        {new Date(loadedRun.created_at).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span>
                        Sources: {loadedRun.source_metadata?.bank_file_name || 'N/A'} ·{' '}
                        {loadedRun.source_metadata?.processor_file_name || 'N/A'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setResult(null);
                      setBankFile(null);
                      setProcessorFile(null);
                      setLoadedRun(null);
                      setActiveRunId(null);
                    }}
                    className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    Start New
                  </button>
                  <button onClick={downloadReport} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
                    <Download className="w-4 h-4" /> Export Report (JSON)
                  </button>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card rounded-xl p-5 shadow-sm border border-border flex flex-col justify-between">
                  <span className="text-sm font-medium text-muted-foreground mb-2">Reconciled Value</span>
                  <span className="text-3xl font-bold text-foreground">₹{result.summary.reconciledValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="bg-card rounded-xl p-5 shadow-sm border border-border flex flex-col justify-between">
                  <span className="text-sm font-medium text-muted-foreground mb-2">Eligible Settlements</span>
                  <span className="text-3xl font-bold text-foreground">{result.summary.matchedSettlementCount} / {result.summary.eligibleSettlementCount}</span>
                </div>
                <div className="bg-card rounded-xl p-5 shadow-sm border border-border flex flex-col justify-between">
                  <span className="text-sm font-medium text-muted-foreground mb-2">Unresolved Discrepancies</span>
                  <span className={`text-3xl font-bold ${result.summary.unresolvedExposure > 0 ? 'text-red-500' : 'text-teal-500'}`}>₹{result.summary.unresolvedExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="bg-card rounded-xl p-5 shadow-sm border border-border flex flex-col justify-between">
                  <span className="text-sm font-medium text-muted-foreground mb-2">Eligible Match Rate</span>
                  <span className="text-3xl font-bold text-foreground">{result.summary.matchRate.toFixed(1)}%</span>
                </div>
              </div>

              {/* Reconciliation Ledger Distribution */}
              <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Reconciliation Ledger Distribution</h3>
                <div className="w-full h-4 bg-muted rounded-full overflow-hidden flex mb-4">
                  <div className="h-full bg-teal-500" style={{ width: `${(result.summary.matchedSettlementCount / result.summary.processorTotal) * 100}%` }}></div>
                  <div className="h-full bg-yellow-500" style={{ width: `${(result.summary.reviewCount / result.summary.processorTotal) * 100}%` }}></div>
                  <div className="h-full bg-orange-500" style={{ width: `${(result.summary.unresolvedSettlementCount / result.summary.processorTotal) * 100}%` }}></div>
                  <div className="h-full bg-blue-500" style={{ width: `${(result.summary.pendingCount / result.summary.processorTotal) * 100}%` }}></div>
                  <div className="h-full bg-purple-500" style={{ width: `${(result.summary.duplicateCount / result.summary.processorTotal) * 100}%` }}></div>
                </div>
                <div className="flex flex-wrap gap-6 text-sm font-medium">
                  <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-teal-500"></div> {result.summary.matchedSettlementCount} Reconciled</span>
                  <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> {result.summary.reviewCount} Under Review</span>
                  <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-orange-500"></div> {result.summary.unresolvedSettlementCount} Exceptions</span>
                  <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500"></div> {result.summary.pendingCount} Pending / Excluded</span>
                  <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-500"></div> {result.summary.duplicateCount} Duplicates</span>
                </div>
              </div>

              {/* Attention Required */}
              {(result.summary.reviewCount > 0 || result.summary.unresolvedCount > 0 || result.summary.duplicateCount > 0) && (
                <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-orange-800 dark:text-orange-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" /> Exceptions requiring attention
                  </h3>
                  <div className="space-y-3">
                    {result.results.filter(r => r.decision.status === 'REVIEW' || r.decision.status === 'UNRESOLVED' || r.decision.status === 'DUPLICATE').slice(0, 8).map((r, i) => (
                      <div key={i} className="flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-lg border border-orange-100 dark:border-orange-850 shadow-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-foreground">
                            {r.processorRecord?.transaction?.description || 'Missing Processor Record'}
                          </span>
                          <span className="text-xs text-muted-foreground">{r.decision.reason}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-semibold text-sm">
                            {r.bankRecord ? getAmountStr(r.bankRecord) : getAmountStr(r.processorRecord)}
                          </span>
                          {renderStatusBadge(r.decision.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payouts & Settlement Results */}
              {(() => {
                const auditResults = result.results.filter(r => r.decision.status !== 'OUT_OF_SCOPE');
                return (
                  <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-border font-semibold flex items-center justify-between bg-muted/20">
                      <span>Settlement Audit Log ({auditResults.length} records processed)</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold border-b border-border">
                          <tr>
                            <th className="px-5 py-3 text-left">Status</th>
                            <th className="px-5 py-3 text-left">Bank description</th>
                            <th className="px-5 py-3 text-right">Settlement Amt (Processor)</th>
                            <th className="px-5 py-3 text-right">Bank Amt (Ledger)</th>
                            <th className="px-5 py-3 text-right">Date</th>
                            <th className="px-5 py-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {auditResults.map((res, i) => (
                            <React.Fragment key={i}>
                              <tr 
                                className="hover:bg-muted/10 transition-colors cursor-pointer" 
                                onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                              >
                                <td className="px-5 py-3">{renderStatusBadge(res.decision.status)}</td>
                                <td className="px-5 py-3 font-medium text-foreground max-w-[200px] truncate" title={res.bankRecord?.transaction?.description || res.processorRecord?.transaction?.description}>
                                  {res.bankRecord?.transaction?.description || res.processorRecord?.transaction?.description || 'Missing Ledger Item'}
                                </td>
                                <td className="px-5 py-3 text-right font-semibold text-foreground">{getAmountStr(res.processorRecord)}</td>
                                <td className="px-5 py-3 text-right font-semibold text-muted-foreground">{getAmountStr(res.bankRecord)}</td>
                                <td className="px-5 py-3 text-right text-muted-foreground">
                                  {res.bankRecord ? getDateStr(res.bankRecord) : getDateStr(res.processorRecord)}
                                </td>
                                <td className="px-5 py-3 text-right">
                                  {expandedRow === i ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                </td>
                              </tr>
                              {expandedRow === i && (
                                <tr className="bg-muted/5">
                                  <td colSpan={6} className="px-5 py-6">
                                    <div className="flex flex-col md:flex-row gap-8 items-start justify-center max-w-4xl mx-auto">
                                      {/* Processor Side */}
                                      <div className="flex-1 bg-white dark:bg-gray-900 border border-border p-4 rounded-lg w-full shadow-xs">
                                        <div className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wider">Processor Ledger Entry</div>
                                        <div className="text-2xl font-bold mb-1">{getAmountStr(res.processorRecord)}</div>
                                        <div className="text-xs text-muted-foreground mb-4">Date: {getDateStr(res.processorRecord)}</div>
                                        <div className="text-sm break-all font-mono bg-muted/40 p-2.5 rounded border border-border">{res.processorRecord?.transaction?.description || 'No matching record'}</div>
                                      </div>

                                      <div className="flex flex-col items-center justify-center pt-8">
                                        <ArrowRight className="w-6 h-6 text-muted-foreground hidden md:block" />
                                        {res.decision.evidence.confidenceScore > 0 ? (
                                          <div className="text-xs text-teal-600 dark:text-teal-400 font-bold mt-2">{res.decision.evidence.confidenceScore}% Match</div>
                                        ) : (
                                          <div className="text-xs text-muted-foreground font-bold mt-2">Unmatched</div>
                                        )}
                                      </div>

                                      {/* Bank Side */}
                                      <div className="flex-1 bg-white dark:bg-gray-900 border border-border p-4 rounded-lg w-full shadow-xs">
                                        <div className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wider">Bank Statement Payout</div>
                                        {res.bankRecord ? (
                                          <>
                                            <div className="text-2xl font-bold mb-1">{getAmountStr(res.bankRecord)}</div>
                                            <div className="text-xs text-muted-foreground mb-4">Date: {getDateStr(res.bankRecord)}</div>
                                            <div className="text-sm break-all font-mono bg-muted/40 p-2.5 rounded border border-border">{res.bankRecord.transaction.description}</div>
                                          </>
                                        ) : (
                                          <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic py-8 bg-muted/20 border border-dashed border-border rounded">No bank ledger entry found</div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Evidence / Audit Trail */}
                                    <div className="max-w-4xl mx-auto mt-6 bg-white dark:bg-gray-900 border border-border rounded-lg p-5 shadow-xs">
                                      <div className="text-xs text-muted-foreground font-semibold mb-3 uppercase tracking-wider">Audit Evidence Trail</div>
                                      <div className="grid grid-cols-2 gap-4 text-sm mb-4 border-b border-border pb-3">
                                        <div><span className="text-muted-foreground font-medium">Ledger Status:</span> <span className="font-semibold text-foreground">{res.decision.status}</span></div>
                                        <div><span className="text-muted-foreground font-medium">Reconciled Amount:</span> {res.decision.evidence.amountExact ? 'Exact Match' : `Variance ₹${res.decision.evidence.amountDifference.toFixed(2)}`}</div>
                                        <div><span className="text-muted-foreground font-medium">Settlement Date:</span> {res.decision.evidence.dateWithinWindow ? 'Within Control Window' : 'Variance Outside Window'}</div>
                                        <div><span className="text-muted-foreground font-medium">Audit Outcome:</span> <span className="font-semibold text-foreground">{res.decision.reason}</span></div>
                                      </div>
                                      <div className="text-xs text-muted-foreground space-y-1.5 bg-gray-50 dark:bg-gray-950 p-4 rounded border border-border font-mono max-h-40 overflow-y-auto">
                                        {res.auditTrail.map((log, idx) => (
                                          <div key={idx} className="flex gap-2">
                                            <span className="text-teal-600 font-bold">»</span>
                                            <span>{log}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Out of Scope Activity */}
              {result.outOfScopeBankTxns.length > 0 && (
                <div className="bg-muted/20 border border-border rounded-xl p-5 flex items-center justify-between shadow-xs">
                  <div>
                    <h3 className="font-semibold text-foreground">Non-Processor Bank Activity (Out of Scope)</h3>
                    <p className="text-sm text-muted-foreground">{result.summary.outOfScopeCount} bank ledger items outside current matching scope (e.g. general operating expenses, interest, unrelated transfers)</p>
                  </div>
                  <button 
                    onClick={() => setExpandedRow(expandedRow === -1 ? null : -1)}
                    className="text-sm font-semibold px-4 py-2 bg-white dark:bg-gray-800 border border-border rounded-lg shadow-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {expandedRow === -1 ? 'Hide Activity' : 'View Ledger Items'}
                  </button>
                </div>
              )}

              {expandedRow === -1 && result.outOfScopeBankTxns.length > 0 && (
                <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                        <tr>
                          <th className="px-5 py-3 text-left">Description</th>
                          <th className="px-5 py-3 text-right">Amount</th>
                          <th className="px-5 py-3 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {result.outOfScopeBankTxns.map((t, idx) => (
                          <tr key={idx} className="hover:bg-muted/10 transition-colors">
                            <td className="px-5 py-3 font-mono text-muted-foreground">{t.description}</td>
                            <td className="px-5 py-3 text-right font-semibold text-foreground">₹{Math.abs(t.amount || 0).toLocaleString()}</td>
                            <td className="px-5 py-3 text-right text-muted-foreground">{t.transaction_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Reconciliation Run History Section */}
          {historyRuns.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4 mt-8">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <History className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground">Reconciliation Run History</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historyRuns.map((run) => {
                  const isActive = activeRunId === run.id;
                  const runDate = new Date(run.created_at);
                  const formattedDate = runDate.toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  }) + ' · ' + runDate.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  
                  const summary = run.summary || {};
                  const reconciledVal = summary.reconciledValue || 0;
                  const eligibleCount = summary.eligibleSettlementCount ?? summary.eligibleProcessorRecords ?? 0;
                  const matchedCount = summary.matchedSettlementCount ?? summary.matchedSettlementCount ?? 0;
                  const matchRate = summary.matchRate || 0;
                  const unresolvedExp = summary.unresolvedExposure ?? summary.difference ?? 0;

                  return (
                    <div
                      key={run.id}
                      onClick={() => loadHistoricalRun(run.id)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all hover:bg-muted/30 flex flex-col justify-between space-y-2 bg-card ${
                        isActive
                          ? 'border-teal-500 ring-1 ring-teal-500 bg-teal-500/5'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-muted-foreground">{formattedDate}</span>
                        {isActive && (
                          <span className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 px-2 py-0.5 rounded text-[10px] font-bold">Active</span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                        <div>
                          <span className="text-muted-foreground">Reconciled:</span>{' '}
                          <span className="font-semibold text-foreground">₹{reconciledVal.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Settlements:</span>{' '}
                          <span className="font-semibold text-foreground">{matchedCount} / {eligibleCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Match Rate:</span>{' '}
                          <span className="font-semibold text-foreground">{matchRate.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Unresolved Exposure:</span>{' '}
                          <span className={`font-semibold ${unresolvedExp > 0 ? 'text-red-500' : 'text-teal-500'}`}>
                            ₹{unresolvedExp.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="text-[10px] text-muted-foreground truncate border-t border-border/50 pt-1.5 mt-1 flex justify-between">
                        <span className="truncate mr-2">Bank: {run.source_metadata?.bank_file_name || 'N/A'}</span>
                        <span className="truncate">Proc: {run.source_metadata?.processor_file_name || 'N/A'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reconciliation;
