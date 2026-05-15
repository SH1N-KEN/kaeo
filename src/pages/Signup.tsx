import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-card border rounded-2xl p-8 shadow-xl text-center">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Check your email</h1>
          <p className="text-muted-foreground mb-8">
            We've sent a verification link to <span className="text-foreground font-semibold">{email}</span>.
            Please confirm your email to continue.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold transition-all"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-12 justify-center">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-primary-foreground font-bold text-2xl">K</span>
          </div>
          <span className="text-3xl font-bold tracking-tighter">Kaeo</span>
        </div>

        <div className="bg-card border rounded-2xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold mb-2">Create your workspace</h1>
          <p className="text-muted-foreground mb-8 text-sm">Join the next generation of AI-driven finance in India.</p>

          {error && (
            <div className="mb-6 p-4 bg-risk/5 border border-risk/20 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-risk shrink-0 mt-0.5" />
              <span className="text-sm text-risk font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  placeholder="Arjun Sharma"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="arjun@company.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  Get Started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline">Sign In</Link>
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          By continuing, you agree to Kaeo's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default Signup;
