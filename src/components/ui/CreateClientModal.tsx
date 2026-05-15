import React, { useState } from 'react';
import { X, Loader2, AlertCircle, Briefcase, Check } from 'lucide-react';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, industry?: string, currency?: string) => Promise<any>;
}

const CreateClientModal: React.FC<CreateClientModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreate 
}) => {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await onCreate(name, industry, currency);
      if (result) {
        setName('');
        setIndustry('');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Add New Client</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-risk/5 border border-risk/20 rounded-xl flex gap-3 items-start animate-in shake-in">
              <AlertCircle className="w-5 h-5 text-risk shrink-0 mt-0.5" />
              <span className="text-sm text-risk font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Client Name</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Acme Innovations"
              className="w-full px-4 py-3 rounded-xl border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Industry (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Technology, Healthcare"
              className="w-full px-4 py-3 rounded-xl border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Base Currency</label>
            <select
              className="w-full px-4 py-3 rounded-xl border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-muted/50 rounded-xl font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Add Client</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateClientModal;
