// src/features/auth/LoginView.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { setStoredUser, UserProfile } from '../../lib/auth';
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  Shield,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanInput = email.trim();
    let pwd = password.trim();

    if (!cleanInput || !pwd) {
      setError('Please provide your work email or username and password.');
      setLoading(false);
      return;
    }

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Database authentication service is not configured.');
      }

      // 1. Resolve email if display name was entered
      let authEmail = cleanInput.includes('@') ? cleanInput.toLowerCase() : null;

      if (!authEmail) {
        try {
          const { data: profileMatch } = await supabase
            .schema('core')
            .from('profiles')
            .select('email, display_name, role')
            .ilike('display_name', cleanInput)
            .maybeSingle();

          if (profileMatch?.email) {
            authEmail = profileMatch.email.toLowerCase();
          }
        } catch (lookupErr) {
          console.warn('Profile lookup fallback warning:', lookupErr);
        }
      }

      const finalEmail = authEmail || cleanInput.toLowerCase();

      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: finalEmail,
        password: pwd,
      });

      if (authErr) {
        throw new Error(authErr.message || 'Invalid email or password.');
      }

      if (data?.user) {
        const meta = data.user.user_metadata || {};
        const dashAccess = meta.dashboard_access || {};

        // Fetch official profile from core.profiles
        const { data: profileData } = await supabase
          .schema('core')
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        const isSuperAdmin = profileData?.role === 'SUPER_ADMIN' || meta.role === 'SUPER_ADMIN';
        const litAccess = dashAccess.litigator || {};

        if (!isSuperAdmin && litAccess.enabled === false) {
          throw new Error('Access to Litigator is disabled for your account. Please contact an Administrator.');
        }

        const profile: UserProfile = profileData || {
          id: data.user.id,
          email: data.user.email || finalEmail,
          display_name: meta.display_name || finalEmail.split('@')[0],
          role: profileData?.role || meta.role || 'STAFF',
          department: profileData?.department || meta.department || 'LITIGATION',
          is_finance_lead: false,
          active: true,
        };

        setStoredUser(profile);
        navigate('/');
        return;
      }

      throw new Error('No user returned from authentication.');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-indigo-600 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl tracking-tight shadow-md shadow-indigo-600/20">
            LX
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          Lextria Litigator
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          Enterprise Litigation Operations Portal • Universal SSO
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-slate-200 dark:border-slate-800">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Universal Work Email or Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. pranavbhat@lextria.in or Pranav Bhat"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-indigo-600 transition"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-indigo-600 transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden disabled:opacity-50 transition cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating with Central SSO...</span>
                </>
              ) : (
                <>
                  <span>Sign In with Universal Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              <span>Universal Firm Single Sign-On Enabled</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Lextria Litigation Cockpit &bull; Central Single Sign-On
        </p>
      </div>
    </div>
  );
};

export default LoginView;
