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
        className="flex h-screen overflow-hidden transition-colors duration-300 print:block print:min-h-0 relative"
        style={{ background: 'var(--background)' }}
      >
        {/* Ambient lighting glows for glassmorphism */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-[var(--primary)]/8 dark:bg-[var(--primary)]/12 rounded-full blur-[140px]" />
          <div className="absolute top-1/3 -right-40 w-[450px] h-[450px] bg-indigo-500/4 dark:bg-indigo-500/6 rounded-full blur-[140px]" />
          <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] bg-emerald-500/4 dark:bg-emerald-500/6 rounded-full blur-[140px]" />
        </div>

        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 relative print:block z-10">
          <Topbar />
          <main className="flex-1 overflow-y-auto print:overflow-visible print:block">
            <div
              className="mx-auto px-7 pt-20 pb-7 print:max-w-none print:mx-0 print:p-0"
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
