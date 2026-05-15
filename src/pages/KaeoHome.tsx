import React, { useState } from 'react';
import { 
  Building2, 
  UserSquare2, 
  ArrowRight, 
  PlayCircle,
} from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import CreateWorkspaceModal from '../components/ui/CreateWorkspaceModal';

const KaeoHome: React.FC = () => {
  const { createOrganization } = useWorkspace();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'business' | 'accountant'>('business');

  const openCreateModal = (type: 'business' | 'accountant') => {
    setSelectedType(type);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto py-12 animate-in fade-in duration-700 px-4">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Welcome to Kaeo</h1>
        <p className="text-xl text-muted-foreground">
          Let's set up your workspace to start managing your finances with AI.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Business Workspace */}
        <div 
          onClick={() => openCreateModal('business')}
          className="group relative p-8 rounded-2xl border bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
        >
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 border border-primary/20 group-hover:scale-110 transition-transform">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-3">Business Workspace</h2>
          <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
            For founders and SME owners. Manage your own business, cash flow, and GST filing.
          </p>
          
          <button className="flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all">
            Get Started <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Accountant Workspace */}
        <div 
          onClick={() => openCreateModal('accountant')}
          className="group relative p-8 rounded-2xl border bg-card/50 hover:bg-card hover:border-ocean-mist/30 hover:shadow-2xl hover:shadow-ocean-mist/5 transition-all duration-300 cursor-pointer"
        >
          <div className="w-12 h-12 bg-ocean-mist/10 rounded-xl flex items-center justify-center mb-6 border border-ocean-mist/20 group-hover:scale-110 transition-transform">
            <UserSquare2 className="w-6 h-6 text-ocean-mist" />
          </div>
          <h2 className="text-xl font-bold mb-3">Accountant Workspace</h2>
          <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
            For CAs and accountants. Manage multiple clients, workflows, and compliance from one place.
          </p>

          <button className="flex items-center gap-2 text-ocean-mist font-semibold hover:gap-3 transition-all">
            Get Started <ArrowRight className="w-4 h-4" />
          </button>
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

      <CreateWorkspaceModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={createOrganization}
        initialType={selectedType}
      />
    </div>
  );
};

export default KaeoHome;
