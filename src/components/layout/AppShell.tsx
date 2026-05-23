import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import FloatingAskKaeo from '../ask/FloatingAskKaeo';
import { AskKaeoChatProvider } from '../../hooks/useAskKaeoChat';
import { useWorkspace } from '../../hooks/useWorkspace';

const AppShell: React.FC = () => {
  const { onboardingCompleted, loading: workspaceLoading, profile } = useWorkspace();
  const location = useLocation();

  if (workspaceLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground animate-pulse font-medium">Loading workspace...</p>
      </div>
    );
  }

  if (profile && !onboardingCompleted && location.pathname !== '/account') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <AskKaeoChatProvider>
      <div className="flex min-h-screen bg-background transition-colors duration-300 print:block print:min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 print:block">
          <Topbar />
          <main className="flex-1 p-8 overflow-y-auto print:overflow-visible print:p-0 print:block">
            <div className="max-w-7xl mx-auto print:max-w-none print:mx-0">
              <Outlet />
            </div>
          </main>
        </div>
        <FloatingAskKaeo />
      </div>
    </AskKaeoChatProvider>
  );
};

export default AppShell;

