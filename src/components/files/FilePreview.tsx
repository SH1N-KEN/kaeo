import React from 'react';
import { 
  FileText, 
  Table as TableIcon, 
  AlertTriangle, 
  ShieldCheck, 
  Zap,
  CheckCircle2,
  Settings2,
  Lock
} from 'lucide-react';
import type { ParseResult } from '../../lib/fileParser';
import type { MappingSuggestion } from '../../lib/mappingEngine';

interface FilePreviewProps {
  fileName: string;
  result: ParseResult;
  autoMapping: MappingSuggestion | null;
  onAction: () => void;
  onCancel: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ fileName, result, autoMapping, onAction, onCancel }) => {
  const isHighConfidence = autoMapping?.status === 'ready_to_import';
  const confidencePercent = Math.round((autoMapping?.confidence || 0) * 100);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">{fileName}</h3>
              <p className="text-sm text-muted-foreground">
                {result.rowCount} rows detected • {result.headers.length} columns
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-success/10 text-success text-xs font-bold rounded-full flex items-center gap-1.5 border border-success/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              {result.provider}
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Intelligence Panel */}
          <div className="md:col-span-1 space-y-6">
            <div className={`p-6 rounded-2xl border-2 shadow-sm ${isHighConfidence ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isHighConfidence ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Kaeo Intelligence</span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className={`text-xl font-bold ${isHighConfidence ? 'text-success' : 'text-warning'}`}>
                    {isHighConfidence ? 'Ready to Import' : 'Review Recommended'}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-mapping confidence: <span className="text-foreground font-bold">{confidencePercent}%</span>
                  </p>
                </div>

                <div className="w-full bg-muted/50 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${isHighConfidence ? 'bg-success' : 'bg-warning'}`} 
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>
                
                {autoMapping?.warnings.length ? (
                  <div className="space-y-2">
                    {autoMapping.warnings.map((w, i) => (
                      <div key={i} className="flex gap-2 text-[10px] leading-tight text-muted-foreground bg-background/50 p-2 rounded-lg border border-border/50">
                        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${isHighConfidence ? 'text-success/70' : 'text-warning'}`} />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[10px] text-success font-bold bg-success/10 p-2 rounded-lg border border-success/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    All required fields mapped confidently.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border rounded-xl p-5 space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Settings2 className="w-3 h-3" />
                Auto-Detected Fields
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.keys(autoMapping?.mapping || {}).map(key => (
                  <div key={key} className="px-2 py-1 bg-muted/50 border border-border/50 rounded-md text-[10px] font-mono font-medium">
                    {key}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Table Preview */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <TableIcon className="w-4 h-4" />
                Source Preview
              </h4>
              <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded">Showing first 20 rows</span>
            </div>
            
            <div className="border rounded-xl overflow-x-auto custom-scrollbar shadow-inner bg-background/50">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-muted/30">
                    {result.headers.map((h, i) => (
                      <th key={i} className="px-4 py-2.5 text-[10px] font-black text-muted-foreground border-b border-r last:border-r-0 whitespace-nowrap uppercase tracking-tighter">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      {result.headers.map((h, j) => (
                        <td key={j} className="px-4 py-2 text-xs border-b border-r last:border-r-0 text-muted-foreground/70 whitespace-nowrap">
                          {row[h]?.toString() || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="p-6 bg-muted/10 border-t flex items-center justify-between gap-8">
          <button 
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-bold hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
          >
            Cancel Ingestion
          </button>
          
          <div className="flex flex-col md:flex-row items-center gap-6">
            {isHighConfidence && (
              <div className="flex items-center gap-2 text-warning font-bold bg-warning/5 px-4 py-2 rounded-lg border border-warning/10 text-[10px] uppercase tracking-wider">
                <Lock className="w-3 h-3" />
                Transaction import starts in Phase 4
              </div>
            )}
            
            <div className="flex gap-4">
              {isHighConfidence ? (
                <button 
                  onClick={onAction}
                  className="px-10 py-3 bg-success text-white rounded-xl font-black text-sm flex items-center gap-2 hover:bg-success/90 shadow-xl shadow-success/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Import Transactions
                </button>
              ) : (
                <button 
                  onClick={onAction}
                  className="px-10 py-3 bg-primary text-white rounded-xl font-black text-sm flex items-center gap-2 hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Settings2 className="w-4 h-4" />
                  Review Mapping
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilePreview;
