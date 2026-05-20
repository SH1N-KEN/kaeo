import React, { useCallback, useState } from 'react';
import { Upload, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  loading?: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, loading }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div 
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-2xl p-12 transition-all premium-glass ${
        dragActive 
          ? 'border-primary bg-primary/5 scale-[1.01]' 
          : 'border-border/30 hover:border-primary/50 hover:bg-white/5'
      } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept=".csv,.xlsx,.xls,.pdf"
        onChange={handleChange}
      />
      
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-2">
          {loading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <Upload className="w-8 h-8" />
          )}
        </div>
        
        <div>
          <h3 className="text-xl font-bold mb-1">Upload Finance Files</h3>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Drag and drop your bank statements or gateway reports here.
          </p>
        </div>

        <label 
          htmlFor="file-upload"
          className="px-6 py-2.5 bg-foreground text-background rounded-xl font-semibold hover:bg-foreground/90 transition-colors cursor-pointer"
        >
          Select Files
        </label>

        <div className="flex flex-wrap justify-center gap-4 text-[10px] text-muted-foreground font-bold uppercase tracking-widest pt-4">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 text-primary rounded-full border border-primary/10">
            <CheckCircle2 className="w-3 h-3 text-primary" />
            <span>CSV Support</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/5 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/10">
            <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>XLSX Beta</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-muted text-muted-foreground rounded-full border border-border/30 opacity-75">
            <AlertCircle className="w-3 h-3 text-muted-foreground" />
            <span>PDF Coming Soon</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadZone;
