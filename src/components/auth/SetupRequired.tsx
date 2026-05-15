import React from 'react';
import { AlertTriangle, ExternalLink, Settings } from 'lucide-react';
import { getSupabaseConfigError } from '../../lib/supabase';

const SetupRequired: React.FC = () => {
  const error = getSupabaseConfigError();

  return (
    <div className="min-h-screen bg-[#0C1110] text-porcelain flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-[#141C1B] border border-blue-spruce/30 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mb-6 border border-warning/20">
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>
          
          <h1 className="text-2xl font-bold mb-2">Supabase Configuration Required</h1>
          <p className="text-muted-foreground mb-8">
            Kaeo needs a Supabase connection to handle authentication and data.
          </p>

          <div className="w-full space-y-4 text-left mb-8">
            {error?.missing.length ? (
              <div className="p-4 bg-risk/5 border border-risk/20 rounded-lg">
                <span className="text-xs font-bold text-risk uppercase tracking-wider block mb-2">Missing Keys</span>
                <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                  {error.missing.map(key => <li key={key}><code className="bg-background px-1 rounded">{key}</code></li>)}
                </ul>
              </div>
            ) : null}

            {error?.malformed.length ? (
              <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
                <span className="text-xs font-bold text-warning uppercase tracking-wider block mb-2">Malformed Keys</span>
                <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                  {error.malformed.map(key => <li key={key}><code className="bg-background px-1 rounded">{key}</code></li>)}
                </ul>
                <p className="text-[10px] mt-2 text-muted-foreground">
                  URL must start with <code className="bg-background px-1 rounded">https://</code> and end with <code className="bg-background px-1 rounded">.supabase.co</code>
                </p>
              </div>
            ) : null}
          </div>

          <div className="w-full space-y-3">
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-blue-spruce hover:bg-ocean-mist text-porcelain rounded-xl font-semibold transition-colors shadow-lg shadow-blue-spruce/10"
            >
              Go to Supabase Dashboard
              <ExternalLink className="w-4 h-4" />
            </a>
            
            <div className="p-4 bg-muted/5 rounded-xl border border-white/5 text-[11px] text-muted-foreground flex gap-3 items-start">
              <Settings className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Add these variables to your <code className="text-porcelain">.env</code> file in the project root and restart the development server.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupRequired;
