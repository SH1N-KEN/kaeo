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
import { supabase } from '../lib/supabase';

const Files: React.FC = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; subtext?: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (activeClient) {
      fetchHistory();
    }
  }, [activeClient]);

  const fetchHistory = async () => {
    if (!activeClient) return;
    console.log('[Phase 3] Fetching file history for client:', activeClient.id);
    const { data, error } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('[Phase 3] Failed to fetch history:', error);
    }
    if (data) setHistory(data);
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    console.log('[Phase 3] File selected:', file.name, 'Size:', file.size);
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv') {
      setError({ message: `Format .${ext} is currently only a placeholder.`, subtext: 'Please use CSV for Phase 3.' });
      return;
    }

    setLoading(true);
    try {
      console.log('[Phase 3] Starting PapaParse...');
      const result = await parseCSV(file);
      console.log('[Phase 3] Parsing complete. Rows:', result.rowCount, 'Headers:', result.headers);
      
      if (result.errors.length > 0) {
        setError({ message: 'Parsing failed', subtext: result.errors[0] });
        setLoading(false);
        return;
      }

      // 1. Set local state immediately for preview (Issue 3: Local preview fallback)
      setPendingFile(file);
      setParseResult(result);

      // 2. Try to persist to Supabase
      if (!activeOrg || !activeClient) {
        console.warn('[Phase 3] No active organization/client, skipping Supabase sync');
        return;
      }

      console.log('[Phase 3] Syncing to Supabase...');
      
      // Step A: Create Uploaded File record
      const { data: fileData, error: fileErr } = await supabase
        .from('uploaded_files')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          file_name: file.name,
          file_type: 'csv',
          file_size: file.size,
          storage_path: `simulated/${file.name}`,
          status: 'parsed', // Issue 1: Correct status flow
          metadata: {
            row_count: result.rowCount,
            provider_detected: result.provider
          }
        })
        .select()
        .single();

      if (fileErr) {
        console.error('[Phase 3] Supabase uploaded_files error:', fileErr);
        setError({ 
          message: 'Parsed locally, but failed to save to workspace.', 
          subtext: fileErr.message.includes('relation') ? 'Database tables missing. Run migrations.' : fileErr.message 
        });
        return;
      }

      console.log('[Phase 3] File record created:', fileData.id);

      // Step B: Create Import record with metadata
      const { data: importData, error: importErr } = await supabase
        .from('imports')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          file_id: fileData.id,
          provider_detected: result.provider,
          source_type: result.sourceType,
          row_count: result.rowCount, // Issue 2: Real row count
          raw_columns_json: result.headers, // Issue 1: Save columns
          preview_rows_json: result.rows, // Issue 1: Save preview
          status: 'preview_ready' // Issue 1: Correct status flow
        })
        .select()
        .single();

      if (importErr) {
        console.error('[Phase 3] Supabase imports error:', importErr);
        setError({ message: 'Failed to create import session', subtext: importErr.message });
        return;
      }

      console.log('[Phase 3] Import record created:', importData.id);
      
      // Refresh history
      fetchHistory();

    } catch (err: any) {
      console.error('[Phase 3] Unexpected error:', err);
      setError({ message: 'Failed to process file', subtext: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToMapping = async () => {
    if (!parseResult || !activeClient) return;
    
    // We need the importId. If we just created it, we should have it.
    // If Supabase failed, we can't map.
    
    setLoading(true);
    try {
      // Find the latest pending import for this client/file
      const { data, error } = await supabase
        .from('imports')
        .select('id')
        .eq('client_id', activeClient.id)
        .eq('status', 'preview_ready')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        setError({ message: 'Mapping session not found', subtext: 'Ensure the file was saved correctly to the database.' });
        return;
      }

      navigate(`/files/${data.id}/mapping`, { 
        state: { 
          headers: parseResult.headers, 
          previewRows: parseResult.rows,
          fileName: pendingFile?.name || '',
          provider: parseResult.provider
        } 
      });

    } catch (err: any) {
      setError({ message: 'Failed to start mapping', subtext: err.message });
    } finally {
      setLoading(false);
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
          <p className="text-muted-foreground">Upload and manage source data for <span className="text-foreground font-semibold">{activeClient.name}</span>.</p>
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
          onContinue={handleContinueToMapping}
          onCancel={() => {
            setPendingFile(null);
            setParseResult(null);
          }}
        />
      )}
    </div>
  );
};

export default Files;
