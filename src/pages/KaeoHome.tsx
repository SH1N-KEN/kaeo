import React, { useState } from 'react';
import { 
  Building2, 
  UserSquare2, 
  ArrowRight, 
  PlayCircle,
  Loader2,
  Check
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';

const KaeoHome: React.FC = () => {
  const { createOrganization, loading } = useWorkspace();
  const [orgName, setOrgName] = useState('');
  const [showInput, setShowInput] = useState<'business' | 'accountant' | null>(null);

  const handleCreate = async () => {
    if (!orgName.trim() || !showInput) return;
    const org = await createOrganization(orgName, showInput);
    if (org) {
      setOrgName('');
      setShowInput(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 animate-in fade-in duration-700">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Welcome to Kaeo</h1>
        <p className="text-xl text-muted-foreground">
          Let's set up your workspace to start managing your finances with AI.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Business Workspace */}
        <div className={`group relative p-8 rounded-2xl border transition-all duration-300 ${showInput === 'business' ? 'bg-card ring-2 ring-primary border-transparent' : 'bg-card/50 hover:bg-card hover:border-blue-spruce/30 hover:shadow-2xl hover:shadow-blue-spruce/5'}`}>
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 border border-primary/20 group-hover:scale-110 transition-transform">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-3">Business Workspace</h2>
          <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
            For founders and SME owners. Manage your own business, cash flow, and GST filing.
          </p>
          
          {showInput === 'business' ? (
            <div className="space-y-4 animate-in slide-in-from-top-2">
              <input
                autoFocus
                type="text"
                placeholder="Business Name (e.g. Acme Corp)"
                className="w-full px-4 py-2.5 rounded-xl border bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <div className="flex gap-2">
                <button
                  disabled={loading}
                  onClick={handleCreate}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Create</>}
                </button>
                <button
                  onClick={() => setShowInput(null)}
                  className="px-4 py-2.5 bg-muted/50 rounded-xl font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => { setShowInput('business'); setShowInput('business'); }}
              className="flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Accountant Workspace */}
        <div className={`group relative p-8 rounded-2xl border transition-all duration-300 ${showInput === 'accountant' ? 'bg-card ring-2 ring-primary border-transparent' : 'bg-card/50 hover:bg-card hover:border-blue-spruce/30 hover:shadow-2xl hover:shadow-blue-spruce/5'}`}>
          <div className="w-12 h-12 bg-ocean-mist/10 rounded-xl flex items-center justify-center mb-6 border border-ocean-mist/20 group-hover:scale-110 transition-transform">
            <UserSquare2 className="w-6 h-6 text-ocean-mist" />
          </div>
          <h2 className="text-xl font-bold mb-3">Accountant Workspace</h2>
          <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
            For CAs and accountants. Manage multiple clients, workflows, and compliance from one place.
          </p>

          {showInput === 'accountant' ? (
            <div className="space-y-4 animate-in slide-in-from-top-2">
              <input
                autoFocus
                type="text"
                placeholder="Firm Name (e.g. Sharma & Associates)"
                className="w-full px-4 py-2.5 rounded-xl border bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <div className="flex gap-2">
                <button
                  disabled={loading}
                  onClick={handleCreate}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Create</>}
                </button>
                <button
                  onClick={() => setShowInput(null)}
                  className="px-4 py-2.5 bg-muted/50 rounded-xl font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowInput('accountant')}
              className="flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-12 p-8 bg-muted/30 border border-dashed rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-background rounded-full">
            <PlayCircle className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold">Not sure where to start?</h3>
            <p className="text-sm text-muted-foreground">Try our sample workspace with demo data.</p>
          </div>
        </div>
        <button className="px-6 py-3 bg-background border rounded-xl font-medium hover:bg-muted transition-colors whitespace-nowrap">
          Try Sample Data
        </button>
      </div>

      <button className="mt-8 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto block">
        Skip for now
      </button>
    </div>
  );
};

export default KaeoHome;
