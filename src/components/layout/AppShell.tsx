import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import FloatingAskKaeo from '../ask/FloatingAskKaeo';
import { AskKaeoChatProvider } from '../../hooks/useAskKaeoChat';

const AppShell: React.FC = () => {
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

