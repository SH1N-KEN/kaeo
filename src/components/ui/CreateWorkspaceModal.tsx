import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Building2, UserSquare2, Check } from 'lucide-react';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, type: 'business' | 'accountant') => Promise<any>;
  initialType?: 'business' | 'accountant';
}

const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreate,
  initialType = 'business'
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'business' | 'accountant'>(initialType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await onCreate(name, type);
      if (result) {
        setName('');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-card border rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 fade-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0 bg-card/80 backdrop-blur-md sticky top-0 z-10">
          <h2 className="text-xl font-bold">Create New Workspace</h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {error && (
            <div className="p-4 bg-risk/5 border border-risk/20 rounded-xl flex gap-3 items-start animate-in shake-in">
              <AlertCircle className="w-5 h-5 text-risk shrink-0 mt-0.5" />
              <span className="text-sm text-risk font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Workspace Type</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType('business')}
                className={`flex flex-col items-center gap-3 p-4 rounded-xl border transition-all ${type === 'business' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'hover:bg-muted border-border'}`}
              >
                <Building2 className={`w-6 h-6 ${type === 'business' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">Business</span>
              </button>
              <button
                type="button"
                onClick={() => setType('accountant')}
                className={`flex flex-col items-center gap-3 p-4 rounded-xl border transition-all ${type === 'accountant' ? 'bg-ocean-mist/5 border-ocean-mist ring-1 ring-ocean-mist' : 'hover:bg-muted border-border'}`}
              >
                <UserSquare2 className={`w-6 h-6 ${type === 'accountant' ? 'text-ocean-mist' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">Accountant</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Workspace Name</label>
            <input
              autoFocus
              type="text"
              placeholder={type === 'business' ? 'e.g. Acme Corp' : 'e.g. Sharma & Associates'}
              className="w-full px-4 py-3 rounded-xl border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t shrink-0 bg-muted/20 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-card border rounded-xl font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Create Workspace</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateWorkspaceModal;
