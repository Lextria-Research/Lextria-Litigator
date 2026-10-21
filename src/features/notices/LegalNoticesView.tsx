// src/features/notices/LegalNoticesView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Plus,
  Search,
  Building2,
  Calendar,
  IndianRupee,
  Scale,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ShieldCheck,
  ChevronRight,
  User,
  Filter,
} from 'lucide-react';
import { fetchLegalNotices, fetchClients, fetchProfiles } from '../../lib/api';
import { clock } from '../../lib/clock';
import { formatINR } from '../../lib/currency';
import type { CaseRecord, CoreClient, CoreProfile } from '../../lib/types';
import { NewNoticeModal } from './NewNoticeModal';
import { ConvertNoticeModal } from './ConvertNoticeModal';
import { ClientSearchSelect } from '../../components/common/ClientSearchSelect';

export const LegalNoticesView: React.FC = () => {
  const navigate = useNavigate();

  const [notices, setNotices] = useState<CaseRecord[]>([]);
  const [clients, setClients] = useState<CoreClient[]>([]);
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [newNoticeOpen, setNewNoticeOpen] = useState(false);
  const [convertingNotice, setConvertingNotice] = useState<CaseRecord | null>(null);

  const loadNotices = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nList, cList, pList] = await Promise.all([
        fetchLegalNotices(),
        fetchClients(),
        fetchProfiles(),
      ]);
      setNotices(nList || []);
      setClients(cList || []);
      setProfiles(pList || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load legal notices docket.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, []);

  // Filtered notices
  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = (n.project_code?.code || '').toLowerCase();
        const title = (n.cause_title || '').toLowerCase();
        const opp = (n.opponent_name || '').toLowerCase();
        const client = (n.project_code?.client?.client_name || '').toLowerCase();
        if (
          !code.includes(q) &&
          !title.includes(q) &&
          !opp.includes(q) &&
          !client.includes(q)
        ) {
          return false;
        }
      }

      // Client filter
      if (selectedClientId && n.project_code?.client_id !== selectedClientId) {
        return false;
      }

      // Status filter
      if (statusFilter === 'ACTIVE') {
        return n.current_stage !== 'Settled' && n.current_stage !== 'Closed' && n.current_stage !== 'Disposed';
      }
      if (statusFilter === 'SETTLED') {
        return n.current_stage === 'Settled' || n.current_stage === 'Closed';
      }

      return true;
    });
  }, [notices, searchQuery, selectedClientId, statusFilter]);

  // Statistics
  const totalCount = notices.length;
  const activeCount = notices.filter(
    (n) => n.current_stage !== 'Settled' && n.current_stage !== 'Closed' && n.current_stage !== 'Disposed'
  ).length;
  const settledCount = notices.filter(
    (n) => n.current_stage === 'Settled' || n.current_stage === 'Closed'
  ).length;
  const totalDemandValue = notices.reduce(
    (sum, n) => sum + (Number(n.claim_value) || 0),
    0
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
              <Send className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <span>Legal Notices Dashboard</span>
            </h1>
            <span className="text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
              LC Series
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pre-litigation tracking docket • Track notices, dispute replies, and 1-click escalate to Court Cases
          </p>
        </div>

        <button
          type="button"
          onClick={() => setNewNoticeOpen(true)}
          className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-600/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Draft &amp; Issue Legal Notice</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Total Notices Issued</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-400">
            All pre-litigation records
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Awaiting Reply / Active</span>
          </div>
          <div className="text-2xl font-bold text-amber-900 dark:text-amber-200">
            {activeCount}
          </div>
          <div className="text-[11px] text-amber-700/70 dark:text-amber-400">
            Pending response / in negotiation
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Settled at Notice Stage</span>
          </div>
          <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-200">
            {settledCount}
          </div>
          <div className="text-[11px] text-emerald-700/70 dark:text-emerald-400">
            Resolved without court filing
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
            <span>Total Demand Value</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {formatINR(totalDemandValue)}
          </div>
          <div className="text-[11px] text-slate-400">
            Aggregate claims demanded
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative sm:col-span-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, subject, opponent, client..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Client Filter */}
          <div className="sm:col-span-1">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="">All Clients ({clients.length})</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client_name} ({c.client_code || 'CL'})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="ALL">All Notice Statuses</option>
              <option value="ACTIVE">Active / Awaiting Reply</option>
              <option value="SETTLED">Settled / Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notices List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            Loading legal notices docket...
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Send className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No Legal Notices Found
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedClientId || statusFilter !== 'ALL'
                ? 'No notices match your current filters. Clear filters to see all.'
                : 'No legal notices recorded yet. Click "Draft & Issue Legal Notice" to create one.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredNotices.map((n) => {
              const isSettled =
                n.current_stage === 'Settled' || n.current_stage === 'Closed';

              return (
                <div
                  key={n.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                        {n.project_code?.code}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                          isSettled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {n.current_stage || 'Notice Sent'}
                      </span>

                      {n.filing_date && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3" />
                          <span>{clock.formatDisplay(n.filing_date)}</span>
                        </span>
                      )}
                    </div>

                    <div>
                      <h3
                        onClick={() => navigate(`/cases/${n.id}`)}
                        className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 transition cursor-pointer"
                      >
                        {n.cause_title}
                      </h3>

                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>
                            Client: <strong className="text-slate-700 dark:text-slate-300">{n.project_code?.client?.client_name || '—'}</strong>
                          </span>
                        </span>

                        <span>•</span>

                        <span>
                          Opposite Party: <strong className="text-slate-700 dark:text-slate-300">{n.opponent_name || 'Notice Recipient'}</strong>
                        </span>

                        {n.claim_value ? (
                          <>
                            <span>•</span>
                            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              Claim: {formatINR(n.claim_value)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => navigate(`/cases/${n.id}`)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer flex items-center gap-1 border border-slate-200 dark:border-slate-700"
                    >
                      <span>Matter Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setConvertingNotice(n)}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
                      title="Convert notice into a formal court case without changing matter code"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>Convert to Court Case</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Notice Modal */}
      {newNoticeOpen && (
        <NewNoticeModal
          isOpen={newNoticeOpen}
          onClose={() => setNewNoticeOpen(false)}
          onSuccess={loadNotices}
        />
      )}

      {/* Convert Notice Modal */}
      {convertingNotice && (
        <ConvertNoticeModal
          isOpen={Boolean(convertingNotice)}
          onClose={() => setConvertingNotice(null)}
          onSuccess={(convertedCase) => {
            setConvertingNotice(null);
            navigate(`/cases/${convertedCase.id}`);
          }}
          notice={convertingNotice}
        />
      )}
    </div>
  );
};

export default LegalNoticesView;
