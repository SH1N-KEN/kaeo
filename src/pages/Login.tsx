import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, AlertCircle, ArrowRight, Brain, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/auth/AuthProvider';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if session exists
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

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
            <span className="text-xs font-bold uppercase tracking-widest text-[#2fb8a6]">India's SME CFO Suite</span>
            <h2 className="text-4xl font-black tracking-tight leading-[1.15]">
              Real-time audit trailing & cash leak detection.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upload bank statements directly. Detect duplicate payments, identify vendor risk anomalies, and chat with your AI advisor to optimize recurring software spend.
            </p>
          </div>

          {/* Mini Mock Dashboard Widget (Risk Alert) */}
          <div className="p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#2fb8a6] flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                Live Risk Screening
              </span>
              <span className="text-[9px] font-bold text-muted-foreground">Just now</span>
            </div>
            <div className="p-3.5 rounded-xl bg-risk/10 border border-risk/20 flex gap-3 items-start">
              <AlertTriangle className="w-4 h-4 text-risk shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white">Duplicate Payments Blocked</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Detected two ₹75,000 transactions matching standard SaaS billing parameters on April 12.
                </p>
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
            <h1 className="text-3xl font-black tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Enter your credentials to access your CFO workspace.</p>
          </div>

          {error && (
            <div className="p-4 bg-risk/5 border border-risk/20 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-risk shrink-0 mt-0.5" />
              <span className="text-sm text-risk font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</label>
                <a href="#" className="text-xs font-bold text-primary hover:underline">Forgot Password?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
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
                  Sign In
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary font-bold hover:underline">Create one</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
