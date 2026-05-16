import React from 'react';
import { FileText, Clock, ChevronRight } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';

interface HistoryItem {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  metadata?: {
    row_count?: number;
    provider_detected?: string;
  };
}

interface FileHistoryProps {
  history: HistoryItem[];
}

const FileHistory: React.FC<FileHistoryProps> = ({ history }) => {
  if (history.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-muted-foreground" />
          Recent Uploads
        </h3>
        <button className="text-sm text-primary hover:underline font-medium">View all</button>
      </div>

      <div className="grid gap-3">
        {history.map((item) => (
          <div 
            key={item.id} 
            className="group bg-card border border-border/50 rounded-xl p-4 flex items-center justify-between hover:border-primary/30 transition-all hover:shadow-md cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">{item.file_name}</h4>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  {new Date(item.created_at).toLocaleDateString()} • {item.metadata?.row_count || 0} rows
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <StatusBadge 
                status={
                  item.status === 'ready_to_import' || item.status === 'mapped' || item.status === 'imported' ? 'success' : 
                  item.status === 'failed' ? 'high' : 
                  'medium'
                } 
                label={
                  item.status === 'imported' ? 'IMPORTED' :
                  item.status === 'ready_to_import' ? 'READY TO IMPORT' :
                  item.status === 'review_mapping' ? 'REVIEW RECOMMENDED' :
                  item.status === 'mapping_required' ? 'MAPPING REQUIRED' :
                  item.status === 'parsed' ? 'PARSED' :
                  item.status.toUpperCase().replace('_', ' ')
                } 
              />
              <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileHistory;
