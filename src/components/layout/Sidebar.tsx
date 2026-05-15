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
  CreditCard 
} from 'lucide-react';

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
  return (
    <aside className="w-64 border-r bg-card flex flex-col h-screen sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl leading-none">K</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Kaeo</span>
        </div>

        <nav className="space-y-1">
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

      <div className="mt-auto p-6 border-t">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50">
          <div className="w-8 h-8 rounded-full bg-blue-spruce/20 flex items-center justify-center text-blue-spruce font-bold text-xs">
            SK
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold truncate">Sreevatsa K.</span>
            <span className="text-[10px] text-muted-foreground truncate">Founding Member</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
