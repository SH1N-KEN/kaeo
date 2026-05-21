import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Search, Bell, X } from 'lucide-react';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/Breadcrumb';

const pathTitleMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/ask-kaeo': 'Ask Kaeo',
  '/files': 'Files Ingestion',
  '/transactions': 'Transactions',
  '/vendors': 'Vendors',
  '/risk-inbox': 'Risk Inbox',
  '/reports': 'Reports',
  '/clients': 'Clients',
  '/settings': 'Settings',
  '/billing': 'Billing & Plans',
};


const Topbar: React.FC = () => {
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  
  const currentPath = location.pathname;
  
  // Dynamic page title mapping helper
  const getPageTitle = (path: string): string => {
    // Exact match
    if (pathTitleMap[path]) {
      return pathTitleMap[path];
    }
    
    // Sub-route matches
    if (path.endsWith('/mapping')) {
      return 'Ledger Mapping';
    }
    if (path.startsWith('/reports/')) {
      return 'Report Detail';
    }
    
    // Fallback format last segment
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) return 'Current Page';
    
    const lastSegment = segments[segments.length - 1];
    // Check if UUID or numeric ID
    const isId = /^[0-9a-fA-F-]+$/.test(lastSegment) || /^\d+$/.test(lastSegment);
    const targetSegment = isId && segments.length > 1 ? segments[segments.length - 2] : lastSegment;
    
    return targetSegment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const pageTitle = getPageTitle(currentPath);

  // Close notifications dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="h-16 premium-topbar sticky top-0 z-40 flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <WorkspaceSwitcher />
          <div className="h-4 w-px bg-border/40 mx-2" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">Workspaces</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:inline-flex" />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Trigger Button */}
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-xs font-semibold text-muted-foreground w-48 md:w-64 cursor-pointer premium-topbar-card"
          >
            <Search className="w-3.5 h-3.5 search-icon" />
            <span className="text-left flex-1">Search transactions, files...</span>
            <span className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded border border-border/20 text-muted-foreground">Ctrl K</span>
          </button>
          
          {/* Notifications Popover Trigger */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="p-2 rounded-xl transition-colors relative cursor-pointer premium-topbar-card"
            >
              <Bell className="w-4 h-4 bell-icon" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-risk rounded-full border border-card" />
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-72 premium-floating-panel rounded-2xl p-4 shadow-2xl z-[90] text-center animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="w-10 h-10 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-2.5">
                  <Bell className="w-4 h-4 text-teal-400" />
                </div>
                <h4 className="text-xs font-bold text-foreground mb-1">Notifications</h4>
                <p className="text-[11px] text-muted-foreground">No notifications yet.</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Command Palette / Search Placeholder Modal */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-start justify-center pt-24 px-4 animate-in fade-in duration-200"
          onClick={() => setIsSearchOpen(false)}
        >
          <div 
            className="w-full max-w-xl premium-floating-panel rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsSearchOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-border/40 pb-4 mb-4">
              <Search className="w-5 h-5 text-teal-400 shrink-0 animate-pulse" />
              <input 
                type="text" 
                placeholder="Search ledger entries, vendors, reports..." 
                className="w-full bg-transparent text-sm font-semibold outline-none text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
            </div>

            <div className="py-6 text-center">
              <div className="w-12 h-12 bg-teal-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-teal-500/20">
                <Search className="w-5 h-5 text-teal-400" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">Advanced CFO Search</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                Search across transactions, vendors, and files is coming soon in Phase 13B.
              </p>
            </div>
            
            <div className="border-t border-border/30 pt-3 flex items-center justify-between text-[10px] text-muted-foreground font-bold">
              <span>TIP: Use filters on ledger page to sort manually</span>
              <kbd className="px-2 py-0.5 bg-muted rounded border border-border/50">ESC to exit</kbd>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Topbar;
