import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  History
} from 'lucide-react';
import { parseFinancialFile } from '../lib/fileParser';
import { normalizeIngestedRows } from '../lib/ingestion/transactionNormalizer';
import { reconcileTransactionsPipeline } from '../lib/reconciliation/reconciliationEngine';
import type { ReconciliationRunResult, ReconciliationRecord, ReconciliationMatchResult } from '../types/reconciliation';
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
  const [expandedExceptionIdx, setExpandedExceptionIdx] = useState<number | null>(null);

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
      case 'MATCHED':
        return (
          <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            <Check className="w-3.5 h-3.5 flex-shrink-0" /> Reconciled
          </span>
        );
      case 'REVIEW':
        return (
          <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--warning)' }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--warning)' }} /> Attention Required
          </span>
        );
      case 'UNRESOLVED':
        return (
          <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--danger)' }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--danger)' }} /> Unresolved
          </span>
        );
      case 'PENDING':
        return (
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--info)' }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--info)' }} /> Pending Payout
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--info)' }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: 'var(--info)' }} /> Processing
          </span>
        );
      case 'CHARGEBACK':
        return (
          <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--danger)' }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--danger)' }} /> Chargeback Exception
          </span>
        );
      case 'DUPLICATE':
        return (
          <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--duplicate)' }}>
            <span className="text-[10px] flex-shrink-0 leading-none">▲</span> Duplicate Record
          </span>
        );
      case 'REFUND':
        return (
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--danger)' }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--danger)' }} /> Refund Event
          </span>
        );
      case 'OUT_OF_SCOPE':
        return (
          <span className="text-muted-foreground text-xs font-medium flex items-center gap-1">
            Out of Scope
          </span>
        );
      default:
        return <span className="text-muted-foreground text-xs font-medium">{status}</span>;
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

  const renderRecordDetails = (res: ReconciliationMatchResult) => {
    return (
      <div className="bg-[var(--surface-muted)] border border-border/80 rounded p-4 text-xs space-y-4 max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row gap-6 items-stretch justify-center">
          {/* Processor Side */}
          <div className="flex-1 bg-muted/5 border border-border/50 p-4 rounded flex flex-col justify-between">
            <div>
              <div className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Processor Ledger Entry</div>
              <div className="text-xl font-mono font-semibold text-foreground mb-1">{getAmountStr(res.processorRecord)}</div>
              <div className="text-[10px] text-muted-foreground mb-3 font-mono">Date: {getDateStr(res.processorRecord)}</div>
            </div>
            <div className="text-[11px] break-all font-mono bg-muted/15 p-2.5 rounded border border-border/30 text-muted-foreground">{res.processorRecord?.transaction?.description || 'No matching record'}</div>
          </div>

          <div className="flex flex-col items-center justify-center py-2 px-1">
            <ArrowRight className="w-4 h-4 text-muted-foreground hidden md:block" />
            {res.decision.evidence.confidenceScore > 0 ? (
              <div className="text-[10px] text-emerald-500 font-mono font-semibold mt-1.5">{res.decision.evidence.confidenceScore}% Match</div>
            ) : (
              <div className="text-[10px] text-muted-foreground font-mono font-semibold mt-1.5">Unmatched</div>
            )}
          </div>

          {/* Bank Side */}
          <div className="flex-1 bg-muted/5 border border-border/50 p-4 rounded flex flex-col justify-between">
            {res.bankRecord ? (
              <>
                <div>
                  <div className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Bank Statement Payout</div>
                  <div className="text-xl font-mono font-semibold text-foreground mb-1">{getAmountStr(res.bankRecord)}</div>
                  <div className="text-[10px] text-muted-foreground mb-3 font-mono">Date: {getDateStr(res.bankRecord)}</div>
                </div>
                <div className="text-[11px] break-all font-mono bg-muted/15 p-2.5 rounded border border-border/30 text-muted-foreground">{res.bankRecord.transaction.description}</div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic py-8 bg-muted/5 border border-dashed border-border/40 rounded">No bank ledger entry found</div>
            )}
          </div>
        </div>

        {/* Evidence / Audit Trail */}
        <div className="bg-muted/5 border border-border/50 rounded p-4">
          <div className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-3">Audit Evidence Trail</div>
          <div className="grid grid-cols-2 gap-4 text-xs mb-3 border-b border-border/30 pb-3">
            <div><span className="text-muted-foreground font-medium">Ledger Status:</span> <span className="font-semibold text-foreground font-mono text-[11px]">{res.decision.status}</span></div>
            <div><span className="text-muted-foreground font-medium">Reconciled Amount:</span> <span className="font-semibold text-foreground font-mono">{res.decision.evidence.amountExact ? 'Exact Match' : `Variance ₹${res.decision.evidence.amountDifference.toFixed(2)}`}</span></div>
            <div><span className="text-muted-foreground font-medium">Settlement Date:</span> <span className="text-foreground">{res.decision.evidence.dateWithinWindow ? 'Within Control Window' : 'Variance Outside Window'}</span></div>
            <div><span className="text-muted-foreground font-medium">Audit Outcome:</span> <span className="text-foreground font-medium">{res.decision.reason}</span></div>
          </div>
          <div className="text-[10px] text-muted-foreground space-y-1 bg-muted/15 p-3 rounded border border-border/30 font-mono max-h-32 overflow-y-auto">
            {res.auditTrail.map((log, idx) => (
              <div key={idx} className="flex gap-2 leading-relaxed">
                <span className="text-muted-foreground/60 select-none">»</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (workspaceLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Get exceptions for the Exceptions Requiring Attention panel
  const exceptions = result
    ? result.results.filter(
        r =>
          r.decision.status === 'REVIEW' ||
          r.decision.status === 'UNRESOLVED' ||
          r.decision.status === 'DUPLICATE' ||
          r.decision.status === 'CHARGEBACK'
      )
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Sophisticated compact header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Reconciliation Control</h1>
            {result && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20 rounded">
                <Check className="w-3 h-3" /> System Confirmed
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Dual-source ledger matching and settlement verification
          </p>
          {result && loadedRun && (
            <div className="text-[10px] text-muted-foreground/85 font-mono mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="flex items-center gap-1 text-emerald-500 font-medium">
                ✓ Reconciliation complete
              </span>
              <span>·</span>
              <span>
                Last run:{' '}
                {new Date(loadedRun.created_at).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}{' '}
                {new Date(loadedRun.created_at).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              <span>·</span>
              <span className="truncate max-w-xs md:max-w-md" title={`${loadedRun.source_metadata?.bank_file_name} · ${loadedRun.source_metadata?.processor_file_name}`}>
                Sources: {loadedRun.source_metadata?.bank_file_name || 'N/A'} ·{' '}
                {loadedRun.source_metadata?.processor_file_name || 'N/A'}
              </span>
            </div>
          )}
        </div>

        {result && (
          <div className="flex items-center gap-2 flex-shrink-0 mt-2 md:mt-0">
            <button
              onClick={() => {
                setResult(null);
                setBankFile(null);
                setProcessorFile(null);
                setLoadedRun(null);
                setActiveRunId(null);
                setExpandedRow(null);
                setExpandedExceptionIdx(null);
              }}
              className="px-3 py-1.5 text-xs font-semibold border border-border rounded bg-muted/10 text-muted-foreground hover:bg-muted/25 transition-colors cursor-pointer"
            >
              Start New
            </button>
            <button
              onClick={downloadReport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-muted/20 hover:bg-muted/35 text-foreground border border-border rounded transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export Report (JSON)
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded flex items-center gap-3 px-4 py-3" style={{ background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)', color: 'var(--danger)' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-xs font-medium">{error}</p>
        </div>
      )}

      {isLoadingLatest && !result ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-mono">Restoring latest reconciliation run...</p>
        </div>
      ) : (
        <>
          {!result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className="relative border border-dashed border-border rounded p-6 flex flex-col items-center justify-center text-center hover:bg-muted/15 transition-all cursor-pointer group bg-card/25"
                onClick={() => bankInputRef.current?.click()}
              >
                <input type="file" ref={bankInputRef} onChange={handleBankUpload} accept=".csv,.xlsx" className="hidden" />
                <div className="w-9 h-9 bg-muted/15 text-muted-foreground rounded-full flex items-center justify-center mb-3 group-hover:bg-muted/35 transition-colors">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-0.5">Bank Statement</h3>
                {bankFile ? (
                  <div className="flex items-center gap-1.5 bg-muted/30 border border-border/40 px-2.5 py-1 rounded text-xs font-mono text-foreground mt-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" /> {bankFile.name}
                  </div>
                ) : <p className="text-xs text-muted-foreground mt-1">Click to upload bank ledger (CSV, XLSX)</p>}
              </div>

              <div
                className="relative border border-dashed border-border rounded p-6 flex flex-col items-center justify-center text-center hover:bg-muted/15 transition-all cursor-pointer group bg-card/25"
                onClick={() => processorInputRef.current?.click()}
              >
                <input type="file" ref={processorInputRef} onChange={handleProcessorUpload} accept=".csv,.xlsx" className="hidden" />
                <div className="w-9 h-9 bg-muted/15 text-muted-foreground rounded-full flex items-center justify-center mb-3 group-hover:bg-muted/35 transition-colors">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-0.5">Payment Processor Export</h3>
                {processorFile ? (
                  <div className="flex items-center gap-1.5 bg-muted/30 border border-border/40 px-2.5 py-1 rounded text-xs font-mono text-foreground mt-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" /> {processorFile.name}
                  </div>
                ) : <p className="text-xs text-muted-foreground mt-1">Click to upload processor ledger (CSV, XLSX)</p>}
              </div>
            </div>
          )}

          {!result && (
            <div className="flex justify-center mt-4">
              <button
                onClick={runReconciliation}
                disabled={!bankFile || !processorFile || isReconciling}
                className={`flex items-center gap-1.5 px-6 py-2.5 rounded text-xs font-semibold tracking-wide transition-all shadow-xs border ${
                  !bankFile || !processorFile
                    ? 'bg-muted/10 border-border/30 text-muted-foreground cursor-not-allowed shadow-none'
                    : 'bg-foreground text-background border-transparent hover:opacity-90 active:scale-[0.98] cursor-pointer'
                }`}
              >
                {isReconciling ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running Pipeline...</>
                ) : (
                  <><ArrowRight className="w-3.5 h-3.5" /> Run Reconciliation Pipeline</>
                )}
              </button>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
              
              {/* Executive Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card/45 border border-border/80 rounded-md p-3.5 flex flex-col justify-between shadow-xs">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Reconciled Value</span>
                  <span className="text-xl font-semibold tracking-tight text-foreground font-mono">₹{result.summary.reconciledValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="bg-card/45 border border-border/80 rounded-md p-3.5 flex flex-col justify-between shadow-xs">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Eligible Settlements</span>
                  <span className="text-xl font-semibold tracking-tight text-foreground font-mono">{result.summary.matchedSettlementCount} <span className="text-muted-foreground font-sans text-xs">/ {result.summary.eligibleSettlementCount}</span></span>
                </div>
                <div className="bg-card/45 border border-border/80 rounded-md p-3.5 flex flex-col justify-between shadow-xs">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Unresolved Discrepancies</span>
                  <span className={`text-xl font-semibold tracking-tight font-mono`} style={{ color: result.summary.unresolvedExposure > 0 ? 'var(--warning)' : 'var(--success)' }}>₹{result.summary.unresolvedExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="bg-card/45 border border-border/80 rounded-md p-3.5 flex flex-col justify-between shadow-xs">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Eligible Match Rate</span>
                  <span className="text-xl font-semibold tracking-tight text-foreground font-mono">{result.summary.matchRate.toFixed(1)}%</span>
                </div>
              </div>

              {/* Reconciliation Ledger Distribution */}
              <div className="border border-border/80 rounded-md p-4 bg-muted/5 shadow-xs">
                <h3 className="text-[10px] font-semibold text-muted-foreground mb-3 uppercase tracking-wider font-mono">Reconciliation Ledger Distribution</h3>
                <div className="w-full h-1.5 bg-muted/30 rounded-none overflow-hidden flex mb-3.5">
                  <div className="h-full" style={{ width: `${(result.summary.matchedSettlementCount / result.summary.processorTotal) * 100}%`, background: 'var(--accent)' }}></div>
                  <div className="h-full" style={{ width: `${(result.summary.reviewCount / result.summary.processorTotal) * 100}%`, background: 'var(--warning)', opacity: 0.8 }}></div>
                  <div className="h-full" style={{ width: `${(result.summary.unresolvedSettlementCount / result.summary.processorTotal) * 100}%`, background: 'var(--danger)', opacity: 0.8 }}></div>
                  <div className="h-full" style={{ width: `${(result.summary.pendingCount / result.summary.processorTotal) * 100}%`, background: 'var(--info)', opacity: 0.6 }}></div>
                  <div className="h-full" style={{ width: `${(result.summary.duplicateCount / result.summary.processorTotal) * 100}%`, background: 'var(--duplicate)', opacity: 0.6 }}></div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                    Reconciled <span className="font-semibold text-foreground font-sans text-xs ml-0.5">{result.summary.matchedSettlementCount}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--warning)', opacity: 0.9 }} />
                    Under Review <span className="font-semibold text-foreground font-sans text-xs ml-0.5">{result.summary.reviewCount}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--danger)', opacity: 0.9 }} />
                    Exceptions <span className="font-semibold text-foreground font-sans text-xs ml-0.5">{result.summary.unresolvedSettlementCount}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--info)', opacity: 0.7 }} />
                    Pending <span className="font-semibold text-foreground font-sans text-xs ml-0.5">{result.summary.pendingCount}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--duplicate)', opacity: 0.7 }} />
                    Duplicates <span className="font-semibold text-foreground font-sans text-xs ml-0.5">{result.summary.duplicateCount}</span>
                  </span>
                </div>
              </div>

              {/* Exceptions Requiring Attention */}
              {exceptions.length > 0 && (
                <div className="border border-border/80 rounded-md p-4 bg-muted/5 shadow-xs">
                  <div className="flex flex-col mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--warning)' }}>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Exceptions Requiring Attention
                    </h3>
                    <span className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                      {exceptions.length} {exceptions.length === 1 ? 'item' : 'items'} requiring review
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground font-mono text-[9px] uppercase tracking-wider">
                          <th className="py-2 px-3 font-semibold w-24">Type</th>
                          <th className="py-2 px-3 font-semibold">Description</th>
                          <th className="py-2 px-3 font-semibold text-right w-36">Amount</th>
                          <th className="py-2 px-3 font-semibold text-center w-28">Status</th>
                          <th className="py-2 px-3 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {exceptions.map((r, idx) => {
                          const isExpanded = expandedExceptionIdx === idx;
                          const typeStr = r.decision.status === 'DUPLICATE' ? 'Duplicate' : 'Settlement';
                          const description = r.bankRecord?.transaction?.description || r.processorRecord?.transaction?.description || 'Missing Record Details';
                          const amountStr = r.bankRecord ? getAmountStr(r.bankRecord) : getAmountStr(r.processorRecord);
                          return (
                            <React.Fragment key={idx}>
                              <tr
                                className="hover:bg-muted/10 transition-colors cursor-pointer"
                                onClick={() => {
                                  setExpandedExceptionIdx(isExpanded ? null : idx);
                                  setExpandedRow(null); // Close main table selection
                                }}
                              >
                                <td className="py-2.5 px-3 text-muted-foreground font-mono text-[10px] uppercase tracking-wider">{typeStr}</td>
                                <td className="py-2.5 px-3 font-medium text-foreground max-w-xs truncate" title={description}>
                                  {description}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground tracking-tight tabular-nums">
                                  {amountStr}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="inline-flex justify-center w-full">
                                    {renderStatusBadge(r.decision.status)}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center text-muted-foreground/60">
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={5} className="py-3 px-3 bg-[var(--background)] border-t border-border/20">
                                    {renderRecordDetails(r)}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Payouts & Settlement Results */}
              {(() => {
                const auditResults = result.results.filter(r => r.decision.status !== 'OUT_OF_SCOPE');
                return (
                  <div className="bg-card/45 border border-border/80 rounded-md shadow-xs overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border font-semibold text-xs text-muted-foreground uppercase tracking-wider bg-muted/10 flex items-center justify-between">
                      <span>Settlement Audit Log ({auditResults.length} records processed)</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/5 text-muted-foreground text-[9px] uppercase font-mono tracking-wider border-b border-border/50">
                          <tr>
                            <th className="px-4 py-2 text-left w-32">Status</th>
                            <th className="px-4 py-2 text-left">Bank description</th>
                            <th className="px-4 py-2 text-right w-44">Settlement Amt (Processor)</th>
                            <th className="px-4 py-2 text-right w-40">Bank Amt (Ledger)</th>
                            <th className="px-4 py-2 text-right w-28">Date</th>
                            <th className="px-4 py-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {auditResults.map((res, i) => (
                            <React.Fragment key={i}>
                              <tr 
                                className="hover:bg-muted/10 transition-colors cursor-pointer" 
                                onClick={() => {
                                  setExpandedRow(expandedRow === i ? null : i);
                                  setExpandedExceptionIdx(null); // Close exceptions panel selection
                                }}
                              >
                                <td className="px-4 py-2.5">{renderStatusBadge(res.decision.status)}</td>
                                <td className="px-4 py-2.5 font-medium text-foreground max-w-[200px] truncate" title={res.bankRecord?.transaction?.description || res.processorRecord?.transaction?.description}>
                                  {res.bankRecord?.transaction?.description || res.processorRecord?.transaction?.description || 'Missing Ledger Item'}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground tracking-tight tabular-nums">{getAmountStr(res.processorRecord)}</td>
                                <td className="px-4 py-2.5 text-right font-mono font-medium text-muted-foreground tracking-tight tabular-nums">{getAmountStr(res.bankRecord)}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground font-mono text-[10px]">
                                  {res.bankRecord ? getDateStr(res.bankRecord) : getDateStr(res.processorRecord)}
                                </td>
                                <td className="px-4 py-2.5 text-center text-muted-foreground/60">
                                  {expandedRow === i ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </td>
                              </tr>
                              {expandedRow === i && (
                                <tr>
                                  <td colSpan={6} className="px-4 py-3 bg-[var(--background)] border-t border-border/20">
                                    {renderRecordDetails(res)}
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
                <div className="bg-card/30 border border-border/80 rounded-md p-3.5 flex items-center justify-between shadow-xs text-xs">
                  <div>
                    <h3 className="font-semibold text-foreground">Non-Processor Bank Activity</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{result.summary.outOfScopeCount} records outside reconciliation scope (general operations, operating expenses, transfers)</p>
                  </div>
                  <button 
                    onClick={() => {
                      setExpandedRow(expandedRow === -1 ? null : -1);
                      setExpandedExceptionIdx(null);
                    }}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
                  >
                    {expandedRow === -1 ? 'Hide ledger items ↑' : 'View ledger items →'}
                  </button>
                </div>
              )}

              {expandedRow === -1 && result.outOfScopeBankTxns.length > 0 && (
                <div className="bg-card/25 border border-border/80 rounded-md shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/5 text-muted-foreground text-[9px] uppercase font-mono tracking-wider border-b border-border/40">
                        <tr>
                          <th className="py-2 px-4">Description</th>
                          <th className="py-2 px-4 text-right w-44">Amount</th>
                          <th className="py-2 px-4 text-right w-40">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {result.outOfScopeBankTxns.map((t, idx) => (
                          <tr key={idx} className="hover:bg-muted/10 transition-colors">
                            <td className="py-2 px-4 font-mono text-muted-foreground text-[11px] max-w-md truncate" title={t.description}>{t.description}</td>
                            <td className="py-2 px-4 text-right font-mono font-semibold text-foreground tracking-tight tabular-nums">₹{Math.abs(t.amount || 0).toLocaleString()}</td>
                            <td className="py-2 px-4 text-right text-muted-foreground font-mono text-[10px]">{t.transaction_date}</td>
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
            <div className="border border-border/80 rounded-md p-4 bg-muted/5 shadow-xs space-y-3.5 mt-8">
              <div className="flex items-center gap-1.5 border-b border-border/50 pb-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">Reconciliation Run History</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      className={`p-3 border rounded cursor-pointer transition-all hover:bg-muted/10 flex flex-col justify-between space-y-2 bg-card/35 ${
                        isActive
                          ? 'border-emerald-600/70 ring-1 ring-emerald-600/25 bg-emerald-950/10'
                          : 'border-border/60'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-mono text-muted-foreground">{formattedDate}</span>
                        {isActive && (
                          <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider">Active</span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                        <div>
                          <span className="text-muted-foreground">Reconciled:</span>{' '}
                          <span className="font-semibold text-foreground font-mono">₹{reconciledVal.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Settlements:</span>{' '}
                          <span className="font-semibold text-foreground font-mono">{matchedCount}/{eligibleCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Match Rate:</span>{' '}
                          <span className="font-semibold text-foreground font-mono">{matchRate.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Unresolved:</span>{' '}
                          <span className={`font-semibold font-mono ${unresolvedExp > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>
                            ₹{unresolvedExp.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="text-[9px] text-muted-foreground/80 font-mono truncate border-t border-border/30 pt-1.5 mt-1 flex justify-between gap-2">
                        <span className="truncate">Bank: {run.source_metadata?.bank_file_name || 'N/A'}</span>
                        <span className="truncate text-right">Proc: {run.source_metadata?.processor_file_name || 'N/A'}</span>
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
