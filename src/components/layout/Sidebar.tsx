import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Files, 
  ArrowRightLeft, 
  Users, 
  AlertTriangle, 
  BarChart3, 
  UserSquare2, 
  Settings, 
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  User,
  MoreVertical
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '../../hooks/useToast';
import kaeoWordmark from '../../assets/kaeo-wordmark.png';
import aeLogo from '../../assets/kaeo-ae-logo.png';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: MessageSquare, label: 'Ask Kaeo', path: '/ask-kaeo' },
  { icon: Files, label: 'Files', path: '/files' },
  { icon: ArrowRightLeft, label: 'Transactions', path: '/transactions' },
  { icon: Users, label: 'Vendors', path: '/vendors' },
  { icon: AlertTriangle, label: 'Risk Inbox', path: '/risk-inbox' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: UserSquare2, label: 'Clients', path: '/clients' },
];

const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  // Collapsible state
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kaeo-sidebar-collapsed') === 'true';
    }
    return false;
  });

  // Profile dropdown state
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kaeo-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'dark';
  });

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem('kaeo-sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  // Apply theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kaeo-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kaeo-theme', 'light');
    }
  }, [theme]);

  // Handle click outside to close profile dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const toggleTheme = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    toast(`Switched to ${theme === 'light' ? 'Dark' : 'Light'} Mode`, 'info');
  };

  const handleSignOut = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setProfileMenuOpen(false);
    try {
      await signOut();
      toast('Signed out successfully', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to sign out', 'error');
    }
  };

  return (
    <aside 
      className={`
        relative border-r bg-card flex flex-col h-screen sticky top-0 transition-all duration-300 z-50
        ${collapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* Brand Logo Header */}
      <div className={`p-6 flex items-center justify-between border-b border-border/40 ${collapsed ? 'justify-center' : ''}`}>
        {!collapsed ? (
          <div className="flex items-center gap-2 h-8">
            <img src={kaeoWordmark} alt="Kaeo Logo" className="h-6 object-contain filter dark:invert" />
          </div>
        ) : (
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20">
            <img src={aeLogo} alt="Kaeo Icon" className="w-5 h-5 object-contain" />
          </div>
        )}
      </div>

      {/* Navigation Space */}
      <div className="flex-1 flex flex-col min-h-0 p-4">
        <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1 -mr-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                ${isActive 
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm shadow-primary/5' 
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'}
                ${collapsed ? 'justify-center' : ''}
              `}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}

              {/* Tooltip on Hover when Collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2 py-1.5 rounded-lg bg-black/90 border border-teal-500/20 text-teal-300 text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 pointer-events-none shadow-lg z-50">
                  {item.label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Collapse Toggle Button */}
        <div className="pt-2 border-t border-border/40 flex justify-end">
          <button
            onClick={toggleCollapse}
            className="w-full flex items-center justify-center p-2 rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent transition-all"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <div className="flex items-center gap-2 text-xs font-semibold"><ChevronLeft className="w-4 h-4" /> Collapse</div>}
          </button>
        </div>
      </div>

      {/* Profile/Account Area */}
      <div className="p-4 border-t border-border/40 relative" ref={menuRef}>
        <button 
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          className={`
            w-full flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 border border-transparent transition-all group
            ${profileMenuOpen ? 'bg-muted/50 border-border/50' : ''}
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold text-xs shrink-0 shadow-sm shadow-teal-500/5">
              {user?.email?.[0].toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 items-start">
                <span className="text-xs font-bold truncate text-foreground leading-tight">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                </span>
                <span className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                  {user?.email}
                </span>
              </div>
            )}
          </div>
          {!collapsed && (
            <MoreVertical className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          )}
        </button>

        {/* Profile Dropdown Menu */}
        {profileMenuOpen && (
          <div 
            className={`
              absolute bottom-16 left-4 w-56 premium-glass rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200
              ${collapsed ? 'left-16' : 'left-4'}
            `}
          >
            {/* Header / Info */}
            <div className="px-3 py-2 border-b border-border/30 mb-1">
              <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Signed in as</p>
              <p className="text-xs font-bold text-foreground truncate mt-0.5">{user?.email}</p>
            </div>

            {/* Menu Items */}
            <div className="space-y-0.5">
              <NavLink 
                to="/settings"
                onClick={() => setProfileMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
              >
                <User className="w-3.5 h-3.5" />
                <span>Account Details</span>
              </NavLink>

              <NavLink 
                to="/billing"
                onClick={() => setProfileMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Billing & Plans</span>
              </NavLink>

              <NavLink 
                to="/settings"
                onClick={() => setProfileMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Workspace Settings</span>
              </NavLink>

              {/* Theme Toggle option */}
              <button 
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                  <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </div>
                <span className="text-[9px] font-black uppercase text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">Theme</span>
              </button>

              <div className="h-px bg-border/30 my-1" />

              <button 
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
