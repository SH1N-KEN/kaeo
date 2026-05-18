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
import { parseCSV } from '../lib/fileParser';
import type { ParseResult } from '../lib/fileParser';
import { generateBestMapping } from '../lib/mappingEngine';
import type { MappingSuggestion } from '../lib/mappingEngine';
import { normalizeRows } from '../lib/normalizationEngine';
import { supabase } from '../lib/supabase';
import { trackUsageEvent } from '../lib/billing';

const Files: React.FC = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; subtext?: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
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

  const handleFileSelect = async (file: File) => {
    setError(null);
    setSuccess(null);
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv') {
      setError({ message: `Format .${ext} is currently a placeholder.`, subtext: 'Please use CSV for Phase 4.' });
      return;
    }

    setLoading(true);
    try {
      const result = await parseCSV(file);
      console.log(`[Files] Parsed ${result.rowCount} rows from ${file.name}`);

      if (result.errors.length > 0) {
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
          file_type: 'csv',
          file_size: file.size,
          storage_path: `simulated/${file.name}`,
          status: mappingResult.status,
          metadata: {
            row_count: result.rowCount,
            provider_detected: result.provider,
            confidence: mappingResult.confidence,
            mapping_source: mappingResult.source,
            warnings: mappingResult.warnings
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
        const rowsToImport = importData.parsed_rows_json && importData.parsed_rows_json.length > 0 
          ? importData.parsed_rows_json 
          : parseResult.allRows;
          
        console.log(`[Files] Importing ${rowsToImport.length} rows via ${autoMapping.source} mapping...`);
        
        const normalized = normalizeRows(rowsToImport, autoMapping.mapping, {
          provider: parseResult.provider,
          currency: activeClient.base_currency || 'INR'
        });

        const transactionsToInsert = normalized.map(tx => ({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          import_id: importData.id,
          file_id: importData.file_id?.id,
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

        setSuccess(`Successfully imported ${transactionsToInsert.length} transactions!`);
        setPendingFile(null);
        setParseResult(null);
        setAutoMapping(null);
        fetchHistory();
        
        setTimeout(() => {
          navigate('/transactions');
        }, 1500);

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
          </div>
          <button onClick={() => setError(null)} className="text-[10px] font-black text-risk/60 hover:text-risk uppercase">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-success/5 border border-success/10 rounded-xl flex gap-3 items-center animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          <p className="text-sm text-success font-bold flex-1">{success}</p>
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4 text-success" /></button>
        </div>
      )}

      {loading && !parseResult && (
        <div className="h-64 bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <Zap className="w-4 h-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
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
