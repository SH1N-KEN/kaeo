import React from 'react';
import { Search, Bell } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import ClientSwitcherMock from './ClientSwitcherMock';

const Topbar: React.FC = () => {
  return (
    <header className="h-16 border-b bg-card/50 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-8">
      <div className="flex items-center gap-4">
        <ClientSwitcherMock />
        <div className="h-4 w-px bg-border mx-2" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Workspaces</span>
          <span className="text-border">/</span>
          <span className="text-foreground font-medium">Dashboard</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search transactions, files..." 
            className="pl-10 pr-4 py-1.5 rounded-lg border bg-muted/50 focus:bg-background focus:ring-1 focus:ring-primary outline-none text-sm w-64 transition-all"
          />
        </div>
        
        <button className="p-2 rounded-lg hover:bg-muted transition-colors relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-risk rounded-full border-2 border-card" />
        </button>
        
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Topbar;
