import React from 'react';
import { 
  FileText, 
  Table as TableIcon, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowRight,
  Zap,
  CheckCircle2,
  Settings2
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

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Intelligence Panel */}
          <div className="md:col-span-1 space-y-4">
            <div className={`p-5 rounded-2xl border ${isHighConfidence ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className={`w-4 h-4 ${isHighConfidence ? 'text-success' : 'text-warning'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider">Kaeo Intelligence</span>
                </div>
                <span className={`text-xs font-bold ${isHighConfidence ? 'text-success' : 'text-warning'}`}>
                  {confidencePercent}% Confidence
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mapping Status</span>
                  <span className={`font-bold ${isHighConfidence ? 'text-success' : 'text-warning'}`}>
                    {autoMapping?.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                
                {autoMapping?.warnings.length ? (
                  <div className="pt-2 border-t border-current/10 space-y-2">
                    {autoMapping.warnings.map((w, i) => (
                      <div key={i} className="flex gap-2 text-[10px] leading-tight">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pt-2 border-t border-success/10 flex items-center gap-2 text-[10px] text-success font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    All required fields detected confidently.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-xl border space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Detected Fields</h4>
              <div className="flex flex-wrap gap-2">
                {Object.keys(autoMapping?.mapping || {}).map(key => (
                  <div key={key} className="px-2 py-0.5 bg-background border rounded text-[10px] font-mono">
                    {key}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Table Preview */}
          <div className="md:col-span-2 space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TableIcon className="w-4 h-4" />
              Data Preview
            </h4>
            
            <div className="border rounded-xl overflow-x-auto custom-scrollbar max-h-[300px]">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-muted/50 sticky top-0 z-10">
                    {result.headers.map((h, i) => (
                      <th key={i} className="px-4 py-2 text-[10px] font-bold text-muted-foreground border-b border-r last:border-r-0 whitespace-nowrap bg-muted/50">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      {result.headers.map((h, j) => (
                        <td key={j} className="px-4 py-2 text-xs border-b border-r last:border-r-0 text-muted-foreground/80 whitespace-nowrap">
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

        <div className="p-6 bg-muted/20 border-t flex items-center justify-between">
          <button 
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-semibold hover:bg-muted rounded-xl transition-colors"
          >
            Cancel
          </button>
          
          <div className="flex gap-4">
            {isHighConfidence ? (
              <button 
                onClick={onAction}
                className="px-8 py-2.5 bg-success text-white rounded-xl font-bold flex items-center gap-2 hover:bg-success/90 shadow-lg shadow-success/20 transition-all hover:translate-x-1"
              >
                <CheckCircle2 className="w-4 h-4" />
                Import Transactions
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={onAction}
                className="px-8 py-2.5 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:translate-x-1"
              >
                <Settings2 className="w-4 h-4" />
                Review Mapping
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilePreview;
