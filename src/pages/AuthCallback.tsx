import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { useWorkspace } from '../hooks/useWorkspace';
import LoadingState from '../components/ui/LoadingState';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, error: authError } = useAuth();
  const { onboardingCompleted, loading: workspaceLoading, profile, clients, refresh } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Explicitly trigger session extraction/code exchange
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session) {
          // Force-refresh workspace context so the profile data is correctly synced
          await refresh();
        } else {
          // If auth provider is still loading the session, hold on
          if (authLoading) return;
          throw new Error('Could not establish a secure session.');
        }
      } catch (err: any) {
        console.error('Error exchanging OAuth tokens:', err);
        setError(err.message || 'Failed to initialize session');
        setChecking(false);
      }
    };

    processCallback();
  }, [authLoading, refresh]);

  useEffect(() => {
    // Only proceed once loading states are fully complete
    if (!authLoading && !workspaceLoading) {
      if (user) {
        if (profile) {
          setChecking(false);
          if (!onboardingCompleted) {
            navigate('/onboarding', { replace: true });
          } else {
            const isAccountant = profile.account_mode === 'accountant';
            if (isAccountant && (!clients || clients.length === 0)) {
              navigate('/settings?tab=clients', { replace: true });
            } else {
              navigate('/dashboard', { replace: true });
            }
          }
        }
      } else if (!authLoading) {
        setChecking(false);
        setError('No authenticated user session found.');
      }
    }
  }, [user, profile, authLoading, workspaceLoading, onboardingCompleted, clients, navigate]);

  if (checking || authLoading || workspaceLoading) {
    return (
      <div className="min-h-screen bg-[#070908] flex flex-col items-center justify-center space-y-6 text-white font-sans">
        <LoadingState />
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-white">Completing sign-in...</h1>
          <p className="text-sm text-muted-foreground">Setting up your secure CFO workspace.</p>
        </div>
      </div>
    );
  }

  if (error || authError) {
    return (
      <div className="min-h-screen bg-[#070908] flex items-center justify-center p-4 font-sans text-white">
        <div className="w-full max-w-md p-8 rounded-2xl border border-risk/20 bg-white/5 backdrop-blur-md text-center space-y-6">
          <div className="w-16 h-16 bg-risk/15 rounded-full flex items-center justify-center mx-auto border border-risk/20">
            <AlertCircle className="w-8 h-8 text-risk" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-white">Authentication Error</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {error || authError}
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold transition-all hover:opacity-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            Back to Login
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;
