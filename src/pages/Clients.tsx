import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Edit3, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { calculateMonthEndReadiness } from '../lib/readinessEngine';

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
    setIsCreateModalOpen,
    setModalMode,
    setClientToEdit
  } = useWorkspace();

  const [clientStats, setClientStats] = useState<Record<string, ClientStats>>({});

  const handleAddClientClick = () => {
    setModalMode('create_client_business');
    setClientToEdit(null);
    setIsCreateModalOpen(true);
  };

  const handleEditClientClick = (client: any) => {
    setModalMode('edit_client_business');
    setClientToEdit(client);
    setIsCreateModalOpen(true);
  };


  // Fetch metrics for all clients if in accountant mode
  useEffect(() => {
    if (accountMode === 'accountant' && clients.length > 0) {
      fetchAllClientsStats();
    }
  }, [accountMode, clients]);

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



  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Unified View (handles both accountant and business owner)
  // ─────────────────────────────────────────────────────────────────────────────
  const renderAccountantView = () => {
    const activeOrgName = activeOrg?.name || 'Firm';
    const isOwner = accountMode === 'business_owner';

    return (
      <div className={embedMode ? "space-y-6" : "max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500"}>
        {!embedMode && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {isOwner ? "Businesses" : "Client Businesses"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isOwner 
                  ? "Manage your businesses reviewed inside Kaeo." 
                  : `Manage the business accounts you review in Kaeo for ${activeOrgName}.`
                }
              </p>
            </div>
            
            <button
              onClick={handleAddClientClick}
              className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-primary/10 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" /> {isOwner ? "Add Business" : "Add Client Business"}
            </button>
          </div>
        )}

        {embedMode && clients.length > 0 && (
          <div className="flex justify-between items-center border-b border-border/15 pb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {isOwner ? "Business Directory" : "Client Business Directory"}
            </h3>
            <button
              onClick={handleAddClientClick}
              className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-primary/10"
            >
              <Plus className="w-3.5 h-3.5" /> {isOwner ? "Add Business" : "Add Client Business"}
            </button>
          </div>
        )}

        {clients.length === 0 ? (
          <div className="premium-glass border border-dashed border-border/40 rounded-3xl p-20 flex flex-col items-center justify-center text-center space-y-5 shadow-xl">
            <div className="w-16 h-16 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20 shadow-inner">
              <Users className="w-8 h-8 text-teal-400/40" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold tracking-tight">
                {isOwner ? "Add your first business" : "Add your first client business"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm font-medium">
                {isOwner 
                  ? "Businesses are the workspaces you review inside Kaeo."
                  : "Client businesses are the workspaces you review inside Kaeo."
                }
              </p>
            </div>
            <button 
              onClick={handleAddClientClick}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-all shadow-xl shadow-primary/20 cursor-pointer"
            >
              {isOwner ? "Add Business" : "Add Client Business"}
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
                      {isOwner ? "Current Business" : "Active"}
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
                      {isOwner ? "Open Business" : "Open Client Business"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEditClientClick(client)}
                      className="px-3 py-2 bg-white/5 border border-border/40 hover:border-border text-foreground text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shrink-0"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return renderAccountantView();
};

export default Clients;
