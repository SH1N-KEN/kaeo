import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowRightLeft,
  Settings,
  CreditCard,
  LogOut,
  ChevronLeft,
  Sun,
  Moon,
  Building2,
  Inbox,
  FileText,
  UploadCloud,
  User,
  Upload,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import aeLogo from '../../assets/kaeo-ae-logo.png';

const primaryNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard',    path: '/dashboard' },
  { icon: UploadCloud,     label: 'Files',        path: '/files' },
  { icon: ArrowRightLeft,  label: 'Transactions', path: '/transactions' },
  { icon: Inbox,           label: 'Risk Inbox',   path: '/risk-inbox' },
  { icon: Building2,       label: 'Vendors',      path: '/vendors' },
  { icon: FileText,        label: 'Reports',      path: '/reports' },
];


const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();
  const { accountMode } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kaeo-sidebar-collapsed');
      return saved === 'true';
    }
    return false;
  });

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kaeo-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem('kaeo-sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kaeo-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kaeo-theme', 'light');
    }
  }, [theme]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const sidebarWidth = collapsed ? 72 : 260;

  const userInitial = user?.email?.[0].toUpperCase() || 'U';
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';

  return (
    <aside
      className="sidebar-base flex-shrink-0"
      style={{ width: sidebarWidth }}
    >
      {/* ── Logo ── */}
      <div
        className="flex items-center relative"
        style={{ height: 64, padding: collapsed ? '0' : '0 20px' }}
      >
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="flex items-center justify-center mx-auto transition-opacity hover:opacity-70 cursor-pointer"
            style={{ width: 40, height: 40 }}
            title="Expand sidebar"
          >
            <img src={aeLogo} alt="Kaeo" style={{ width: 26, height: 26, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(47,184,166,0.4))' }} />
          </button>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5">
              <img
                src={aeLogo}
                alt="Kaeo"
                style={{ width: 28, height: 28, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(47,184,166,0.35))', flexShrink: 0 }}
              />
              <span
                style={{
                  fontSize: 21,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  color: 'var(--primary)',
                  lineHeight: 1,
                }}
              >
                Kaeo
              </span>
            </div>

            {/* Subtle collapse button */}
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 rounded-lg text-[var(--sidebar-foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--sidebar-active)] transition-colors cursor-pointer"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* WorkspaceSwitcher Area */}
      <div className="px-3 mb-2 flex-shrink-0">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      {/* ── Navigation ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar py-2 px-3 flex flex-col gap-5">
        
        {/* Main Group */}
        <div className="flex flex-col gap-0.5">
          {!collapsed && (
            <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase opacity-50">
              Overview
            </div>
          )}
          <div className="space-y-0.5">
            {primaryNavItems.map((item) => (
              <NavItem key={item.path} item={item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        {/* Secondary / Quick Actions Group */}
        <div className="flex flex-col gap-0.5">
          {!collapsed && (
            <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase opacity-50">
              Actions
            </div>
          )}
          <div className="space-y-0.5">
            <NavItem 
              item={{ icon: Upload, label: 'Import Data', path: '/files' }} 
              collapsed={collapsed} 
              isSecondary 
            />
            <NavItem 
              item={{ icon: FileText, label: 'Generate Report', path: '/reports' }} 
              collapsed={collapsed} 
              isSecondary 
            />
          </div>
        </div>

      </div>

      {/* ── Profile ── */}
      <div className="p-3 relative border-t border-[var(--sidebar-border)] mt-auto" ref={menuRef}>
        <button
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          className={`w-full flex items-center gap-2.5 p-2 rounded-xl transition-all cursor-pointer text-left group ${collapsed ? 'justify-center' : ''} hover:bg-[var(--sidebar-active)]`}
          style={{ borderRadius: 10 }}
        >
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
            style={{
              background: 'rgba(15,118,110,0.12)',
              color: 'var(--primary)',
              border: '1px solid rgba(15,118,110,0.20)',
            }}
          >
            {userInitial}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--sidebar-foreground)] truncate leading-tight">
                {userName}
              </p>
              <p className="text-[11px] text-[var(--sidebar-foreground)] opacity-70 truncate leading-none mt-0.5">
                {userEmail}
              </p>
            </div>
          )}
        </button>

        {/* Profile dropdown */}
        {profileMenuOpen && (
          <div
            className={`absolute bottom-[calc(100%+8px)] w-56 kaeo-popover z-[90] animate-kaeo-scale`}
            style={{ left: collapsed ? 72 : 12 }}
          >
            {/* User info */}
            <div className="px-3 py-2.5 border-b border-[var(--border)] mb-1">
              <p className="text-[11px] font-semibold text-[var(--muted-foreground)] mb-0.5">Signed in as</p>
              <p className="text-[12px] font-semibold text-[var(--foreground)] truncate">{userEmail}</p>
            </div>

            <div className="space-y-0.5 p-1">
              <MenuButton icon={<User className="w-3.5 h-3.5" />} label="My Account"
                onClick={() => { navigate('/account'); setProfileMenuOpen(false); }} />
              <MenuButton icon={<CreditCard className="w-3.5 h-3.5" />} label="Billing & Plans"
                onClick={() => { navigate('/billing'); setProfileMenuOpen(false); }} />
              <MenuButton
                icon={<Settings className="w-3.5 h-3.5" />}
                label={accountMode === 'business_owner' ? 'Business Settings' : 'Workspace Settings'}
                onClick={() => { navigate('/settings'); setProfileMenuOpen(false); }} />
              <MenuButton
                icon={theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                label={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                onClick={toggleTheme} />

              <div className="h-px my-1" style={{ background: 'var(--border)' }} />

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium cursor-pointer transition-all"
                style={{ color: '#C2413A' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(194,65,58,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

/* ── NavItem sub-component ── */
interface NavItemProps {
  item: { icon: React.ElementType; label: string; path: string };
  collapsed: boolean;
  isSecondary?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ item, collapsed, isSecondary }) => {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `nav-item relative ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''} ${isSecondary ? 'opacity-80' : ''}`
      }
      style={collapsed ? { padding: '8px', justifyContent: 'center' } : {}}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="w-[17px] h-[17px] flex-shrink-0" strokeWidth={1.75} />
      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div
          className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap pointer-events-none z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-popover)',
            color: 'var(--foreground)',
          }}
        >
          {item.label}
        </div>
      )}
    </NavLink>
  );
};

/* ── MenuButton sub-component ── */
const MenuButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
}> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all cursor-pointer text-left"
    style={{ color: 'var(--muted-foreground)' }}
    onMouseEnter={e => {
      e.currentTarget.style.background = 'var(--muted)';
      e.currentTarget.style.color = 'var(--foreground)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = 'var(--muted-foreground)';
    }}
  >
    {icon}
    {label}
  </button>
);

export default Sidebar;
