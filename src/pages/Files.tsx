import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertCircle
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
import { supabase } from '../lib/supabase';

const Files: React.FC = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; subtext?: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [autoMapping, setAutoMapping] = useState<MappingSuggestion | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (activeClient) {
      fetchHistory();
    }
  }, [activeClient]);

  const fetchHistory = async () => {
    if (!activeClient) return;
    console.log('[Phase 3] Fetching file history...');
    const { data, error } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) console.error('[Phase 3] History fetch error:', error);
    if (data) setHistory(data);
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    console.log('[Phase 3] Processing upload:', file.name);
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv') {
      setError({ message: `Format .${ext} is currently a placeholder.`, subtext: 'Please use CSV for Phase 3.' });
      return;
    }

    setLoading(true);
    try {
      // 1. Parse locally
      const result = await parseCSV(file);
      if (result.errors.length > 0) {
        setError({ message: 'Parsing failed', subtext: result.errors[0] });
        setLoading(false);
        return;
      }

      // 2. Intelligent Auto-Mapping (Product Change)
      const mappingResult = suggestMappingFromColumns(result.headers);
      console.log('[Phase 3] Auto-mapping result:', mappingResult);

      setPendingFile(file);
      setParseResult(result);
      setAutoMapping(mappingResult);

      // 3. Sync to Supabase
      if (!activeOrg || !activeClient) return;

      const user = (await supabase.auth.getUser()).data.user;

      // Step A: Create Uploaded File
      const { data: fileData, error: fileErr } = await supabase
        .from('uploaded_files')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          file_name: file.name,
          file_type: 'csv',
          file_size: file.size,
          storage_path: `simulated/${file.name}`,
          status: mappingResult.status, // Using engine status
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

      // Step B: Create Import with Mapping Data
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
          status: mappingResult.status === 'ready_to_import' ? 'preview_ready' : 'mapping_required'
        })
        .select()
        .single();

      if (importErr) throw importErr;

      // Step C: Save Mapping immediately
      const { error: mappingErr } = await supabase
        .from('import_mappings')
        .insert({
          import_id: importData.id,
          confirmed_mapping_json: mappingResult.mapping,
          confirmed_by: user?.id,
          confirmed_at: mappingResult.status === 'ready_to_import' ? new Date().toISOString() : null
        });

      if (mappingErr) console.warn('[Phase 3] Initial mapping save warning:', mappingErr);

      console.log('[Phase 3] Full ingestion context saved. Status:', mappingResult.status);
      fetchHistory();

    } catch (err: any) {
      console.error('[Phase 3] Ingestion sync failed:', err);
      setError({ 
        message: 'Parsed locally, but failed to sync to workspace.', 
        subtext: err.message.includes('relation') ? 'Database tables missing. Run migrations.' : err.message 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!autoMapping || !activeClient) return;

    // Get the latest import ID
    const { data } = await supabase
      .from('imports')
      .select('id, status')
      .eq('client_id', activeClient.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return;

    if (autoMapping.status === 'ready_to_import') {
      // Phase 4 placeholder
      alert('Intelligent Auto-Mapping Complete!\n\nStatus: Ready to Import\nConfidence: ' + (autoMapping.confidence * 100) + '%\n\nTransaction ingestion starts in Phase 4.');
      setPendingFile(null);
      setParseResult(null);
      setAutoMapping(null);
    } else {
      navigate(`/files/${data.id}/mapping`, { 
        state: { 
          headers: parseResult?.headers, 
          previewRows: parseResult?.rows,
          fileName: pendingFile?.name || '',
          provider: parseResult?.provider
        } 
      });
    }
  };

  if (!activeClient) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <EmptyState 
          title="No client workspace selected"
          description="Create or select a client workspace before uploading finance files."
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Finance Files</h1>
          <p className="text-muted-foreground">Upload source data for <span className="text-foreground font-semibold">{activeClient.name}</span>.</p>
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
