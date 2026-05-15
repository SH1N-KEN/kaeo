import React from 'react';
import { ChevronDown, Building2 } from 'lucide-react';

const ClientSwitcherMock: React.FC = () => {
  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card hover:bg-muted transition-colors text-sm font-medium">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span>TechNova Solutions</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>
      
      {/* Tooltip-like indicator for mock nature */}
      <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-50">
        <div className="bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded border shadow-sm whitespace-nowrap">
          Mock Client Switcher
        </div>
      </div>
    </div>
  );
};

export default ClientSwitcherMock;
