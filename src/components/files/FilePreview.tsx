import React from 'react';
import { 
  CheckCircle2, 
  ChevronRight, 
  FileText,
  Zap,
  Info,
  ShieldCheck,
  BrainCircuit
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

const FilePreview: React.FC<FilePreviewProps> = ({ 
  fileName, 
  result, 
  autoMapping,
  onAction,
  onCancel
}) => {
  const isHighConfidence = autoMapping && autoMapping.confidence >= 0.85;
  const isMediumConfidence = autoMapping && autoMapping.confidence < 0.85 && autoMapping.confidence >= 0.5;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border/50 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">{fileName}</h2>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-2">
                {result.rowCount} rows detected • {result.provider}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onCancel}
              className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={onAction}
              className="px-6 py-2.5 bg-foreground text-background rounded-xl font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-xl shadow-foreground/10"
            >
              {isHighConfidence ? 'Import Transactions' : 'Review Mapping'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Intelligence Status Card */}
        <div className="px-6 py-5 bg-primary/5 border-b border-border/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex gap-4 items-start">
              <div className={`p-2 rounded-lg shrink-0 ${isHighConfidence ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                {autoMapping?.source === 'ai' ? <BrainCircuit className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  Kaeo Intelligence: {isHighConfidence ? 'Auto-mapped' : 'Mapping Uncertain'}
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${isHighConfidence ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                    {autoMapping?.source === 'ai' ? 'AI Suggestion' : 'Rule Based'}
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground max-w-xl">
                  {isHighConfidence 
                    ? `Kaeo mapped this file automatically with ${Math.round(autoMapping.confidence * 100)}% confidence. Required fields were detected successfully.` 
                    : "Kaeo needs a quick review of your columns before importing. Some fields were ambiguous."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 shrink-0 bg-background/50 p-3 rounded-xl border border-border/50">
              <div className="text-center px-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Confidence</div>
                <div className="text-lg font-black text-foreground">{Math.round((autoMapping?.confidence || 0) * 100)}%</div>
              </div>
              <div className="w-px h-8 bg-border/50" />
              <div className="text-center px-4">
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Status</div>
                <div className={`text-xs font-bold ${isHighConfidence ? 'text-success' : 'text-warning'}`}>
                  {isHighConfidence ? 'Ready to Import' : 'Review Required'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/30 border-b border-border/30">
              <tr>
                {result.headers.map((h, i) => {
                  const mappedTo = Object.entries(autoMapping?.mapping || {}).find(([_, col]) => col === h)?.[0];
                  return (
                    <th key={i} className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground truncate max-w-[150px]">{h}</div>
                        {mappedTo ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                            <span className="text-[10px] font-bold text-foreground bg-success/10 px-1.5 py-0.5 rounded border border-success/20 truncate max-w-[120px]">
                              {mappedTo.replace('_', ' ')}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                            <span className="text-[10px] font-bold text-muted-foreground/40 italic">Ignored</span>
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {result.rows.slice(0, 5).map((row, i) => (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  {result.headers.map((h, j) => (
                    <td key={j} className="px-6 py-4 text-xs font-medium text-muted-foreground truncate max-w-[200px]">
                      {row[h]?.toString() || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 bg-muted/10 border-t border-border/20 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground font-medium italic">Showing first 5 rows for validation</p>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-success" /> Mapping Active
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                <Info className="w-3 h-3 text-primary" /> Valid Data Formats
              </div>
            </div>
          </div>
        </div>
      </div>

      {isMediumConfidence && (
        <div className="p-4 bg-warning/5 border border-warning/10 rounded-2xl flex gap-3 items-center">
          <Zap className="w-5 h-5 text-warning/70" />
          <div className="flex-1">
            <p className="text-xs font-bold text-warning/80 tracking-tight">Intelligence Recommendation</p>
            <p className="text-[10px] text-warning/60 mt-0.5">Confidence is {Math.round((autoMapping?.confidence || 0) * 100)}%. We recommend a manual review of mappings before importing to ensure absolute ledger accuracy.</p>
          </div>
          <button 
            onClick={onAction}
            className="px-4 py-2 bg-warning/10 text-warning text-[10px] font-black uppercase rounded-lg border border-warning/20 hover:bg-warning/20 transition-all"
          >
            Review Now
          </button>
        </div>
      )}
    </div>
  );
};

export default FilePreview;
