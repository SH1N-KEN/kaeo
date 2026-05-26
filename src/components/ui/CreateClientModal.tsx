import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Briefcase, Check } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useWorkspace } from '../../hooks/useWorkspace';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, industry?: string, currency?: string, metadata?: any) => Promise<any>;
  clientToEdit?: any;
  onUpdate?: (id: string, name: string, industry?: string, metadata?: any) => Promise<any>;
}

const CreateClientModal: React.FC<CreateClientModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreate,
  clientToEdit,
  onUpdate
}) => {
  const { accountMode } = useWorkspace();
  const isBusiness = accountMode === 'business_owner';

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const currency = 'INR';
  const [spendRange, setSpendRange] = useState('under_10k');
  const [accountingTool, setAccountingTool] = useState('Tally');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (clientToEdit) {
        setName(clientToEdit.name || '');
        setIndustry(clientToEdit.industry || '');
        setSpendRange(clientToEdit.metadata?.monthly_spend_range || 'under_10k');
        setAccountingTool(clientToEdit.metadata?.accounting_tools?.[0] || 'Tally');
        setNotes(clientToEdit.metadata?.notes || '');
      } else {
        setName('');
        setIndustry('');
        setSpendRange('under_10k');
        setAccountingTool('Tally');
        setNotes('');
      }
    }
  }, [clientToEdit, isOpen]);

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
    if (!name.trim() || !industry.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const metadata = {
        monthly_spend_range: spendRange,
        accounting_tools: [accountingTool],
        notes: notes
      };
      let result;
      if (clientToEdit && onUpdate) {
        result = await onUpdate(clientToEdit.id, name, industry, metadata);
      } else {
        result = await onCreate(name, industry, currency, metadata);
      }
      if (result) {
        setName('');
        setIndustry('');
        setSpendRange('under_10k');
        setAccountingTool('Tally');
        setNotes('');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save business profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start md:justify-center p-4 md:p-8 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
        {/* Backdrop click area */}
        <div 
          className="absolute inset-0 z-0"
          onClick={onClose}
        />
        
        {/* Modal Content */}
        <div className="relative z-10 bg-card border rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 fade-in duration-200 overflow-hidden flex flex-col my-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b shrink-0 bg-card/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">{isBusiness ? 'Set up business profile' : 'Add Client Business'}</h2>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar max-h-[60vh] md:max-h-[70vh]">
            {error && (
              <div className="p-4 bg-risk/5 border border-risk/20 rounded-xl flex gap-3 items-start animate-in shake-in">
                <AlertCircle className="w-5 h-5 text-risk shrink-0 mt-0.5" />
                <span className="text-sm text-risk font-medium">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                {isBusiness ? 'Business Name' : 'Client Business Name'}
              </label>
              <input
                autoFocus
                type="text"
                placeholder={isBusiness ? 'e.g. Acme Software Pvt Ltd' : 'e.g. Acme Innovations'}
                className="w-full px-4 py-3 rounded-xl border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Industry</label>
              <input
                type="text"
                placeholder="e.g. Technology, Healthcare, E-commerce"
                className="w-full px-4 py-3 rounded-xl border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Primary Accounting Tool</label>
              <div className="relative">
                <select
                  className="w-full px-4 py-3 rounded-xl border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
                  value={accountingTool}
                  onChange={(e) => setAccountingTool(e.target.value)}
                >
                  <option value="Tally">Tally</option>
                  <option value="Zoho Books">Zoho Books</option>
                  <option value="Excel/Sheets">Excel / Google Sheets</option>
                  <option value="Razorpay">Razorpay</option>
                  <option value="Other">Other</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                  <X className="w-4 h-4 rotate-45" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border/20 my-2" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Optional Details</h4>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Monthly Spend (Optional)</label>
                <div className="relative">
                  <select
                    className="w-full px-4 py-3 rounded-xl border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
                    value={spendRange}
                    onChange={(e) => setSpendRange(e.target.value)}
                  >
                    <option value="under_10k">Under ₹10k</option>
                    <option value="10k_50k">₹10k - ₹50k</option>
                    <option value="50k_2l">₹50k - ₹2L</option>
                    <option value="above_2l">Above ₹2L</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                    <X className="w-4 h-4 rotate-45" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Notes / Context (Optional)</label>
              <textarea
                placeholder="Add special instructions, client background, or tax rules..."
                className="w-full px-4 py-3 rounded-xl border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50 h-20 resize-none"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </form>

          {/* Footer */}
          <div className="p-6 border-t shrink-0 bg-muted/20 flex gap-3 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-card border rounded-xl font-medium hover:bg-muted transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !name.trim() || !industry.trim()}
              className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 text-xs"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" /> 
                  {isBusiness ? 'Save Business Profile' : 'Add Client Business'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default CreateClientModal;
