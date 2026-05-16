import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  AlertCircle,
  CheckCircle2,
  Loader2,
  X
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import UploadZone from '../components/files/UploadZone';
import FilePreview from '../components/files/FilePreview';
import FileHistory from '../components/files/FileHistory';
import EmptyState from '../components/ui/EmptyState';
import { parseCSV } from '../lib/fileParser';
import type { ParseResult } from '../lib/fileParser';
import { suggestMappingFromColumns } from '../lib/mappingEngine';
import type { MappingSuggestion } from '../lib/mappingEngine';
import { normalizeRows } from '../lib/normalizationEngine';
import { supabase } from '../lib/supabase';

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
    
    if (data) setHistory(data);
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
      if (result.errors.length > 0) {
        setError({ message: 'Parsing failed', subtext: result.errors[0] });
        setLoading(false);
        return;
      }

      const mappingResult = suggestMappingFromColumns(result.headers);
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
            warnings: mappingResult.warnings
          }
        })
        .select()
        .single();

      if (fileErr) throw fileErr;

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
          status: mappingResult.status === 'ready_to_import' ? 'ready_to_import' : 'mapping_required'
        })
        .select()
        .single();

      if (importErr) throw importErr;

      await supabase
        .from('import_mappings')
        .insert({
          import_id: importData.id,
          confirmed_mapping_json: mappingResult.mapping,
          confirmed_by: user?.id,
          confirmed_at: mappingResult.status === 'ready_to_import' ? new Date().toISOString() : null
        });

      fetchHistory();

    } catch (err: any) {
      setError({ message: 'Ingestion sync failed', subtext: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!autoMapping || !activeClient || !activeOrg || !parseResult) return;

    setLoading(true);
    try {
      // 1. Get the import record
      const { data: importData, error: fetchErr } = await supabase
        .from('imports')
        .select('*, file_id(id)')
        .eq('client_id', activeClient.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchErr || !importData) throw new Error('Import session not found');

      if (autoMapping.status === 'ready_to_import' || autoMapping.status === 'review_mapping') {
        console.log('[Phase 4] Starting normalization and import...');
        
        // 2. Normalize all rows
        const normalized = normalizeRows(parseResult.rows, autoMapping.mapping, {
          provider: parseResult.provider,
          currency: activeClient.base_currency || 'INR'
        });

        // 3. Batch insert into transactions
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

        // 4. Update statuses
        await supabase.from('imports').update({ status: 'imported' }).eq('id', importData.id);
        await supabase.from('uploaded_files').update({ status: 'imported' }).eq('id', importData.file_id?.id);

        console.log('[Phase 4] Import complete. Rows:', transactionsToInsert.length);
        
        setSuccess(`Successfully imported ${transactionsToInsert.length} transactions!`);
        setPendingFile(null);
        setParseResult(null);
        setAutoMapping(null);
        fetchHistory();
        
        // Short delay then navigate to transactions
        setTimeout(() => {
          navigate('/transactions');
        }, 1500);

      } else {
        // Redirect to manual mapping
        navigate(`/files/${importData.id}/mapping`, { 
          state: { 
            headers: parseResult.headers, 
            previewRows: parseResult.rows,
            fileName: pendingFile?.name || '',
            provider: parseResult.provider
          } 
        });
      }

    } catch (err: any) {
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
          <h1 className="text-3xl font-bold mb-2">Finance Files</h1>
          <p className="text-muted-foreground">Ingest and normalize data for <span className="text-foreground font-semibold">{activeClient.name}</span>.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-risk/5 border border-risk/20 rounded-xl flex gap-3 items-start animate-in shake-in">
          <AlertCircle className="w-5 h-5 text-risk shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm text-risk font-bold">{error.message}</h4>
            {error.subtext && <p className="text-xs text-risk/80 mt-1">{error.subtext}</p>}
          </div>
          <button onClick={() => setError(null)} className="text-xs text-risk hover:underline">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-success/5 border border-success/20 rounded-xl flex gap-3 items-center animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          <p className="text-sm text-success font-bold flex-1">{success}</p>
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4 text-success" /></button>
        </div>
      )}

      {loading && !parseResult && (
        <div className="h-64 bg-card border rounded-2xl flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Processing finance document...</p>
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
