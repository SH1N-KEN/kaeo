import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2, AlertCircle, ArrowRight, CheckCircle2, UploadCloud } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/auth/AuthProvider';
import aeLogo from '../assets/kaeo-ae-logo.png';
import { useToast } from '../hooks/useToast';

const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect to dashboard if session exists
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
      if (!data || !data.url) {
        throw new Error('Google sign-in is not configured yet.');
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setError('Google sign-in is not configured yet.');
      toast('Google sign-in is not configured yet.', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#070908] flex items-center justify-center p-4 font-sans text-white">
        <div className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md text-center space-y-6">
          <div className="w-16 h-16 bg-success/15 rounded-full flex items-center justify-center mx-auto border border-success/20">
            <CheckCircle2 className="w-8 h-8 text-success animate-bounce" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight">Check your email</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We've sent a verification link to <span className="text-white font-bold">{email}</span>.
              Please confirm your email to activate your account.
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold transition-all hover:opacity-95 cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex font-sans">
      {/* Left Side: Brand Promise Banner */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#070908] relative overflow-hidden flex-col justify-between p-12 border-r border-[#2fb8a6]/10 text-white">
        {/* Glow Effects */}
        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-teal-500/5 rounded-full blur-[95px] pointer-events-none" />

        <Link to="/" className="flex items-center gap-2.5 z-10 self-start group">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/25 shrink-0">
            <img src={aeLogo} alt="ae Logo" className="w-4.5 h-4.5 object-contain" />
          </div>
          <span className="text-xl font-black tracking-tight text-white leading-none">
            Kaeo
          </span>
        </Link>

        {/* Core Value Statement & Illustrative Card */}
        <div className="my-auto space-y-10 z-10 max-w-lg">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#2fb8a6]">Automate SME Accounting</span>
            <h2 className="text-4xl font-black tracking-tight leading-[1.15]">
              Get accountant-ready ledgers in minutes.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              No manual transaction classification. Upload statements, run automatic parsing, check active payment risks in the inbox, and keep books accurate and compliant.
            </p>
          </div>

          {/* Mini Mock Upload Widget */}
          <div className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#2fb8a6] flex items-center gap-1.5">
                <UploadCloud className="w-3.5 h-3.5" />
                Ledger Ingestion Engine
              </span>
              <span className="text-[9px] font-bold text-muted-foreground">Supported</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-white/10 bg-white/5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2fb8a6] shrink-0" />
                <span className="text-xs font-bold text-white">CSV Files</span>
              </div>
              <div className="p-3 rounded-xl border border-white/10 bg-white/5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2fb8a6] shrink-0" />
                <span className="text-xs font-bold text-white">XLSX Excel</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="z-10 flex justify-between items-center text-xs text-muted-foreground">
          <span>&copy; 2026 Kaeo Finance OS</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </div>

      {/* Right Side: Auth Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo Only */}
          <div className="flex lg:hidden flex-col items-center justify-center mb-6">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/25 shrink-0">
                <img src={aeLogo} alt="ae Logo" className="w-4.5 h-4.5 object-contain" />
              </div>
              <span className="text-xl font-black tracking-tight text-foreground leading-none">
                Kaeo
              </span>
            </Link>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight">Create your account</h1>
            <p className="text-sm text-muted-foreground">Set up your workspace and start auditing cashflow.</p>
          </div>

          {error && (
            <div className="p-4 bg-risk/5 border border-risk/20 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-risk shrink-0 mt-0.5" />
              <span className="text-sm text-risk font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  placeholder="Arjun Sharma"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="arjun@company.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground font-bold">Or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-3.5 border border-border bg-card hover:bg-muted/40 text-foreground font-bold rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-bold hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
