import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Zap
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import UploadZone from '../components/files/UploadZone';
import FilePreview from '../components/files/FilePreview';
import FileHistory from '../components/files/FileHistory';
import EmptyState from '../components/ui/EmptyState';
import { parseFinancialFile } from '../lib/fileParser';
import type { IngestedParsedFile } from '../lib/ingestion/ingestionTypes';
import { generateBestMapping } from '../lib/mappingEngine';
import type { MappingSuggestion } from '../lib/mappingEngine';
import { supabase } from '../lib/supabase';
import { trackUsageEvent } from '../lib/billing';
import { checkUsageEventAllowed } from '../lib/billingGuards';
import { normalizeIngestedRows } from '../lib/ingestion/transactionNormalizer';
import { checkDuplicateTransactions } from '../lib/ingestion/duplicateEngine';

const Files: React.FC = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; subtext?: string; showUpgrade?: boolean } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<IngestedParsedFile | null>(null);
  const [autoMapping, setAutoMapping] = useState<MappingSuggestion | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (activeClient) fetchHistory();
    if (location.state?.success) setSuccess(location.state.success);
  }, [activeClient, location.state]);

  const fetchHistory = async () => {
    if (!activeClient) return;
    const { data } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    setHistory(data || []);
  };

  const handleSheetChange = async (sheetId: string) => {
    if (!parseResult || !parseResult.sheets || !pendingFile) return;
    const sheet = parseResult.sheets.find(s => s.id === sheetId);
    if (!sheet) return;
    
    console.log(`[Files] Switching worksheet to: ${sheetId}`);
    setLoading(true);

    try {
      // Recompute auto mapping suggestions based on selected sheet columns
      const mappingResult = await generateBestMapping(
        sheet.detectedColumns,
        sheet.rawRows.slice(0, 10),
        pendingFile.name,
        parseResult.provider
      );

      const updatedResult: IngestedParsedFile = {
        ...parseResult!,
        selectedSheetId: sheetId,
        headers: sheet.detectedColumns,
        detectedColumns: sheet.detectedColumns,
        rows: sheet.rawRows.slice(0, 10),
        previewRows: sheet.rawRows.slice(0, 10),
        allRows: sheet.rawRows,
        rawRows: sheet.rawRows,
        rowCount: sheet.rowCount,
        confidence: sheet.confidence,
        warnings: sheet.warnings,
        metadata: {
          ...parseResult!.metadata,
          totalRows: sheet.rowCount,
          previewRowCount: Math.min(10, sheet.rowCount),
          detectedHeaderRow: sheet.detectedHeaderRow,
          skippedRows: sheet.skippedRows
        },
        provider: parseResult!.provider,
        sourceType: parseResult!.sourceType
      };

      setParseResult(updatedResult);
      setAutoMapping(mappingResult);

      if (activeClient) {
        // Query the latest active import session to keep Supabase in sync
        const { data: importData } = await supabase
          .from('imports')
          .select('id')
          .eq('client_id', activeClient.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (importData) {
          await supabase
            .from('imports')
            .update({
              selected_sheet_name: sheetId,
              row_count: sheet.rowCount,
              raw_columns_json: sheet.detectedColumns,
              preview_rows_json: sheet.rawRows.slice(0, 10),
              parsed_rows_json: sheet.rawRows,
              detected_header_row: sheet.detectedHeaderRow || 0,
              ingestion_confidence: sheet.confidence,
              ingestion_warnings_json: sheet.warnings,
              status: mappingResult.status === 'ready_to_import' ? 'ready_to_import' : 'mapping_required'
            })
            .eq('id', importData.id);

          await supabase
            .from('import_mappings')
            .update({
              confirmed_mapping_json: mappingResult.mapping
            })
            .eq('import_id', importData.id);
        }
      }
    } catch (err: any) {
      console.error('[Files] Sheet change syncing failed:', err);
      setError({ message: 'Worksheet switch failed', subtext: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    setSuccess(null);
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    const supportedTypes = ['csv', 'xlsx', 'xls', 'pdf'];
    if (!ext || !supportedTypes.includes(ext)) {
      setError({ message: `Format .${ext} is not supported.`, subtext: 'Kaeo supports CSV, XLSX, and PDF financial files.' });
      return;
    }

    if (!activeOrg) {
      setError({ message: 'No active workspace', subtext: 'Please select a workspace before uploading.' });
      return;
    }

    setLoading(true);
    try {
      // Enforce file upload capacity limit
      const limitCheck = await checkUsageEventAllowed(activeOrg.id, 'file_uploaded', 1);
      if (!limitCheck.allowed) {
        setError({
          message: limitCheck.message || 'File upload limit reached for this billing cycle.',
          subtext: 'Please upgrade your plan to upload additional files.',
          showUpgrade: true
        });
        setLoading(false);
        return;
      }
      
      const result = await parseFinancialFile(file);
      console.log(`[Files] Parsed ${result.rowCount} rows from ${file.name}`);

      if (result.errors && result.errors.length > 0) {
        setError({ message: 'Parsing failed', subtext: result.errors[0] });
        setLoading(false);
        return;
      }

      // ORCHESTRATED INTELLIGENT MAPPING
      const mappingResult = await generateBestMapping(
        result.headers, 
        result.rows, 
        file.name, 
        result.provider
      );
      
      setPendingFile(file);
      setParseResult(result);
      setAutoMapping(mappingResult);

      if (!activeOrg || !activeClient) return;

      const user = (await supabase.auth.getUser()).data.user;

      const { data: fileData, error: fileErr } = await supabase
        .from('uploaded_files')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          file_name: file.name,
          file_type: ext,
          file_size: file.size,
          storage_path: `simulated/${file.name}`,
          status: mappingResult.status,
          parser_version: '12A',
          metadata: {
            row_count: result.rowCount,
            provider_detected: result.provider,
            confidence: result.confidence,
            mapping_confidence: mappingResult.confidence,
            mapping_source: mappingResult.source,
            warnings: result.warnings,
            sheets: result.sheets ? result.sheets.map(s => ({ name: s.name, rows: s.rowCount })) : []
          }
        })
        .select()
        .single();

      if (fileErr) throw fileErr;

      // Track usage: file uploaded
      if (activeOrg && activeClient) {
        trackUsageEvent({
          organizationId: activeOrg.id,
          clientId: activeClient.id,
          eventType: 'file_uploaded',
          quantity: 1,
          userId: user?.id
        });
      }

      const { data: importData, error: importErr } = await supabase
        .from('imports')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          file_id: fileData.id,
          provider_detected: result.provider,
          source_type: result.sourceType,
          row_count: result.rowCount,
          raw_columns_json: result.headers,
          preview_rows_json: result.rows,
          parsed_rows_json: result.allRows,
          selected_sheet_name: result.selectedSheetId || null,
          detected_header_row: result.metadata.detectedHeaderRow || 0,
          ingestion_confidence: result.confidence,
          ingestion_warnings_json: result.warnings,
          status: mappingResult.status === 'ready_to_import' ? 'ready_to_import' : 'mapping_required'
        })
        .select()
        .single();

      if (importErr) throw importErr;
      console.log(`[Files] Created import session: ${importData.id} with source: ${mappingResult.source}`);

      await supabase
        .from('import_mappings')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          import_id: importData.id,
          confirmed_mapping_json: mappingResult.mapping,
          confirmed_by: user?.id,
          confirmed_at: mappingResult.status === 'ready_to_import' ? new Date().toISOString() : null
        });

      fetchHistory();

    } catch (err: any) {
      console.error('[Files] Ingestion error:', err);
      setError({ message: 'Ingestion sync failed', subtext: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!autoMapping || !activeClient || !activeOrg || !parseResult) return;

    setLoading(true);
    try {
      const { data: importData, error: fetchErr } = await supabase
        .from('imports')
        .select('*, file_id(id)')
        .eq('client_id', activeClient.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchErr || !importData) throw new Error('Import session not found');
      
      if (importData.status === 'imported') {
        throw new Error('This file has already been imported.');
      }

      if (autoMapping.status === 'ready_to_import') {
        const rowsToImport = parseResult.allRows;
          
        // 1. Run robust normalization
        const normalizedResult = normalizeIngestedRows(rowsToImport, autoMapping.mapping, {
          provider: parseResult.provider,
          currency: activeClient.base_currency || 'INR'
        });

        if (normalizedResult.transactions.length === 0) {
          setError({
            message: 'Import rejected: No transactions could be normalized.',
            subtext: 'Please review your column mappings to ensure required fields have data.'
          });
          setLoading(false);
          return;
        }

        // 2. Run duplicate protection engine
        const dupReport = await checkDuplicateTransactions(activeClient.id, normalizedResult.transactions);

        if (dupReport.importableCount === 0) {
          setError({
            message: 'Import blocked: Duplicate rows detected.',
            subtext: `Kaeo matched all ${dupReport.totalIncoming} rows in this upload against your existing transactions ledger. Row double-entry blocked.`
          });
          setLoading(false);
          return;
        }

        // Enforce transaction ledger row capacity limits (based on clean deduplicated count!)
        const txCheck = await checkUsageEventAllowed(activeOrg.id, 'transaction_imported', dupReport.importableCount);
        if (!txCheck.allowed) {
          setError({
            message: txCheck.message || 'Transaction import row limit reached for this billing cycle.',
            subtext: 'Please upgrade your plan to ingest additional transaction rows.',
            showUpgrade: true
          });
          setLoading(false);
          return;
        }

        console.log(`[Files] Importing ${dupReport.importableCount} clean rows via ${autoMapping.source} mapping...`);
        
        const transactionsToInsert = dupReport.cleanTransactions.map(tx => ({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          import_id: importData.id,
          file_id: importData.file_id?.id,
          source_sheet_name: parseResult.selectedSheetId || null,
          ...tx
        }));

        const { error: insertErr } = await supabase
          .from('transactions')
          .insert(transactionsToInsert);

        if (insertErr) throw insertErr;
        console.log(`[Files] Successfully inserted ${transactionsToInsert.length} transactions.`);

        // Track usage: transactions imported
        const { data: userData } = await supabase.auth.getUser();
        trackUsageEvent({
          organizationId: activeOrg.id,
          clientId: activeClient.id,
          eventType: 'transaction_imported',
          quantity: transactionsToInsert.length,
          userId: userData?.user?.id
        });

        await supabase.from('imports').update({ status: 'imported' }).eq('id', importData.id);
        await supabase.from('uploaded_files').update({ status: 'imported' }).eq('id', importData.file_id?.id);

        let successMsg = `Successfully imported ${transactionsToInsert.length} transactions!`;
        if (dupReport.dbDuplicates > 0 || dupReport.intraFileDuplicates > 0) {
          const skipped = dupReport.dbDuplicates + dupReport.intraFileDuplicates;
          successMsg += ` (${skipped} duplicate rows automatically skipped for ledger protection)`;
        }
        
        setSuccess(successMsg);
        setPendingFile(null);
        setParseResult(null);
        setAutoMapping(null);
        fetchHistory();
        
        setTimeout(() => {
          navigate('/transactions');
        }, 1800);

      } else {
        navigate(`/files/${importData.id}/mapping`);
      }

    } catch (err: any) {
      console.error('[Files] Import action failed:', err);
      setError({ message: 'Import failed', subtext: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!activeClient) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <EmptyState 
          title="No client workspace selected"
          description="Select a client workspace before uploading finance files."
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 tracking-tight">Finance Files</h1>
          <p className="text-sm text-muted-foreground">Strategic ingestion for <span className="text-foreground font-semibold">{activeClient.name}</span>.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-risk/5 border border-risk/10 rounded-xl flex gap-3 items-start animate-in shake-in">
          <AlertCircle className="w-5 h-5 text-risk/70 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm text-risk/80 font-bold">{error.message}</h4>
            {error.subtext && <p className="text-xs text-risk/60 mt-1">{error.subtext}</p>}
            {error.showUpgrade && (
              <button
                onClick={() => navigate('/billing')}
                className="mt-3 px-3 py-1.5 bg-foreground text-background hover:opacity-90 text-xs font-bold rounded-md transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                Upgrade Subscription
              </button>
            )}
          </div>
          <button onClick={() => setError(null)} className="text-[10px] font-black text-risk/60 hover:text-risk uppercase cursor-pointer">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-success/5 border border-success/10 rounded-xl flex gap-3 items-center animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          <p className="text-sm text-success font-bold flex-1">{success}</p>
          <button onClick={() => setSuccess(null)} className="cursor-pointer"><X className="w-4 h-4 text-success" /></button>
        </div>
      )}

      {loading && !parseResult && (
        <div className="h-64 bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <Loader2 className="w-10 h-10 animate-spin text-foreground" />
            <Zap className="w-4 h-4 text-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-xs text-muted-foreground font-black uppercase tracking-widest">Applying intelligence engine...</p>
        </div>
      )}

      {!parseResult ? (
        <div className="space-y-12">
          <UploadZone onFileSelect={handleFileSelect} loading={loading} />
          <FileHistory history={history} />
        </div>
      ) : (
        <FilePreview 
          fileName={pendingFile?.name || ''} 
          result={parseResult} 
          autoMapping={autoMapping}
          onAction={handleAction}
          onSheetChange={handleSheetChange}
          onCancel={() => {
            setPendingFile(null);
            setParseResult(null);
            setAutoMapping(null);
          }}
        />
      )}
    </div>
  );
};

export default Files;

