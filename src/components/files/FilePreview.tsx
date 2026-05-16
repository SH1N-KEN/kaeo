import React from 'react';
import { 
  FileText, 
  Table as TableIcon, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowRight
} from 'lucide-react';
import type { ParseResult } from '../../lib/fileParser';

interface FilePreviewProps {
  fileName: string;
  result: ParseResult;
  onContinue: () => void;
  onCancel: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ fileName, result, onContinue, onCancel }) => {
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
            <div className="px-3 py-1 bg-info/10 text-info text-xs font-bold rounded-full border border-info/20">
              {result.sourceType.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="p-6">
          {result.warnings.length > 0 && (
            <div className="mb-6 space-y-2">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-warning bg-warning/5 p-3 rounded-lg border border-warning/10">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <TableIcon className="w-4 h-4" />
                Data Preview (First 20 rows)
              </h4>
            </div>
            
            <div className="border rounded-xl overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-muted/50">
                    {result.headers.map((h, i) => (
                      <th key={i} className="px-4 py-3 text-xs font-bold text-muted-foreground border-b border-r last:border-r-0 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      {result.headers.map((h, j) => (
                        <td key={j} className="px-4 py-2.5 text-sm border-b border-r last:border-r-0 text-muted-foreground/80 whitespace-nowrap overflow-hidden max-w-[200px] text-ellipsis">
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
          <button 
            onClick={onContinue}
            className="px-8 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:translate-x-1"
          >
            Continue to Mapping
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilePreview;
