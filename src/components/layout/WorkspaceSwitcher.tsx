import React, { useState } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Plus, 
  Settings, 
  Check, 
  Building,
  Briefcase
} from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';

const WorkspaceSwitcher: React.FC = () => {
  const { 
    organizations, 
    clients, 
    activeOrg, 
    activeClient, 
    setActiveOrg, 
    setActiveClient,
    createOrganization,
    createClient
  } = useWorkspace();
  
  const [isOpen, setIsOpen] = useState(false);

  const handleCreateOrg = async () => {
    const name = prompt('Enter organization name:');
    if (name) await createOrganization(name);
  };

  const handleCreateClient = async () => {
    if (!activeOrg) return;
    const name = prompt('Enter client name:');
    if (name) await createClient(name, activeOrg.id);
  };

  if (!activeOrg) {
    return (
      <button 
        onClick={handleCreateOrg}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed hover:border-primary hover:text-primary transition-all text-xs font-medium w-full justify-center"
      >
        <Plus className="w-3 h-3" />
        Create Workspace
      </button>
    );
  }

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted transition-colors text-sm font-medium w-full"
      >
        <div className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center">
          <Building2 className="w-3 h-3 text-primary" />
        </div>
        <div className="flex flex-col items-start min-w-0 flex-1">
          <span className="truncate text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
            {activeOrg.name}
          </span>
          <span className="truncate text-xs">
            {activeClient?.name || 'No client selected'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-64 bg-card border rounded-xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
            {/* Organizations Section */}
            <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
              Workspaces
              <button onClick={handleCreateOrg} className="p-1 hover:bg-muted rounded transition-colors">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-0.5 px-1 mb-2">
              {organizations.map(org => (
                <button
                  key={org.id}
                  onClick={() => { setActiveOrg(org); setIsOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${activeOrg.id === org.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                >
                  <Building className="w-3 h-3" />
                  <span className="truncate flex-1 text-left">{org.name}</span>
                  {activeOrg.id === org.id && <Check className="w-3 h-3" />}
                </button>
              ))}
            </div>

            <div className="h-px bg-border mx-2 my-1" />

            {/* Clients Section */}
            <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
              Clients
              <button onClick={handleCreateClient} className="p-1 hover:bg-muted rounded transition-colors">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-0.5 px-1 max-h-48 overflow-y-auto">
              {clients.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-[10px] text-muted-foreground mb-2">No clients found</p>
                  <button onClick={handleCreateClient} className="text-[10px] text-primary hover:underline">Add Client</button>
                </div>
              ) : clients.map(client => (
                <button
                  key={client.id}
                  onClick={() => { setActiveClient(client); setIsOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${activeClient?.id === client.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                >
                  <Briefcase className="w-3 h-3" />
                  <span className="truncate flex-1 text-left">{client.name}</span>
                  {activeClient?.id === client.id && <Check className="w-3 h-3" />}
                </button>
              ))}
            </div>

            <div className="h-px bg-border mx-2 my-1" />
            
            <div className="px-1">
              <button className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs hover:bg-muted transition-colors text-muted-foreground">
                <Settings className="w-3 h-3" />
                Workspace Settings
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
