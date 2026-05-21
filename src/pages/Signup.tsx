import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2, AlertCircle, ArrowRight, CheckCircle2, UploadCloud } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/auth/AuthProvider';

const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

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

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 z-10 self-start group">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-primary-foreground font-black text-2xl">K</span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Kaeo<span className="text-[#2fb8a6]">.</span>
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
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
                <span className="text-primary-foreground font-black text-lg">K</span>
              </div>
              <span className="text-2xl font-bold tracking-tight">Kaeo</span>
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
