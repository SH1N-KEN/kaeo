import React, { useCallback, useState } from 'react';
import { Upload, Loader2, CheckCircle2, Clock } from 'lucide-react';

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
        accept=".csv,.xlsx,.xls"
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
          <h3 className="text-xl font-bold mb-1">Upload CSV or XLSX Statements</h3>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Drag and drop your bank statement or payment gateway export here.
          </p>
        </div>

        <label 
          htmlFor="file-upload"
          className="btn-primary cursor-pointer"
        >
          Select File
        </label>

        <div className="flex flex-wrap justify-center gap-3 text-[10px] font-bold uppercase tracking-widest pt-4">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border" style={{ background: 'rgba(15,118,110,0.08)', color: 'var(--primary)', border: '1px solid rgba(15,118,110,0.20)' }}>
            <CheckCircle2 className="w-3 h-3" />
            <span>CSV</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border" style={{ background: 'rgba(15,118,110,0.08)', color: 'var(--primary)', border: '1px solid rgba(15,118,110,0.20)' }}>
            <CheckCircle2 className="w-3 h-3" />
            <span>XLSX / XLS</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
            <Clock className="w-3 h-3" />
            <span>PDF statements — Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadZone;
