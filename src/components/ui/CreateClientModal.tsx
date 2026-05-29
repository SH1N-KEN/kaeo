import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Briefcase, Check, ChevronDown, ChevronUp, Sparkles, Building2 } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useWorkspace } from '../../hooks/useWorkspace';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';

interface CreateClientModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onCreate?: (name: string, industry?: string, currency?: string, metadata?: any) => Promise<any>;
  clientToEdit?: any;
  onUpdate?: (id: string, name: string, industry?: string, metadata?: any) => Promise<any>;
  mode?: 'create_business' | 'edit_business' | 'create_client_business' | 'edit_client_business';
}

const CreateClientModal: React.FC<CreateClientModalProps> = ({ 
  isOpen: propIsOpen, 
  onClose: propOnClose, 
  onCreate: propOnCreate,
  clientToEdit: propClientToEdit,
  onUpdate: propOnUpdate,
  mode: propMode
}) => {
  const workspace = useWorkspace();
  const { toast } = useToast();

  const isOpen = propIsOpen !== undefined ? propIsOpen : workspace.isCreateModalOpen;
  const onClose = propOnClose || (() => workspace.setIsCreateModalOpen(false));
  const clientToEdit = propClientToEdit || workspace.clientToEdit;
  
  const mode = propMode || workspace.modalMode || (
    clientToEdit
      ? (workspace.accountMode === 'business_owner' ? 'edit_business' : 'edit_client_business')
      : (workspace.accountMode === 'business_owner' ? 'create_business' : 'create_client_business')
  );

  const isBusiness = mode === 'create_business' || mode === 'edit_business';
  const isEditing = mode === 'edit_business' || mode === 'edit_client_business';

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const currency = 'INR';
  const [spendRange, setSpendRange] = useState('under_10k');
  const [accountingTool, setAccountingTool] = useState('Tally');
  const [teamSize, setTeamSize] = useState('2-10');
  const [notes, setNotes] = useState('');
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (clientToEdit) {
        setName(clientToEdit.name || '');
        setIndustry(clientToEdit.industry || '');
        setSpendRange(clientToEdit.metadata?.monthly_spend_range || 'under_10k');
        setAccountingTool(clientToEdit.metadata?.accounting_tools?.[0] || 'Tally');
        setTeamSize(clientToEdit.metadata?.team_size || '2-10');
        setNotes(clientToEdit.metadata?.notes || '');
        setPainPoints(clientToEdit.metadata?.pain_points || []);
      } else {
        setName('');
        setIndustry('');
        setSpendRange('under_10k');
        setAccountingTool('Tally');
        setTeamSize('2-10');
        setNotes('');
        setPainPoints([]);
      }
      setShowAdvanced(false);
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
    if (!name.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const metadata = {
        monthly_spend_range: spendRange,
        accounting_tools: [accountingTool],
        team_size: teamSize,
        notes: notes,
        pain_points: painPoints
      };
      
      let result;
      if (isEditing && clientToEdit) {
        if (propOnUpdate) {
          result = await propOnUpdate(clientToEdit.id, name, industry || undefined, metadata);
        } else {
          // Direct update via Supabase if used globally
          const { error: dbErr } = await supabase
            .from('clients')
            .update({ name, industry: industry || null })
            .eq('id', clientToEdit.id);
          if (dbErr) throw dbErr;
          
          await workspace.updateClientMetadata(clientToEdit.id, metadata);
          
          // Also update activeOrg name if business_owner
          if (isBusiness && workspace.activeOrg) {
            await supabase
              .from('organizations')
              .update({ name })
              .eq('id', workspace.activeOrg.id);
          }
          
          toast(isBusiness ? 'Business profile updated successfully' : 'Client business updated successfully', 'success');
          workspace.refresh();
          result = true;
        }
      } else {
        if (propOnCreate) {
          result = await propOnCreate(name, industry || undefined, currency, metadata);
        } else {
          // Direct create via Supabase using active organization
          if (!workspace.activeOrg) {
            throw new Error('No active workspace/organization selected.');
          }
          result = await workspace.createClient(name, workspace.activeOrg.id, industry || undefined, currency, metadata);
          if (result) {
            toast(isBusiness ? 'Business created.' : 'Client business added.', 'success');
          }
        }
      }
      
      if (result) {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save business profile');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (isEditing) {
      return isBusiness ? 'Edit business profile' : 'Edit client business';
    }
    return isBusiness ? 'Add business' : 'Add client business';
  };

  const getSubmitButtonLabel = () => {
    if (loading) return 'Saving...';
    if (isEditing) return 'Save changes';
    return isBusiness ? 'Create business' : 'Add client business';
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start md:justify-center p-4 md:p-8 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="absolute inset-0 z-0" onClick={onClose} />
        
        <div className="relative z-10 frosted-modal w-full max-w-lg shadow-2xl animate-in zoom-in-95 fade-in duration-200 overflow-hidden flex flex-col my-auto border-border/55">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border/10 shrink-0 bg-transparent sticky top-0 z-20">
            <div className="flex items-center gap-2">
              {isBusiness ? (
                <Building2 className="w-5 h-5 text-teal-400" />
              ) : (
                <Briefcase className="w-5 h-5 text-teal-400" />
              )}
              <h2 className="text-lg font-bold text-foreground">{getTitle()}</h2>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar max-h-[60vh] md:max-h-[70vh]">
            {error && (
              <div className="p-4 bg-risk/5 border border-risk/20 rounded-xl flex gap-3 items-start animate-in shake-in">
                <AlertCircle className="w-5 h-5 text-risk shrink-0 mt-0.5" />
                <span className="text-xs text-risk font-medium">{error}</span>
              </div>
            )}

            {/* Name Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">
                {isBusiness ? 'Business Name' : 'Client Business Name'} <span className="text-teal-400">*</span>
              </label>
              <input
                autoFocus
                type="text"
                maxLength={100}
                placeholder={isBusiness ? 'e.g. Acme Software Pvt Ltd' : 'e.g. Acme Innovations'}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/30 text-sm font-semibold"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Basic Optional Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Industry */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Industry (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. SaaS, E-commerce"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/30 text-sm font-semibold"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </div>

              {/* Accounting Tool */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Accounting Tool (Optional)</label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-[#161a18] text-foreground focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-semibold"
                  value={accountingTool}
                  onChange={(e) => setAccountingTool(e.target.value)}
                >
                  <option value="Tally">Tally</option>
                  <option value="Zoho Books">Zoho Books</option>
                  <option value="Excel/Sheets">Excel / Google Sheets</option>
                  <option value="Razorpay">Razorpay</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Collapsible Section for Libby Context */}
            <div className="border border-border/40 rounded-xl overflow-hidden mt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between p-3.5 bg-muted/10 hover:bg-muted/20 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-bold text-foreground">Add more context for Libby</span>
                </div>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {showAdvanced && (
                <div className="p-4 bg-muted/5 border-t border-border/20 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Monthly Spend */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Monthly Spend Range</label>
                      <select
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-[#161a18] text-foreground focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-semibold"
                        value={spendRange}
                        onChange={(e) => setSpendRange(e.target.value)}
                      >
                        <option value="under_10k">Under ₹10k</option>
                        <option value="10k_50k">₹10k - ₹50k</option>
                        <option value="50k_2l">₹50k - ₹2L</option>
                        <option value="above_2l">Above ₹2L</option>
                      </select>
                    </div>

                    {/* Team Size */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Team Size</label>
                      <select
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-[#161a18] text-foreground focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-semibold"
                        value={teamSize}
                        onChange={(e) => setTeamSize(e.target.value)}
                      >
                        <option value="1">1 (Solo Founder)</option>
                        <option value="2-10">2 - 10 employees</option>
                        <option value="11-50">11 - 50 employees</option>
                        <option value="50+">50+ employees</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Notes / Libby Context</label>
                    <textarea
                      placeholder="Add special instructions, client background, or tax rules..."
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/30 h-20 resize-none text-xs font-semibold"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="p-6 border-t border-border/10 shrink-0 bg-muted/10 flex gap-3 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-card border border-border rounded-xl font-bold hover:bg-muted transition-colors text-xs text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !name.trim()}
              className="flex-1 py-2.5 px-4 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/95 transition-all shadow-lg shadow-primary/10 disabled:opacity-50 text-xs cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> 
                  {getSubmitButtonLabel()}
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
