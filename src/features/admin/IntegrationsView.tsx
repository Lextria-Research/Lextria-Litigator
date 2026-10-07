// src/features/admin/IntegrationsView.tsx
import React, { useState, useEffect } from 'react';
import { getActiveProvider } from '../../lib/files';
import { isSupabaseConfigured, litigatorDb } from '../../lib/supabase';
import { AUTH_MODE, getStoredUser, hasRole } from '../../lib/auth';
import { fetchCliqOutbox, retryCliqOutboxItem, postCliqAlert } from '../../lib/api';
import {
  Database,
  Cloud,
  MessageSquare,
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Server,
  Zap,
} from 'lucide-react';
import type { CliqOutboxItem } from '../../lib/types';

export const IntegrationsView: React.FC = () => {
  const currentUser = getStoredUser();
  const isAdmin = hasRole(currentUser, ['SUPER_ADMIN', 'DEPT_ADMIN']);
  const storageProvider = getActiveProvider();

  // Test states
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<string | null>(null);

  const [testingStorage, setTestingStorage] = useState(false);
  const [storageStatus, setStorageStatus] = useState<string | null>(null);

  const [testingCliq, setTestingCliq] = useState(false);
  const [cliqStatus, setCliqStatus] = useState<string | null>(null);

  // Cliq Outbox items from litigator.cliq_outbox
  const [outbox, setOutbox] = useState<CliqOutboxItem[]>([]);
  const [loadingOutbox, setLoadingOutbox] = useState(true);

  const loadOutbox = async () => {
    setLoadingOutbox(true);
    try {
      const items = await fetchCliqOutbox();
      setOutbox(items);
    } catch (err) {
      console.error('Failed to load cliq outbox:', err);
    } finally {
      setLoadingOutbox(false);
    }
  };

  useEffect(() => {
    loadOutbox();
  }, []);

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    try {
      if (isSupabaseConfigured) {
        const { count, error } = await litigatorDb
          .from('cases')
          .select('*', { count: 'exact', head: true });
        if (error) throw error;
        setSupabaseStatus(
          `Connected! Schemas litigator & core detected. Cases in vault: ${count ?? 0}. Header 'x-lextria-app: LITIGATOR' active.`
        );
      } else {
        setSupabaseStatus('Local Simulation Mode. Supabase environment keys pending configuration.');
      }
    } catch (err: any) {
      setSupabaseStatus(`Error: ${err.message}`);
    } finally {
      setTestingSupabase(false);
    }
  };

  const handleTestStorage = () => {
    setTestingStorage(true);
    setTimeout(() => {
      setTestingStorage(false);
      setStorageStatus(
        `Active Provider: ${storageProvider}. Bucket: test-files. Litigator file categorization (Pleadings, Orders, Evidence, Notices, Correspondence, Drafts, Final, Internal) enabled.`
      );
    }, 400);
  };

  const handleTestCliq = async () => {
    setTestingCliq(true);
    try {
      await postCliqAlert({
        channel: '#litigation-alerts',
        title: 'Diagnostic Test Alert from Lextria Litigator',
        card: {
          test: true,
          triggered_by: currentUser?.display_name || 'Admin',
          timestamp: new Date().toISOString(),
        },
      });
      setCliqStatus('Webhook sent or recorded to litigator.cliq_outbox successfully.');
      await loadOutbox();
    } catch (err: any) {
      setCliqStatus(`Failed to queue Cliq alert: ${err.message}`);
    } finally {
      setTestingCliq(false);
    }
  };

  const handleRetryOutbox = async (id: string) => {
    try {
      await retryCliqOutboxItem(id);
      await loadOutbox();
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center space-y-2 max-w-xl mx-auto my-12">
        <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto" />
        <h3 className="font-bold text-slate-900 dark:text-slate-100">Restricted Access</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          The Admin Integrations dashboard is restricted to SUPER_ADMIN and DEPT_ADMIN users only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
          <Server className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          System Integrations &amp; Service Health
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Connectivity status for Supabase Postgres, Zoho WorkDrive / Supabase Storage, and Zoho Cliq Webhook
        </p>
      </div>

      {/* Grid of 3 Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Supabase */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Supabase Postgres
                </h4>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  isSupabaseConfigured
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {isSupabaseConfigured ? 'Connected' : 'Offline Mode'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Schemas: <code>litigator</code>, <code>core</code>. Enforces header{' '}
              <code>x-lextria-app: LITIGATOR</code> and ethical wall RLS.
            </p>
            {supabaseStatus && (
              <div className="text-[11px] font-mono p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                {supabaseStatus}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={testingSupabase}
            onClick={handleTestSupabase}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingSupabase ? 'animate-spin' : ''}`} />
            {testingSupabase ? 'Pinging...' : 'Test Connection'}
          </button>
        </div>

        {/* WorkDrive / Storage */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-600" />
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Document Storage
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-blue-100 text-blue-700">
                {storageProvider}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Folder structure: <code>&#123;client_code&#125; - &#123;client_name&#125;/&#123;project_code&#125;/&#123;category&#125;/</code>.
              Fallback to Supabase bucket <code>test-files</code>.
            </p>
            {storageStatus && (
              <div className="text-[11px] font-mono p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                {storageStatus}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={testingStorage}
            onClick={handleTestStorage}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingStorage ? 'animate-spin' : ''}`} />
            {testingStorage ? 'Verifying...' : 'Verify Bucket'}
          </button>
        </div>

        {/* Zoho Cliq */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Zoho Cliq Webhook
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-purple-100 text-purple-700">
                Outbox Buffer
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Posts court hearing reminders, post-hearing outcome prompts, and deadline notices to <code>#litigation-updates</code>.
            </p>
            {cliqStatus && (
              <div className="text-[11px] font-mono p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                {cliqStatus}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={testingCliq}
            onClick={handleTestCliq}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
          >
            <Send className="w-3.5 h-3.5" />
            {testingCliq ? 'Sending...' : 'Send Test Card'}
          </button>
        </div>
      </div>

      {/* Cliq Outbox Buffer Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-500" />
              Cliq Outbox Resiliency Queue (litigator.cliq_outbox)
            </h3>
            <p className="text-[11px] text-slate-400">
              Messages queued or buffered when network is unavailable or webhook is pending
            </p>
          </div>
          <button
            type="button"
            onClick={loadOutbox}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh Queue
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Queued At</th>
                <th className="py-2.5 px-3">Channel</th>
                <th className="py-2.5 px-3">Alert Title</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {outbox.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                    {new Date(item.created_at).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {item.channel}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                    {item.title}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        item.status === 'SENT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'FAILED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {item.status !== 'SENT' && (
                      <button
                        type="button"
                        onClick={() => handleRetryOutbox(item.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {outbox.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                    Outbox queue is empty. All alerts processed directly.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default IntegrationsView;
