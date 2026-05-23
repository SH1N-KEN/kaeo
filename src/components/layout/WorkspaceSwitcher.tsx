import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronDown, 
  Plus, 
  Settings, 
  Check, 
  Building,
  Briefcase
} from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import CreateWorkspaceModal from '../ui/CreateWorkspaceModal';
import CreateClientModal from '../ui/CreateClientModal';
import aeLogo from '../../assets/kaeo-ae-logo.png';

const WorkspaceSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const { 
    organizations, 
    clients, 
    activeOrg, 
    activeClient, 
    setActiveOrg, 
    setActiveClient,
    createOrganization,
    createClient,
    accountMode
  } = useWorkspace();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  if (!activeOrg) {
    return (
      <>
        <button 
          onClick={() => setIsOrgModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed hover:border-primary hover:text-primary transition-all text-xs font-medium w-full justify-center"
        >
          <Plus className="w-3 h-3" />
          Create Workspace
        </button>
        <CreateWorkspaceModal 
          isOpen={isOrgModalOpen}
          onClose={() => setIsOrgModalOpen(false)}
          onCreate={createOrganization}
        />
      </>
    );
  }

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-xs font-semibold w-full premium-topbar-card"
      >
        <div className="w-5 h-5 bg-teal-500/10 rounded flex items-center justify-center border border-teal-500/20 shrink-0">
          <img src={aeLogo} alt="Workspace Badge" className="w-3.5 h-3.5 object-contain" />
        </div>
        {accountMode === 'business_owner' ? (
          <div className="flex flex-col items-start min-w-0 flex-1 justify-center">
            <span className="truncate text-xs font-bold text-foreground">
              {activeOrg.name}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-start min-w-0 flex-1">
            <span className="truncate text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
              {activeOrg.name}
            </span>
            <span className="truncate text-xs">
              {activeClient?.name || 'No client selected'}
            </span>
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform chevron-icon ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-64 premium-floating-panel rounded-xl shadow-2xl z-[90] py-2 animate-in fade-in zoom-in-95 duration-200">
            {/* Organizations Section */}
            <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
              Workspaces
              {accountMode !== 'business_owner' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsOrgModalOpen(true); setIsOpen(false); }} 
                  className="p-1 hover:bg-white/5 rounded transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="space-y-0.5 px-1 mb-2">
              {organizations.map(org => (
                <button
                  key={org.id}
                  onClick={() => { setActiveOrg(org); setIsOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${activeOrg.id === org.id ? 'bg-primary/10 text-primary' : 'hover:bg-white/5'}`}
                >
                  <Building className="w-3 h-3" />
                  <span className="truncate flex-1 text-left">{org.name}</span>
                  {activeOrg.id === org.id && <Check className="w-3 h-3" />}
                </button>
              ))}
            </div>

            {accountMode !== 'business_owner' && (
              <>
                <div className="h-px bg-border/20 mx-2 my-1" />

                {/* Clients Section */}
                <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
                  Clients
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsClientModalOpen(true); setIsOpen(false); }} 
                    className="p-1 hover:bg-white/5 rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-0.5 px-1 max-h-48 overflow-y-auto">
                  {clients.length === 0 ? (
                    <div className="px-3 py-4 text-center">
                      <p className="text-[10px] text-muted-foreground mb-2">No clients found</p>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsClientModalOpen(true); setIsOpen(false); }} 
                        className="text-[10px] text-primary hover:underline"
                      >
                        Add Client
                      </button>
                    </div>
                  ) : (
                    <>
                      {clients.map(client => (
                        <button
                          key={client.id}
                          onClick={() => { setActiveClient(client); setIsOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${activeClient?.id === client.id ? 'bg-primary/10 text-primary' : 'hover:bg-white/5'}`}
                        >
                          <Briefcase className="w-3 h-3" />
                          <span className="truncate flex-1 text-left">{client.name}</span>
                          {activeClient?.id === client.id && <Check className="w-3 h-3" />}
                        </button>
                      ))}
                      <div className="h-px bg-border/10 my-1 mx-2" />
                      <button
                        onClick={() => { navigate('/settings?tab=clients'); setIsOpen(false); }}
                        className="w-full flex items-center justify-between px-3 py-1 rounded-lg text-[11px] font-bold text-teal-400 hover:bg-white/5 transition-colors text-left"
                      >
                        <span>Manage clients</span>
                        <span>→</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            <div className="h-px bg-border/20 mx-2 my-1" />
            
            <div className="px-1">
              <button 
                onClick={() => { navigate('/settings'); setIsOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-white/5 transition-colors text-muted-foreground text-left"
              >
                <Settings className="w-3 h-3" />
                Workspace Settings
              </button>
            </div>
          </div>
        </>
      )}

      <CreateWorkspaceModal 
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
        onCreate={createOrganization}
      />

      <CreateClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onCreate={(name, industry, currency, metadata) => createClient(name, activeOrg.id, industry, currency, metadata)}
      />
    </div>
  );
};

export default WorkspaceSwitcher;
