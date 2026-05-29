import React, { useState } from 'react';
import { 
  AlertCircle, 
  RotateCcw, 
  X, 
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { resetClientFinanceData } from '../../lib/resetClientFinanceData';

interface ResetClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientName: string;
  clientId: string;
  orgId: string;
}

const ResetClientModal: React.FC<ResetClientModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  clientName, 
  clientId, 
  orgId 
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReset = async () => {
    if (confirmationText !== 'RESET') return;

    setLoading(true);
    setError(null);

    try {
      await resetClientFinanceData(orgId, clientId);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[Reset] Reset failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="relative frosted-modal w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-risk/10 rounded-2xl flex items-center justify-center text-risk">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-foreground tracking-tighter">Reset client data?</h2>
            <p className="text-muted-foreground leading-relaxed">
              This will delete all uploaded files, imports, mappings, and transactions for <span className="text-foreground font-bold">{clientName}</span>. Your workspace and client settings will remain.
            </p>
          </div>

          <div className="p-4 bg-risk/5 border border-risk/20 rounded-2xl flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-risk shrink-0 mt-0.5" />
            <p className="text-xs text-risk/80 leading-relaxed font-medium">
              This action <span className="font-bold">cannot be undone</span>. All financial history for this client will be wiped clean.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Type <span className="text-foreground">RESET</span> to confirm
              </label>
              <input 
                type="text" 
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Type RESET"
                className="w-full bg-muted/50 border border-border focus:border-risk outline-none rounded-xl px-4 py-3 font-bold transition-all text-sm uppercase"
              />
            </div>

            {error && (
              <div className="p-3 bg-risk/5 border border-risk/20 rounded-xl text-risk text-[10px] font-bold flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button 
                onClick={onClose}
                className="flex-1 py-3.5 text-sm font-bold bg-muted hover:bg-muted/80 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleReset}
                disabled={confirmationText !== 'RESET' || loading}
                className={`flex-1 py-3.5 text-sm font-black rounded-2xl flex items-center justify-center gap-2 transition-all ${
                  confirmationText === 'RESET' && !loading
                  ? 'bg-risk text-white hover:opacity-90 shadow-lg shadow-risk/20' 
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RotateCcw className="w-4 h-4" /> Reset Data</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetClientModal;
