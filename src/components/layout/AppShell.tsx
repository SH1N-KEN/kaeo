import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import FloatingAskKaeo from '../ask/FloatingAskKaeo';
import { AskKaeoChatProvider } from '../../hooks/useAskKaeoChat';
import { useWorkspace } from '../../hooks/useWorkspace';

import CreateClientModal from '../ui/CreateClientModal';

const AppShell: React.FC = () => {
  const { onboardingCompleted, loading: workspaceLoading, profile } = useWorkspace();
  const location = useLocation();

  if (workspaceLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--background)' }}>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(15,118,110,0.10)', border: '1px solid rgba(15,118,110,0.20)' }}
        >
          <div className="w-4 h-4 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(15,118,110,0.2)', borderTopColor: '#0F766E' }} />
        </div>
        <p className="text-[13px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
          Loading workspace…
        </p>
      </div>
    );
  }

  if (profile && !onboardingCompleted && location.pathname !== '/account') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <AskKaeoChatProvider>
      <div
        className="flex min-h-screen transition-colors duration-300 print:block print:min-h-0"
        style={{ background: 'var(--background)' }}
      >
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 print:block">
          <main className="flex-1 overflow-y-auto print:overflow-visible print:block">
            <Topbar />
            <div
              className="mx-auto px-7 pt-4 pb-7 print:max-w-none print:mx-0 print:p-0"
              style={{ maxWidth: 1320 }}
            >
              <Outlet />
            </div>
          </main>
        </div>
        <FloatingAskKaeo />
      </div>
      <CreateClientModal />
    </AskKaeoChatProvider>
  );
};

export default AppShell;
