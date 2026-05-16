import React, { useState } from 'react';
import { 
  AlertCircle, 
  Trash2, 
  X, 
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ClearTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientName: string;
  clientId: string;
  orgId: string;
  transactionCount: number;
}

const ClearTransactionsModal: React.FC<ClearTransactionsModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  clientName, 
  clientId, 
  orgId,
  transactionCount 
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClear = async () => {
    if (confirmationText !== 'CLEAR') return;

    setLoading(true);
    setError(null);

    try {
      console.log(`[Danger Zone] Clearing transactions for ${clientName} (${clientId})`);
      
      // 1. Delete transactions scoped by Org and Client
      const { error: deleteErr } = await supabase
        .from('transactions')
        .delete()
        .eq('organization_id', orgId)
        .eq('client_id', clientId);

      if (deleteErr) throw deleteErr;

      // 2. Reset imports/uploaded_files status to ready_to_import (Optional but useful)
      // Reset imports
      await supabase
        .from('imports')
        .update({ status: 'ready_to_import' })
        .eq('organization_id', orgId)
        .eq('client_id', clientId)
        .eq('status', 'imported');

      // Reset uploaded files
      await supabase
        .from('uploaded_files')
        .update({ status: 'ready_to_import' })
        .eq('organization_id', orgId)
        .eq('client_id', clientId)
        .eq('status', 'imported');

      // TODO: Implement audit logging once the table is defined
      // event_type: transactions_cleared
      // event_data: { deleted_count: transactionCount, client_id: clientId, client_name: clientName }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[Danger Zone] Clear failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="relative bg-card border-2 border-risk/20 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
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
            <h2 className="text-2xl font-black text-foreground">Clear transactions?</h2>
            <p className="text-muted-foreground leading-relaxed">
              This will permanently delete <span className="text-foreground font-bold">{transactionCount} transactions</span> for <span className="text-foreground font-bold">{clientName}</span>. 
              This action <span className="text-risk font-black">cannot be undone</span>.
            </p>
          </div>

          <div className="p-4 bg-risk/5 border border-risk/20 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-risk font-bold text-xs uppercase tracking-widest">
              <AlertCircle className="w-4 h-4" />
              Critical Warning
            </div>
            <p className="text-xs text-risk/80 leading-relaxed">
              Imported files and mappings will remain in the system but will be reset to <strong>Ready to Import</strong>. 
              You can re-import them later from the Files page.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Type <span className="text-foreground">CLEAR</span> to confirm
              </label>
              <input 
                type="text" 
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="Type CLEAR"
                className="w-full bg-muted/50 border-2 border-border focus:border-risk outline-none rounded-xl px-4 py-3 font-bold transition-all"
              />
            </div>

            {error && (
              <div className="p-3 bg-risk/5 border border-risk/20 rounded-xl text-risk text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button 
                onClick={onClose}
                className="flex-1 py-4 text-sm font-bold bg-muted hover:bg-muted/80 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleClear}
                disabled={confirmationText !== 'CLEAR' || loading}
                className={`flex-1 py-4 text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl transition-all ${
                  confirmationText === 'CLEAR' && !loading
                  ? 'bg-risk text-white shadow-risk/20 hover:scale-[1.02] active:scale-[0.98]' 
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Trash2 className="w-5 h-5" /> Clear Data</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClearTransactionsModal;
