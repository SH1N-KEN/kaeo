import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronDown, 
  Plus, 
  Settings, 
  Check, 
  Briefcase,
  Edit3,
  Upload
} from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { getCleanClientName } from '../../lib/formatters';


interface WorkspaceSwitcherProps {
  collapsed?: boolean;
}

const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ collapsed = false }) => {
  const navigate = useNavigate();
  const { 
    clients, 
    activeOrg, 
    activeClient, 
    setActiveClient,
    accountMode,
    setIsCreateModalOpen,
    setModalMode,
    setClientToEdit
  } = useWorkspace();
  
  const [isOpen, setIsOpen] = useState(false);

  if (!activeOrg) {
    return (
      <button 
        onClick={() => {
          setModalMode(accountMode === 'business_owner' ? 'create_business' : 'create_client_business');
          setClientToEdit(null);
          setIsCreateModalOpen(true);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-primary/50 hover:text-foreground transition-all text-xs font-medium w-full justify-center text-muted-foreground"
      >
        <Plus className="w-3 h-3" />
        {!collapsed && <span>Add Business</span>}
      </button>
    );
  }

  const handleAddBusinessClick = () => {
    setModalMode(accountMode === 'business_owner' ? 'create_business' : 'create_client_business');
    setClientToEdit(null);
    setIsCreateModalOpen(true);
    setIsOpen(false);
  };

  const handleEditBusinessClick = () => {
    setModalMode(accountMode === 'business_owner' ? 'edit_business' : 'edit_client_business');
    setClientToEdit(activeClient);
    setIsCreateModalOpen(true);
    setIsOpen(false);
  };

  const displayName = accountMode === 'business_owner' 
    ? getCleanClientName(activeClient?.name || activeOrg.name)
    : (activeClient ? getCleanClientName(activeClient.name) : 'No client business selected');

  return (
    <div className="relative">
      {collapsed ? (
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center w-10 h-10 rounded-xl transition-all hover:bg-muted/40 border border-border/40 shrink-0 mx-auto"
          title={displayName}
        >
          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4 text-[var(--primary)]" />
          </div>
        </button>
      ) : (
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-xs font-semibold w-full bg-muted/30 hover:bg-muted/60 border border-border/40"
        >
          <div className="w-5 h-5 bg-muted rounded flex items-center justify-center border border-border/20 shrink-0">
            <Briefcase className="w-3.5 h-3.5 text-primary" />
          </div>
          {accountMode === 'business_owner' ? (
            <div className="flex flex-col items-start min-w-0 flex-1 justify-center">
              <span className="truncate text-xs font-bold text-[var(--sidebar-foreground)]">
                {displayName}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-start min-w-0 flex-1 text-left">
              <span className="truncate text-[10px] text-[var(--sidebar-foreground)] opacity-70 uppercase tracking-wider font-bold">
                {getCleanClientName(activeOrg.name)}
              </span>
              <span className="truncate text-xs text-[var(--sidebar-foreground)]">
                {displayName}
              </span>
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-[var(--sidebar-foreground)] opacity-70 transition-transform chevron-icon ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}
 
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          {accountMode === 'business_owner' ? (
            <div className={collapsed ? "absolute left-full top-0 ml-2 w-64 frosted-popover shadow-2xl z-[90] py-2 animate-in fade-in zoom-in-95 duration-200" : "absolute top-full left-0 mt-2 w-64 frosted-popover shadow-2xl z-[90] py-2 animate-in fade-in zoom-in-95 duration-200"}>
              {/* Current Business Section */}
              <div className="px-3 py-1.5 border-b border-border/10 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Business</span>
                <p className="text-xs font-bold text-foreground truncate mt-0.5">{getCleanClientName(activeClient?.name || activeOrg.name)}</p>
              </div>

              
              <div className="px-1 py-1 space-y-0.5">
                <button 
                  onClick={handleAddBusinessClick}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--muted)] transition-colors text-left text-foreground font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  Add business
                </button>
                <button 
                  onClick={handleEditBusinessClick}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--muted)] transition-colors text-left text-foreground"
                >
                  <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                  Edit business profile
                </button>
                <button 
                  onClick={() => { navigate('/files'); setIsOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--muted)] transition-colors text-left text-foreground"
                >
                  <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                  Upload files
                </button>
                <button 
                  onClick={() => { navigate('/settings'); setIsOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--muted)] transition-colors text-left text-foreground"
                >
                  <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                  Business settings
                </button>
              </div>

              {clients.length > 1 && (
                <>
                  <div className="h-px bg-border/20 mx-2 my-1" />
                  <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Switch Business
                  </div>
                  <div className="space-y-0.5 px-1 max-h-36 overflow-y-auto">
                    {clients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => { setActiveClient(client); setIsOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${activeClient?.id === client.id ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-[var(--muted)] text-muted-foreground'}`}
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        <span className="truncate flex-1 text-left">{getCleanClientName(client.name)}</span>
                        {activeClient?.id === client.id && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className={collapsed ? "absolute left-full top-0 ml-2 w-64 frosted-popover shadow-2xl z-[90] py-2 animate-in fade-in zoom-in-95 duration-200" : "absolute top-full left-0 mt-2 w-64 frosted-popover shadow-2xl z-[90] py-2 animate-in fade-in zoom-in-95 duration-200"}>
              {/* Workspace Section */}
              <div className="px-3 py-1.5 border-b border-border/10 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Workspace</span>
                <p className="text-xs font-bold text-foreground truncate mt-0.5">{getCleanClientName(activeOrg.name)}</p>
              </div>
              
              <div className="px-1 py-1 space-y-0.5">
                <button 
                  onClick={() => { navigate('/settings'); setIsOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--muted)] transition-colors text-left text-foreground"
                >
                  <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                  Workspace settings
                </button>
              </div>
 
              <div className="h-px bg-border/20 mx-2 my-1" />
 
              {/* Client Businesses Section */}
              <div className="px-3 py-1.5 border-b border-border/10 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Client Businesses</span>
                {activeClient && (
                  <p className="text-xs font-bold text-foreground truncate mt-0.5">{getCleanClientName(activeClient.name)}</p>
                )}
              </div>
 
              <div className="px-1 py-1 space-y-0.5">
                <button 
                  onClick={handleAddBusinessClick}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--muted)] transition-colors text-left text-foreground font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  Add client business
                </button>
                <button 
                  onClick={() => { navigate('/settings?tab=clients'); setIsOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--muted)] transition-colors text-left text-foreground"
                >
                  <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                  Manage clients
                </button>
                {activeClient && (
                  <button 
                    onClick={() => { navigate('/files'); setIsOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-[var(--muted)] transition-colors text-left text-foreground"
                  >
                    <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                    Upload files for current client
                  </button>
                )}
              </div>
 
              {clients.length > 0 && (
                <>
                  <div className="h-px bg-border/20 mx-2 my-1" />
                  <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Switch Client
                  </div>
                  <div className="space-y-0.5 px-1 max-h-36 overflow-y-auto">
                    {clients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => { setActiveClient(client); setIsOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${activeClient?.id === client.id ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-[var(--muted)] text-muted-foreground'}`}
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        <span className="truncate flex-1 text-left">{getCleanClientName(client.name)}</span>
                        {activeClient?.id === client.id && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </>
              )}

            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
