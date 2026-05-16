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
  const [error, setError] = useState<string | null>(null);
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
    const { data } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('client_id', activeClient.id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (data) setHistory(data);
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    
    // Check extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv') {
      setError(`Format .${ext} is currently only a placeholder. Please use CSV for Phase 3.`);
      return;
    }

    setLoading(true);
    try {
      const result = await parseCSV(file);
      if (result.errors.length > 0) {
        setError(result.errors[0]);
        setLoading(false);
        return;
      }
      setPendingFile(file);
      setParseResult(result);
    } catch (err: any) {
      setError('Failed to parse file: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToMapping = async () => {
    if (!pendingFile || !parseResult || !activeOrg || !activeClient) return;
    
    setLoading(true);
    try {
      // 1. Create Uploaded File record
      const { data: fileData, error: fileErr } = await supabase
        .from('uploaded_files')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          file_name: pendingFile.name,
          file_type: 'csv',
          file_size: pendingFile.size,
          storage_path: `simulated/${pendingFile.name}`,
          status: 'processing'
        })
        .select()
        .single();

      if (fileErr) throw fileErr;

      // 2. Create Import record
      const { data: importData, error: importErr } = await supabase
        .from('imports')
        .insert({
          organization_id: activeOrg.id,
          client_id: activeClient.id,
          file_id: fileData.id,
          provider_detected: parseResult.provider,
          source_type: parseResult.sourceType,
          row_count: parseResult.rowCount,
          status: 'pending_mapping'
        })
        .select()
        .single();

      if (importErr) throw importErr;

      // Redirect to mapping page
      navigate(`/files/${importData.id}/mapping`, { 
        state: { 
          headers: parseResult.headers, 
          previewRows: parseResult.rows,
          fileName: pendingFile.name,
          provider: parseResult.provider
        } 
      });

    } catch (err: any) {
      setError('Failed to initiate import: ' + err.message);
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
        <div className="p-4 bg-risk/5 border border-risk/20 rounded-xl flex gap-3 items-center animate-in shake-in">
          <AlertCircle className="w-5 h-5 text-risk shrink-0" />
          <span className="text-sm text-risk font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-xs text-risk hover:underline">Dismiss</button>
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
