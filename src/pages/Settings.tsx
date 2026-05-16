import React, { useState } from 'react';
import { 
  User, 
  Building2, 
  Shield, 
  Bell, 
  Database,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  X
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import ResetClientModal from '../components/ui/ResetClientModal';

const Settings: React.FC = () => {
  const { activeClient, activeOrg } = useWorkspace();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const sections = [
    { id: 'profile', title: 'Profile Settings', icon: User, description: 'Manage your personal information and preferences.' },
    { id: 'workspace', title: 'Workspace', icon: Building2, description: 'Configure organization details and team members.' },
    { id: 'security', title: 'Security', icon: Shield, description: 'Update passwords and security protocols.' },
    { id: 'notifications', title: 'Notifications', icon: Bell, description: 'Choose what updates you want to receive.' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account and client preferences.</p>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-success/5 border border-success/20 rounded-xl flex gap-3 items-center animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          <p className="text-sm text-success font-bold flex-1">{success}</p>
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4 text-success" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => (
          <div key={section.id} className="group p-6 bg-card border rounded-2xl hover:border-primary/30 transition-all cursor-pointer">
            <div className="flex items-start justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <section.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold">{section.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{section.description}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </div>
        ))}
      </div>

      {/* Data Management Section */}
      <div className="space-y-6 pt-6 border-t">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-bold">Data Management</h2>
        </div>

        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="p-6 flex items-center justify-between gap-6">
            <div className="space-y-1">
              <h4 className="text-sm font-bold">Reset Client Data</h4>
              <p className="text-xs text-muted-foreground max-w-md">
                Clear all uploaded files, imports, and transactions for the active client. This is useful for starting fresh or re-testing imports.
              </p>
            </div>
            {activeClient && activeOrg ? (
              <button 
                onClick={() => setIsResetModalOpen(true)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg text-xs font-bold flex items-center gap-2 transition-colors border border-transparent hover:border-border"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset {activeClient.name}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground italic">Select a client to manage data.</p>
            )}
          </div>
        </div>
      </div>

      {activeClient && activeOrg && (
        <ResetClientModal 
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          onSuccess={() => setSuccess('Client finance data reset.')}
          clientName={activeClient.name}
          clientId={activeClient.id}
          orgId={activeOrg.id}
        />
      )}
    </div>
  );
};

export default Settings;
