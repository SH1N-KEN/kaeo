import React from 'react';
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
  LogOut
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: MessageSquare, label: 'Ask Kaeo', path: '/ask-kaeo' },
  { icon: Files, label: 'Files', path: '/files' },
  { icon: ArrowRightLeft, label: 'Transactions', path: '/transactions' },
  { icon: Users, label: 'Vendors', path: '/vendors' },
  { icon: AlertTriangle, label: 'Risk Inbox', path: '/risk-inbox' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: UserSquare2, label: 'Clients', path: '/clients' },
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: CreditCard, label: 'Billing', path: '/billing' },
];

const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <aside className="w-64 border-r bg-card flex flex-col h-screen sticky top-0">
      <div className="p-6 flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl leading-none">K</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Kaeo</span>
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto pr-2 -mr-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
              `}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-6 border-t space-y-4">
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-spruce/20 flex items-center justify-center text-blue-spruce font-bold text-xs shrink-0">
              {user?.email?.[0].toUpperCase() || 'U'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold truncate">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {user?.email}
              </span>
            </div>
          </div>
          <button 
            onClick={() => signOut()}
            className="p-1.5 rounded-lg hover:bg-risk/10 hover:text-risk text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
