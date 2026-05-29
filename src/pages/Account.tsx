import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Shield,
  LogOut,
  Copy,
  Check,
  KeyRound,
  Globe,
  Sun,
  Moon,
  Calendar,
  Lock,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';

const Account: React.FC = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [copiedId, setCopiedId] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kaeo-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'dark';
  });

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User';

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(displayName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditName(displayName);
  }, [displayName]);

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: editName }
      });
      if (error) throw error;
      toast('Display name updated successfully', 'success');
      setIsEditing(false);
    } catch (err: any) {
      toast(err.message || 'Failed to update name', 'error');
    } finally {
      setSaving(false);
    }
  };

  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Detect auth provider
  const identities = user?.identities ?? [];
  const hasGoogle = identities.some(id => id.provider === 'google');
  const hasPassword = identities.some(id => id.provider === 'email');
  const signInMethod = hasGoogle ? 'Google OAuth' : hasPassword ? 'Email & Password' : 'Unknown';

  const copyUserId = async () => {
    if (!user?.id) return;
    await navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/account`,
      });
      if (error) throw error;
      toast('Password reset link sent to your email', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to send reset link', 'error');
    } finally {
      setSendingReset(false);
    }
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('kaeo-theme', next);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err: any) {
      toast(err.message || 'Failed to sign out', 'error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal account details and security settings.</p>
      </div>

      {/* ─── Profile Card ─── */}
      <div className="frosted-card p-6">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xl shrink-0 shadow-md shadow-primary/10">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground truncate">{displayName}</h2>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            {createdAt && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Calendar className="w-3 h-3" /> Member since {createdAt}
              </p>
            )}
          </div>
        </div>

        {/* User ID */}
        <div className="mt-5 pt-5 border-t border-border/40">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">User ID</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-muted-foreground bg-muted/30 border border-border/40 rounded-lg px-3 py-2 truncate">
              {user?.id ?? '—'}
            </code>
            <button
              onClick={copyUserId}
              className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border/40"
              title="Copy User ID"
            >
              {copiedId ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Personal Details ─── */}
      <div className="frosted-card p-6 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Personal Details</h3>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition-all"
            >
              Edit
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <User className="w-3 h-3" /> Display Name
            </label>
            {isEditing ? (
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            ) : (
              <div className="px-4 py-2.5 bg-muted/30 border border-border/40 rounded-xl text-sm text-foreground font-medium">
                {displayName}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Mail className="w-3 h-3" /> Email Address
            </label>
            <div className="px-4 py-2.5 bg-muted/30 border border-border/40 rounded-xl text-sm text-foreground font-medium flex items-center justify-between">
              <span>{user?.email}</span>
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          
          {isEditing && (
            <div className="flex gap-3 pt-3 border-t border-border/20">
              <button
                type="button"
                onClick={() => {
                  setEditName(displayName);
                  setIsEditing(false);
                }}
                disabled={saving}
                className="flex-1 py-2 px-4 bg-card border rounded-xl font-semibold hover:bg-muted transition-colors text-xs text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveName}
                disabled={saving || !editName.trim()}
                className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 text-xs"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Security ─── */}
      <div className="frosted-card p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Security</h3>
        </div>

        {/* Sign-in method */}
        <div className="flex items-center justify-between gap-4 py-3 border-b border-border/30">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Sign-in Method</p>
            <p className="text-xs text-muted-foreground">{signInMethod}</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
            hasGoogle
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              : 'bg-primary/10 text-primary border-primary/20'
          }`}>
            {hasGoogle ? <Globe className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
            {hasGoogle ? 'Google' : 'Email'}
          </div>
        </div>

        {/* Google Connection status */}
        <div className="flex items-center justify-between gap-4 py-3 border-b border-border/30">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Google Sign-In</p>
            <p className="text-xs text-muted-foreground">
              {hasGoogle ? 'Your account is connected to Google.' : 'Google sign-in is available at login.'}
            </p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
            hasGoogle
              ? 'text-success bg-success/10 border-success/20'
              : 'text-muted-foreground bg-muted/30 border-border/40'
          }`}>
            {hasGoogle ? 'Connected' : 'Not connected'}
          </span>
        </div>

        {/* Password reset — only relevant for email/password users */}
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Password</p>
            <p className="text-xs text-muted-foreground">
              {hasGoogle && !hasPassword
                ? 'You sign in with Google. No password is set.'
                : 'Send a password reset link to your email.'}
            </p>
          </div>
          {(!hasGoogle || hasPassword) && (
            <button
              onClick={handlePasswordReset}
              disabled={sendingReset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 hover:bg-muted text-foreground rounded-lg text-xs font-bold border border-border/40 hover:border-border transition-all disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {sendingReset ? 'Sending…' : 'Reset Password'}
            </button>
          )}
        </div>
      </div>

      {/* ─── Preferences ─── */}
      <div className="frosted-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          {theme === 'dark' ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
          <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Preferences</h3>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Theme</p>
            <p className="text-xs text-muted-foreground">Currently using {theme === 'dark' ? 'dark' : 'light'} mode.</p>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 bg-muted/40 hover:bg-muted/70 border border-border/40 hover:border-border text-foreground rounded-xl text-xs font-bold transition-all"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </div>

      {/* ─── Danger Zone ─── */}
      <div className="frosted-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <LogOut className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Session</h3>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">Sign Out</p>
            <p className="text-xs text-muted-foreground">End your current session and return to the home page.</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg text-xs font-bold border border-rose-500/20 hover:border-rose-500/30 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Account;
