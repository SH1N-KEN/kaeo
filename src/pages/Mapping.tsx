import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Check, 
  AlertCircle, 
  Zap, 
  Settings2,
  Save,
  FileText,
  Loader2
} from 'lucide-react';
import { TARGET_FIELDS, suggestMappingFromColumns, calculateMappingConfidence, validateMapping } from '../lib/mappingEngine';
import { supabase } from '../lib/supabase';

const Mapping: React.FC = () => {
  const { importId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [importData, setImportData] = useState<{
    headers: string[];
    previewRows: any[];
    fileName: string;
    provider: string;
    orgId: string;
    clientId: string;
  } | null>(null);
  
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [confidence, setConfidence] = useState(0);

  const fetchImportData = useCallback(async () => {
    if (!importId) return;
    
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('imports')
        .select('*, file_id(file_name)')
        .eq('id', importId)
        .single();
      
      if (fetchErr) throw fetchErr;
      if (!data) throw new Error('Import not found');

      const payload = {
        headers: data.raw_columns_json || [],
        previewRows: data.preview_rows_json || [],
        fileName: data.file_id?.file_name || 'Finance File',
        provider: data.provider_detected || 'Unknown',
        orgId: data.organization_id,
        clientId: data.client_id
      };

      setImportData(payload);
      
      const suggestion = suggestMappingFromColumns(payload.headers);
      setMapping(suggestion.mapping);
      setConfidence(Math.round(suggestion.confidence * 100));

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [importId]);

  useEffect(() => {
    fetchImportData();
  }, [fetchImportData]);

  const handleSaveMapping = async () => {
    if (!importData) return;
    const validationErrors = validateMapping(mapping);
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: currentImport } = await supabase.from('imports').select('status').eq('id', importId).single();
      if (currentImport?.status === 'imported') {
        throw new Error('This file has already been imported.');
      }

      // Check if mappings already exist to perform upsert or update to prevent primary key errors
      const { data: existingMapping } = await supabase
        .from('import_mappings')
        .select('id')
        .eq('import_id', importId)
        .limit(1);

      if (existingMapping && existingMapping.length > 0) {
        const { error: mappingErr } = await supabase
          .from('import_mappings')
          .update({
            confirmed_mapping_json: mapping,
            confirmed_by: (await supabase.auth.getUser()).data.user?.id,
            confirmed_at: new Date().toISOString()
          })
          .eq('import_id', importId);

        if (mappingErr) throw mappingErr;
      } else {
        const { error: mappingErr } = await supabase
          .from('import_mappings')
          .insert({
            organization_id: importData.orgId,
            client_id: importData.clientId,
            import_id: importId,
            confirmed_mapping_json: mapping,
            confirmed_by: (await supabase.auth.getUser()).data.user?.id,
            confirmed_at: new Date().toISOString()
          });

        if (mappingErr) throw mappingErr;
      }

      const { error: importErr } = await supabase
        .from('imports')
        .update({ 
          status: 'ready_to_import',
          ingestion_confidence: confidence / 100
        })
        .eq('id', importId);

      if (importErr) throw importErr;

      navigate('/files', { state: { success: 'Mapping saved successfully! Ready to import transactions.' } });

    } catch (err: any) {
      setError('Failed to save mapping: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-foreground" />
        <p className="text-muted-foreground animate-pulse font-medium">Loading mapping workspace...</p>
      </div>
    );
  }

  if (error || !importData) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <AlertCircle className="w-12 h-12 text-risk mb-4" />
        <h2 className="text-xl font-bold mb-2">Import preview not found</h2>
        <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
        <button onClick={() => navigate('/files')} className="px-6 py-2 bg-muted rounded-md hover:bg-muted/80 transition-colors font-semibold text-xs cursor-pointer">
          Back to Files
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/files')}
            className="p-2 hover:bg-muted rounded-md transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">Field Mapping</h1>
              <div className="px-2 py-0.5 bg-muted text-foreground text-[10px] font-black rounded-md border border-border uppercase tracking-widest">
                Intelligence Engine
              </div>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" /> {importData.fileName} • Detected: <span className="text-foreground font-semibold">{importData.provider}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Mapping Confidence</div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-muted rounded-md overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${confidence > 80 ? 'bg-emerald-500' : confidence > 60 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="text-xs font-black">{confidence}%</span>
            </div>
          </div>
          <button
            disabled={saving}
            onClick={handleSaveMapping}
            className="px-6 py-3 bg-foreground text-background rounded-md font-bold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 text-xs cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Confirm Mapping</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl shadow-none overflow-hidden">
            <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2 text-foreground">
                <Settings2 className="w-5 h-5 text-muted-foreground" />
                Schema Mapping
              </h2>
              <button 
                onClick={() => {
                  const suggestion = suggestMappingFromColumns(importData.headers);
                  setMapping(suggestion.mapping);
                  setConfidence(Math.round(suggestion.confidence * 100));
                }}
                className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                <Zap className="w-3 h-3" /> Re-run Suggestion
              </button>
            </div>
            <div className="p-0">
              <div className="grid grid-cols-2 bg-muted/30 px-6 py-3 border-b border-border">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Kaeo Field</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-4 border-l border-border">Source Column</div>
              </div>
              <div className="divide-y divide-border/50">
                {TARGET_FIELDS.map((field) => (
                  <div key={field.id} className="grid grid-cols-2 group hover:bg-muted/30 transition-colors">
                    <div className="px-6 py-4 flex flex-col justify-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{field.label}</span>
                        {field.required && (
                          <span className="text-[8px] bg-risk/10 text-risk px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tighter">Required</span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">{field.id}</span>
                    </div>
                    <div className="px-6 py-4 border-l border-border flex items-center gap-3">
                      <select
                        className={`flex-1 bg-muted/50 border rounded-md px-3 py-2 text-sm focus:border-neutral-500 outline-none transition-all ${mapping[field.id] ? 'border-neutral-500' : 'border-border'}`}
                        value={mapping[field.id] || ''}
                        onChange={(e) => {
                          const newMapping = { ...mapping, [field.id]: e.target.value };
                          setMapping(newMapping);
                          setConfidence(calculateMappingConfidence(newMapping, importData.headers));
                        }}
                      >
                        <option value="">(Ignore Field)</option>
                        {importData.headers.map((h, i) => (
                          <option key={i} value={h}>{h}</option>
                        ))}
                      </select>
                      {mapping[field.id] && <div className="w-6 h-6 bg-muted text-foreground rounded-md flex items-center justify-center shrink-0 border border-border"><Check className="w-4 h-4" /></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-none">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-foreground">
              <Zap className="w-5 h-5 text-muted-foreground" />
              Sample Values
            </h3>
            <div className="space-y-4">
              {TARGET_FIELDS.slice(0, 5).map(f => {
                const mappedCol = mapping[f.id];
                const sampleValue = mappedCol && importData.previewRows[0] ? importData.previewRows[0][mappedCol] : null;
                return (
                  <div key={f.id} className="p-3 bg-muted/30 rounded-md border border-border/50">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{f.label}</div>
                    <div className="text-sm font-mono truncate text-foreground">{sampleValue?.toString() || '-'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Mapping;
