import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  CheckCircle2, 
  Loader2, 
  Edit3, 
  Check, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { calculateMonthEndReadiness } from '../lib/readinessEngine';
import CreateClientModal from '../components/ui/CreateClientModal';

interface ClientStats {
  lastUpload: string;
  openRisksCount: number;
  unreviewedCount: number;
  readinessScore: number;
  readinessStatus: string;
}

interface ClientsProps {
  embedMode?: boolean;
}

const Clients: React.FC<ClientsProps> = ({ embedMode = false }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    accountMode, 
    clients, 
    activeOrg, 
    activeClient, 
    setActiveClient, 
    createClient,
    updateClientMetadata,
    refresh
  } = useWorkspace();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [clientStats, setClientStats] = useState<Record<string, ClientStats>>({});

  // Business Owner Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editSpend, setEditSpend] = useState('');
  const [editTeam, setEditTeam] = useState('');
  const [editTool, setEditTool] = useState('');
  const [editPains, setEditPains] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Fetch metrics for all clients if in accountant mode
  useEffect(() => {
    if (accountMode === 'accountant' && clients.length > 0) {
      fetchAllClientsStats();
    }
  }, [accountMode, clients]);

  // Load business owner edit states when editing is opened
  useEffect(() => {
    if (activeClient) {
      setEditName(activeClient.name || '');
      setEditIndustry(activeClient.industry || '');
      const meta = activeClient.metadata || {};
      setEditSpend(meta.monthly_spend_range || '10k_50k');
      setEditTeam(meta.team_size || '2-10');
      setEditTool(meta.accounting_tools?.[0] || 'Tally');
      setEditPains(meta.pain_points || []);
      setEditNotes(meta.notes || '');
    }
  }, [activeClient, isEditingProfile]);

  const fetchAllClientsStats = async () => {
    const statsMap: Record<string, ClientStats> = {};

    try {
      await Promise.all(
        clients.map(async (client) => {
          // 1. Fetch last upload date
          const { data: latestFile } = await supabase
            .from('uploaded_files')
            .select('created_at')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // 2. Fetch open risks
          const { data: openRisks } = await supabase
            .from('risk_events')
            .select('*')
            .eq('client_id', client.id)
            .eq('status', 'open');

          // 3. Fetch transactions for readiness score
          const { data: txs } = await supabase
            .from('transactions')
            .select('*')
            .eq('client_id', client.id);

          const unreviewed = (txs || []).filter(tx => 
            !tx.review_status || tx.review_status === 'new' || tx.review_status === 'needs_review'
          );

          const readiness = calculateMonthEndReadiness(txs || [], openRisks || []);

          statsMap[client.id] = {
            lastUpload: latestFile?.created_at 
              ? new Date(latestFile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) 
              : 'No uploads',
            openRisksCount: openRisks?.length || 0,
            unreviewedCount: unreviewed.length,
            readinessScore: readiness.score,
            readinessStatus: readiness.status
          };
        })
      );

      setClientStats(statsMap);
    } catch (err) {
      console.error('Error fetching client statistics:', err);
    }
  };

  const handleOpenClient = (client: any) => {
    setActiveClient(client);
    toast(`Switched context to ${client.name}`, 'success');
    navigate('/dashboard');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient) return;
    setIsSavingProfile(true);

    try {
      // 1. Update client name & industry
      const { error: clientErr } = await supabase
        .from('clients')
        .update({ 
          name: editName,
          industry: editIndustry
        })
        .eq('id', activeClient.id);

      if (clientErr) throw clientErr;

      // 2. Update client metadata jsonb
      const updatedMetadata = {
        ...(activeClient.metadata || {}),
        monthly_spend_range: editSpend,
        team_size: editTeam,
        accounting_tools: [editTool],
        pain_points: editPains,
        notes: editNotes
      };

      await updateClientMetadata(activeClient.id, updatedMetadata);

      // 3. Update organization/workspace name as well to match business name
      if (activeOrg) {
        const { error: orgErr } = await supabase
          .from('organizations')
          .update({ name: editName })
          .eq('id', activeOrg.id);
        
        if (orgErr) console.warn('Could not update organization name:', orgErr);
      }

      toast('Business profile updated successfully', 'success');
      setIsEditingProfile(false);
      refresh();
    } catch (err: any) {
      toast(err.message || 'Failed to update profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const toggleEditPain = (pain: string) => {
    setEditPains(prev => 
      prev.includes(pain) ? prev.filter(p => p !== pain) : [...prev, pain]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Business Owner view
  // ─────────────────────────────────────────────────────────────────────────────
  const renderBusinessOwnerView = () => {
    if (!activeClient) {
      return (
        <div className="h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    const metadata = activeClient.metadata || {};
    const hasPains = metadata.pain_points && metadata.pain_points.length > 0;
    const tools = metadata.accounting_tools || ['None specified'];

    const getSpendDisplay = (range: string) => {
      switch (range) {
        case 'under_10k': return 'Under ₹10,000';
        case '10k_50k': return '₹10,000 - ₹50,000';
        case '50k_2l': return '₹50,000 - ₹2,00,000';
        case 'above_2l': return 'Above ₹2,00,000';
        default: return 'Not specified';
      }
    };

    const getPainLabel = (id: string) => {
      switch (id) {
        case 'duplicate_payments': return 'Duplicate Payments & Overdrafts';
        case 'messy_statements': return 'Messy Bank Statements';
        case 'vendor_overspend': return 'Software / Vendor Overspend';
        case 'month_end_reports': return 'Month-End Readiness Reports';
        case 'cashflow_visibility': return 'Real-time Cashflow Visibility';
        case 'accountant_handoff': return 'Accountant Collaboration';
        default: return id;
      }
    };

    const availablePains = [
      { id: 'duplicate_payments', label: 'Duplicate Payments & Overdrafts' },
      { id: 'messy_statements', label: 'Messy Bank / Card Statements' },
      { id: 'vendor_overspend', label: 'Vendor & Software Overspend' },
      { id: 'month_end_reports', label: 'Time-consuming Month-End Reports' },
      { id: 'cashflow_visibility', label: 'Lack of Real-time Cashflow Visibility' },
      { id: 'accountant_handoff', label: 'Messy Accountant Collaboration' }
    ];

    return (
      <div className={embedMode ? "space-y-6" : "max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500"}>
        {!embedMode && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Business Profile</h1>
              <p className="text-sm text-muted-foreground mt-1">Configure your corporate workspace variables.</p>
            </div>
            {!isEditingProfile && (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            )}
          </div>
        )}

        {embedMode && !isEditingProfile && (
          <div className="flex justify-end">
            <button
              onClick={() => setIsEditingProfile(true)}
              className="px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Profile
            </button>
          </div>
        )}

        {isEditingProfile ? (
          <form onSubmit={handleSaveProfile} className="premium-glass border border-border/40 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/20 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Edit Business Details</h2>
              <button 
                type="button" 
                onClick={() => setIsEditingProfile(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Business Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Industry</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                  value={editIndustry}
                  onChange={(e) => setEditIndustry(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monthly Spend</label>
                <select
                  className="w-full px-4 py-2.5 bg-[#161a18] border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                  value={editSpend}
                  onChange={(e) => setEditSpend(e.target.value)}
                >
                  <option value="under_10k">Under ₹10k</option>
                  <option value="10k_50k">₹10k - ₹50k</option>
                  <option value="50k_2l">₹50k - ₹2L</option>
                  <option value="above_2l">Above ₹2L</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Team Size</label>
                <select
                  className="w-full px-4 py-2.5 bg-[#161a18] border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                  value={editTeam}
                  onChange={(e) => setEditTeam(e.target.value)}
                >
                  <option value="1">1 (Solo Founder)</option>
                  <option value="2-10">2 - 10 employees</option>
                  <option value="11-50">11 - 50 employees</option>
                  <option value="50+">50+ employees</option>
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Primary Accounting Tool</label>
                <select
                  className="w-full px-4 py-2.5 bg-[#161a18] border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                  value={editTool}
                  onChange={(e) => setEditTool(e.target.value)}
                >
                  <option value="Tally">Tally</option>
                  <option value="Zoho Books">Zoho Books</option>
                  <option value="Excel/Sheets">Excel / Google Sheets</option>
                  <option value="Razorpay">Razorpay</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Main Pain Points</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {availablePains.map((pain) => {
                    const isSelected = editPains.includes(pain.id);
                    return (
                      <button
                        key={pain.id}
                        type="button"
                        onClick={() => toggleEditPain(pain.id)}
                        className={`p-3 rounded-xl border text-left transition-all text-xs font-semibold flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-primary/5 border-primary/40 text-foreground'
                            : 'bg-muted/10 border-transparent text-muted-foreground hover:border-border/30'
                        }`}
                      >
                        <span>{pain.label}</span>
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                          isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes / Context (Optional)</label>
                <textarea
                  placeholder="Special instructions, company context, or tax rules..."
                  className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background h-24 resize-none transition-all"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-border/20 pt-5">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                disabled={isSavingProfile}
                className="flex-1 py-3 px-4 bg-card border rounded-xl font-semibold hover:bg-muted transition-colors text-xs text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 text-xs"
              >
                {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Save Profile</>}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Core details column */}
            <div className="md:col-span-2 space-y-6">
              <div className="premium-glass border border-border/40 rounded-2xl p-6 space-y-5">
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b border-border/15 pb-2">Company Information</h2>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Business Name</span>
                    <span className="text-sm font-bold text-foreground mt-0.5 block">{activeClient.name}</span>
                  </div>
                  
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Industry</span>
                    <span className="text-sm font-bold text-foreground mt-0.5 block">{activeClient.industry || 'Not specified'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Estimated Monthly Spend</span>
                    <span className="text-sm font-bold text-foreground mt-0.5 block">{getSpendDisplay(metadata.monthly_spend_range)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Team Size</span>
                    <span className="text-sm font-bold text-foreground mt-0.5 block">{metadata.team_size ? `${metadata.team_size} employees` : 'Not specified'}</span>
                  </div>

                  <div className="col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Primary Accounting Tool</span>
                    <span className="text-sm font-bold text-foreground mt-0.5 block">{tools[0]}</span>
                  </div>
                </div>
              </div>

              {/* Notes Context */}
              <div className="premium-glass border border-border/40 rounded-2xl p-6 space-y-3">
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b border-border/15 pb-2">Workspace Notes</h2>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  {metadata.notes || 'No special notes or business instructions provided. Add instructions using the Edit Profile option to ground Kaeo’s recommendations.'}
                </p>
              </div>
            </div>

            {/* Pain points column */}
            <div className="space-y-6">
              <div className="premium-glass border border-border/40 rounded-2xl p-6 space-y-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-b border-border/15 pb-2">Target Workflows</h2>
                
                {hasPains ? (
                  <div className="space-y-2">
                    {metadata.pain_points.map((p: string) => (
                      <div key={p} className="p-3 bg-white/5 border border-border/20 rounded-xl flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-semibold text-foreground leading-tight">{getPainLabel(p)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No specific workflow pain points selected. Edit profile to calibrate analytics focus.</p>
                )}
              </div>

              {/* Workspace details info */}
              <div className="p-4 bg-muted/20 border border-border/40 rounded-2xl space-y-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Configuration Mode</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your account is in <strong className="text-foreground">Singular Business Mode</strong>. If you need to manage multiple firms or clients, please contact Kaeo support.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Accountant view
  // ─────────────────────────────────────────────────────────────────────────────
  const renderAccountantView = () => {
    const activeOrgName = activeOrg?.name || 'Firm';

    return (
      <div className={embedMode ? "space-y-6" : "max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500"}>
        {!embedMode && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage the business accounts you review in Kaeo for <span className="text-foreground font-semibold">{activeOrgName}</span>.</p>
            </div>
            
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-primary/10 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" /> Add Client
            </button>
          </div>
        )}

        {embedMode && clients.length > 0 && (
          <div className="flex justify-between items-center border-b border-border/15 pb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Client Directory</h3>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-primary/10"
            >
              <Plus className="w-3.5 h-3.5" /> Add Client
            </button>
          </div>
        )}

        {clients.length === 0 ? (
          <div className="premium-glass border border-dashed border-border/40 rounded-3xl p-20 flex flex-col items-center justify-center text-center space-y-5 shadow-xl">
            <div className="w-16 h-16 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20 shadow-inner">
              <Users className="w-8 h-8 text-teal-400/40" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold tracking-tight">Add your first client</h3>
              <p className="text-xs text-muted-foreground max-w-sm font-medium">
                Clients are the businesses you review inside this workspace.
              </p>
            </div>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-all shadow-xl shadow-primary/20 cursor-pointer"
            >
              Add Client
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {clients.map((client) => {
              const stats = clientStats[client.id] || {
                lastUpload: 'Loading...',
                openRisksCount: 0,
                unreviewedCount: 0,
                readinessScore: 0,
                readinessStatus: 'Not ready'
              };

              const isActive = activeClient?.id === client.id;

              return (
                <div 
                  key={client.id}
                  className={`premium-glass rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-md relative ${
                    isActive 
                      ? 'border-primary bg-primary/[0.02] ring-1 ring-primary/20' 
                      : 'border-border/40 hover:border-border/80'
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-primary text-primary-foreground text-[8px] font-black uppercase tracking-widest rounded-bl-lg shadow">
                      Active
                    </div>
                  )}

                  {/* Card Header */}
                  <div className="p-5 border-b border-border/15">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                      {client.industry || 'General Business'}
                    </span>
                    <h3 className="text-base font-bold text-foreground truncate mt-0.5">{client.name}</h3>
                  </div>

                  {/* Card Stats */}
                  <div className="p-5 space-y-3 flex-1">
                    {/* Last Upload */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Last upload:</span>
                      <span className="font-semibold text-foreground">{stats.lastUpload}</span>
                    </div>

                    {/* Open Risks */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Open risks:</span>
                      <span className={`font-semibold flex items-center gap-1 ${stats.openRisksCount > 0 ? 'text-risk' : 'text-success'}`}>
                        {stats.openRisksCount > 0 ? (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5" />
                            {stats.openRisksCount} active
                          </>
                        ) : (
                          'None'
                        )}
                      </span>
                    </div>

                    {/* Unreviewed Transactions */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Needing review:</span>
                      <span className={`font-semibold ${stats.unreviewedCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {stats.unreviewedCount} rows
                      </span>
                    </div>

                    {/* Readiness Score */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-muted-foreground">Readiness:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground">{stats.readinessScore}/100</span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                          stats.readinessStatus === 'Ready' 
                            ? 'bg-success/10 text-success border-success/20' 
                            : stats.readinessStatus === 'Almost ready'
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}>
                          {stats.readinessStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="p-4 bg-muted/15 border-t border-border/10 flex gap-2">
                    <button
                      onClick={() => handleOpenClient(client)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-md shadow-primary/10'
                          : 'bg-white/5 border border-border/40 hover:border-border text-foreground'
                      }`}
                    >
                      Open Client
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <CreateClientModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={async (name, industry, currency, metadata) => {
            if (!activeOrg) return null;
            const res = await createClient(name, activeOrg.id, industry, currency, metadata);
            if (res) {
              toast(`Client ${name} created successfully`, 'success');
              fetchAllClientsStats();
            }
            return res;
          }}
        />
      </div>
    );
  };

  return accountMode === 'business_owner' ? renderBusinessOwnerView() : renderAccountantView();
};

export default Clients;
