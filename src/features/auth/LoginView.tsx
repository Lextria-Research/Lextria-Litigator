// src/features/auth/LoginView.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { setStoredUser, UserProfile } from '../../lib/auth';
import { Lock, Mail, AlertCircle, ArrowRight, Shield } from 'lucide-react';

export const LoginView: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('pranavbhat@lextria.in');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    const pwd = password.trim();

    if (!normalizedEmail || !pwd) {
      setError('Please provide your work email and password.');
      setLoading(false);
      return;
    }

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Database authentication service is not configured.');
      }

      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: pwd,
      });

      if (authErr) {
        throw new Error(authErr.message || 'Invalid email or password.');
      }

      if (data?.user) {
        // Fetch official profile from core.profiles
        const { data: profileData } = await supabase
          .schema('core')
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        const profile: UserProfile = profileData || {
          id: data.user.id,
          email: data.user.email || normalizedEmail,
          display_name: data.user.user_metadata?.display_name || normalizedEmail.split('@')[0],
          role: data.user.user_metadata?.role || 'SUPER_ADMIN',
          department: data.user.user_metadata?.department || 'MANAGEMENT',
          is_finance_lead: data.user.user_metadata?.role === 'FINANCE',
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
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
          Enterprise Litigation Operations Portal
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
                Work Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pranavbhat@lextria.in"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-indigo-600 font-mono"
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
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-indigo-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              <span>Protected by End-to-End Enterprise Access Control</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
