import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  Settings, 
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  MoreVertical,
  Building2,
  Inbox,
  FileText,
  UploadCloud,
  Users
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '../../hooks/useToast';
import aeLogo from '../../assets/kaeo-ae-logo.png';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Inbox, label: 'Risk Inbox', path: '/risk-inbox' },
  { icon: ArrowRightLeft, label: 'Transactions', path: '/transactions' },
  { icon: Building2, label: 'Vendors', path: '/vendors' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: UploadCloud, label: 'Files', path: '/files' },
  { icon: Users, label: 'Clients', path: '/clients' },
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

  const tooltipStyle: React.CSSProperties = {
    background: 'rgba(11, 15, 14, 0.95)',
    borderColor: 'rgba(47, 184, 166, 0.25)',
    color: '#2fb8a6',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
  };

  return (
    <aside 
      className={`
        relative border-r bg-card flex flex-col h-screen sticky top-0 transition-all duration-300 z-50
        ${collapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* Boundary Edge Circular Toggle Button - shrunken to 24px x 24px and centered exactly at 86px */}
      <button
        onClick={toggleCollapse}
        className="absolute rounded-full flex items-center justify-center transition-all z-[80] cursor-pointer shadow-sm premium-topbar-card"
        style={{
          position: 'absolute',
          right: '0',
          top: '86px',
          transform: 'translate(50%, -50%)',
          width: '24px',
          height: '24px',
          minWidth: '24px',
          minHeight: '24px',
          padding: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="chevron-icon" style={{ width: '12px', height: '12px' }} />
        ) : (
          <ChevronLeft className="chevron-icon" style={{ width: '12px', height: '12px' }} />
        )}
      </button>

      {/* Brand Logo Header - Fixed visual height of 86px with horizontal padding px-6 */}
      <div 
        className={`flex items-center border-b border-border/40 ${collapsed ? 'justify-center' : 'justify-start px-6'}`}
        style={{ height: '86px' }}
      >
        <div className="flex items-center select-none">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 h-8">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/25 shrink-0">
                <img src={aeLogo} alt="ae" className="w-4 h-4 object-contain" />
              </div>
              <span className="text-[26px] font-bold tracking-tight text-teal-400 leading-none">
                Kaeo
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/25">
              <img src={aeLogo} alt="ae" className="w-4 h-4 object-contain" />
            </div>
          )}
        </div>
      </div>

      {/* Navigation Space - pt-4 sets the starting padding-top to exactly 16px */}
      <div className="flex-1 flex flex-col min-h-0 p-3 pt-4">
        <nav className="space-y-1 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pr-1 -mr-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                group relative flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200
                ${isActive 
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm shadow-primary/5 mx-1' 
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent mx-1'}
                ${collapsed ? 'justify-center mx-0' : ''}
              `}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}

              {/* Tooltip on Hover when Collapsed */}
              {collapsed && (
                <div 
                  className="absolute left-full ml-3 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:translate-x-1.5 transition-all duration-300 pointer-events-none z-50 border"
                  style={tooltipStyle}
                >
                  {item.label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Clickable Profile Card */}
      <div className="p-3 border-t border-border/40 relative group" ref={menuRef}>
        <button 
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          className={`
            w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-border/30 transition-all text-left cursor-pointer
            ${profileMenuOpen ? 'bg-white/5 border-border/30 shadow-inner' : ''}
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold text-xs shrink-0 shadow-sm shadow-teal-500/5 group-hover:shadow-teal-500/20 group-hover:border-teal-500/30 transition-all duration-300">
              {user?.email?.[0].toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-bold truncate text-foreground leading-tight">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                </span>
                <span className="text-[10px] text-muted-foreground truncate leading-none mt-0.5 max-w-[125px]">
                  {user?.email}
                </span>
              </div>
            )}
          </div>
          {!collapsed && (
            <MoreVertical className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-1" />
          )}
        </button>

        {/* Collapsed Mode Account Tooltip */}
        {collapsed && (
          <div 
            className="absolute left-full bottom-5 ml-3 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:translate-x-1.5 transition-all duration-300 pointer-events-none z-50 border"
            style={tooltipStyle}
          >
            Account Details
          </div>
        )}

        {/* Profile Dropdown Menu */}
        {profileMenuOpen && (
          <div 
            className={`
              absolute bottom-16 w-56 premium-floating-panel rounded-2xl p-1.5 shadow-2xl z-[90] animate-in fade-in slide-in-from-bottom-2 duration-200
              ${collapsed ? 'left-20' : 'left-4'}
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
                to="/account"
                onClick={() => setProfileMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Account Details</span>
              </NavLink>

              <NavLink 
                to="/billing"
                onClick={() => setProfileMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Billing &amp; Plans</span>
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
