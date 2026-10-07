// src/features/deadlines/DeadlinesView.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  User,
  Scale,
  FileText,
  Calendar,
  Check,
} from 'lucide-react';
import {
  fetchDeadlines,
  createDeadline,
  markDeadlineDone,
  fetchProfiles,
  fetchCases,
  fetchAgreements,
} from '../../lib/api';
import { clock } from '../../lib/clock';
import {
  DeadlineRecord,
  CoreProfile,
  CaseRecord,
  AgreementRecord,
} from '../../lib/types';

export const DeadlinesView: React.FC = () => {
  const [deadlines, setDeadlines] = useState<DeadlineRecord[]>([]);
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'DONE' | 'ALL'>('OPEN');
  const [typeFilter, setTypeFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [newDeadlineOpen, setNewDeadlineOpen] = useState(false);
  const [completeModalDl, setCompleteModalDl] = useState<DeadlineRecord | null>(null);
  const [doneNote, setDoneNote] = useState('');

  // New deadline state
  const [newDl, setNewDl] = useState({
    targetType: 'case' as 'case' | 'agreement',
    case_id: '',
    agreement_id: '',
    title: '',
    due_date: '',
    deadline_type: 'COURT_ORDERED',
    basis: '',
    owner_user_id: '',
    backup_user_id: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dlList, profList, cList, agrList] = await Promise.all([
        fetchDeadlines({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          ownerId: ownerFilter || undefined,
        }),
        fetchProfiles(),
        fetchCases(),
        fetchAgreements(),
      ]);
      setDeadlines(dlList);
      setProfiles(profList);
      setCases(cList);
      setAgreements(agrList);
    } catch (err) {
      console.error('Failed to load deadlines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, ownerFilter]);

  const handleCreateDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      if (!newDl.owner_user_id || !newDl.backup_user_id) {
        throw new Error('A deadline cannot be saved without an owner and a backup owner.');
      }
      if (newDl.owner_user_id === newDl.backup_user_id) {
        throw new Error('Owner and backup owner must be different team members.');
      }

      await createDeadline({
        case_id: newDl.targetType === 'case' ? newDl.case_id || null : null,
        agreement_id: newDl.targetType === 'agreement' ? newDl.agreement_id || null : null,
        title: newDl.title,
        due_date: newDl.due_date,
        deadline_type: newDl.deadline_type,
        basis: newDl.basis || null,
        owner_user_id: newDl.owner_user_id,
        backup_user_id: newDl.backup_user_id,
      });

      setNewDeadlineOpen(false);
      setNewDl({
        targetType: 'case',
        case_id: '',
        agreement_id: '',
        title: '',
        due_date: '',
        deadline_type: 'COURT_ORDERED',
        basis: '',
        owner_user_id: '',
        backup_user_id: '',
      });
      await loadData();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create deadline');
    }
  };

  const handleConfirmComplete = async () => {
    if (!completeModalDl) return;
    try {
      await markDeadlineDone(completeModalDl.id, doneNote);
      setCompleteModalDl(null);
      setDoneNote('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to complete deadline');
    }
  };

  const today = clock.todayYMD();

  const filteredDeadlines = deadlines.filter((dl) => {
    if (typeFilter && dl.deadline_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const matchTitle = dl.title.toLowerCase().includes(s);
      const matchCase = dl.case?.cause_title.toLowerCase().includes(s) || dl.case?.case_number?.toLowerCase().includes(s);
      const matchAgr = dl.agreement?.title.toLowerCase().includes(s);
      if (!matchTitle && !matchCase && !matchAgr) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Litigation &amp; Contract Deadlines Docket
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Firm-wide statutory, court-ordered, renewal, and internal deadlines with guaranteed primary and backup owners
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewDeadlineOpen(true);
            setCreateError(null);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          Add Deadline
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center gap-3">
        {/* Status Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('OPEN')}
            className={`px-3 py-1 font-semibold rounded transition ${
              statusFilter === 'OPEN'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('DONE')}
            className={`px-3 py-1 font-semibold rounded transition ${
              statusFilter === 'DONE'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Completed
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 font-semibold rounded transition ${
              statusFilter === 'ALL'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deadline title, case, or agreement..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* Type Filter */}
        <div className="w-44">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
          >
            <option value="">All Deadline Types</option>
            <option value="STATUTORY">STATUTORY</option>
            <option value="COURT_ORDERED">COURT_ORDERED</option>
            <option value="RENEWAL">RENEWAL</option>
            <option value="INTERNAL">INTERNAL</option>
          </select>
        </div>

        {/* Owner Filter */}
        <div className="w-44">
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
          >
            <option value="">All Assignees</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Deadlines List */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading firm-wide deadlines...</div>
      ) : filteredDeadlines.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            No Deadlines Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {statusFilter === 'OPEN'
              ? 'No open deadlines matching the current filter. All tasks are currently on track!'
              : 'No deadlines logged under this criteria.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3 w-32">Due Date</th>
                  <th className="py-3 px-3">Title &amp; Matter</th>
                  <th className="py-3 px-3 w-32">Type</th>
                  <th className="py-3 px-3 w-40">Basis</th>
                  <th className="py-3 px-3 w-48">Owner &amp; Backup</th>
                  <th className="py-3 px-4 w-28 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredDeadlines.map((dl) => {
                  const isOverdue = dl.status === 'OPEN' && dl.due_date < today;
                  const isDueToday = dl.status === 'OPEN' && dl.due_date === today;

                  return (
                    <tr key={dl.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      {/* Due Date & Urgency */}
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {dl.due_date}
                        </div>
                        {dl.status === 'DONE' ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded-full inline-block mt-0.5">
                            COMPLETED
                          </span>
                        ) : isOverdue ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.2 rounded-full inline-block mt-0.5">
                            OVERDUE
                          </span>
                        ) : isDueToday ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded-full inline-block mt-0.5">
                            DUE TODAY
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Open
                          </span>
                        )}
                      </td>

                      {/* Title & Matter */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {dl.title}
                        </div>
                        {dl.case && (
                          <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                            <Scale className="w-3 h-3 shrink-0" />
                            <Link to={`/cases/${dl.case.id}`} className="hover:underline">
                              {dl.case.cause_title} ({dl.case.case_number || 'Court Case'})
                            </Link>
                          </div>
                        )}
                        {dl.agreement && (
                          <div className="flex items-center gap-1.5 text-[11px] text-teal-600 dark:text-teal-400 mt-0.5">
                            <FileText className="w-3 h-3 shrink-0" />
                            <Link to={`/agreements/${dl.agreement.id}`} className="hover:underline">
                              {dl.agreement.title}
                            </Link>
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-3 px-3">
                        <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {dl.deadline_type}
                        </span>
                      </td>

                      {/* Basis */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                        {dl.basis || '—'}
                      </td>

                      {/* Primary & Backup Owners */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{dl.owner_profile?.display_name || 'Owner'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 pl-5">
                          Backup: <strong className="text-slate-700 dark:text-slate-300">{dl.backup_profile?.display_name || 'Backup'}</strong>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        {dl.status === 'OPEN' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCompleteModalDl(dl);
                              setDoneNote('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 rounded transition"
                          >
                            <Check className="w-3 h-3" />
                            Done
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            {dl.done_note ? `Note: ${dl.done_note}` : 'Finished'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {completeModalDl && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Mark Deadline as Complete
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Confirming completion of: <strong className="text-slate-900 dark:text-slate-100">&ldquo;{completeModalDl.title}&rdquo;</strong>
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1">Completion Note / Filing Confirmation</label>
              <textarea
                rows={2}
                value={doneNote}
                onChange={(e) => setDoneNote(e.target.value)}
                placeholder="e.g. Written statement filed on index receipt #8912..."
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompleteModalDl(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmComplete}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Deadline Modal */}
      {newDeadlineOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateDeadline}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Log New Docket Deadline
            </h3>

            <div className="space-y-3">
              {/* Target Type */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewDl({ ...newDl, targetType: 'case' })}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                    newDl.targetType === 'case'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  Court Case Matter
                </button>
                <button
                  type="button"
                  onClick={() => setNewDl({ ...newDl, targetType: 'agreement' })}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                    newDl.targetType === 'agreement'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  Agreement / Contract
                </button>
              </div>

              {/* Target Select */}
              {newDl.targetType === 'case' ? (
                <div>
                  <label className="block text-xs font-semibold mb-1">Select Case</label>
                  <select
                    value={newDl.case_id}
                    onChange={(e) => setNewDl({ ...newDl, case_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  >
                    <option value="">General Litigation Deadline (No Specific Case)</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.cause_title} ({c.case_number || 'Case'})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold mb-1">Select Agreement</label>
                  <select
                    value={newDl.agreement_id}
                    onChange={(e) => setNewDl({ ...newDl, agreement_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  >
                    <option value="">General Contract Deadline (No Specific Agreement)</option>
                    {agreements.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title} ({a.agreement_type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold mb-1">Deadline Title *</label>
                <input
                  type="text"
                  required
                  value={newDl.title}
                  onChange={(e) => setNewDl({ ...newDl, title: e.target.value })}
                  placeholder="e.g. Filing Written Statement within 30 days"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={newDl.due_date}
                    onChange={(e) => setNewDl({ ...newDl, due_date: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Deadline Type *</label>
                  <select
                    value={newDl.deadline_type}
                    onChange={(e) => setNewDl({ ...newDl, deadline_type: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                  >
                    <option value="STATUTORY">STATUTORY</option>
                    <option value="COURT_ORDERED">COURT_ORDERED</option>
                    <option value="RENEWAL">RENEWAL</option>
                    <option value="INTERNAL">INTERNAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Basis / Statutory Reference</label>
                <input
                  type="text"
                  value={newDl.basis}
                  onChange={(e) => setNewDl({ ...newDl, basis: e.target.value })}
                  placeholder="e.g. Order VIII Rule 1 CPC (30 days from summons service)"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg"
                />
              </div>

              {/* Strict Rule: Owner and Backup Owner are required */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Primary Owner <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={newDl.owner_user_id}
                    onChange={(e) => setNewDl({ ...newDl, owner_user_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border rounded-lg"
                  >
                    <option value="">Select Assignee</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    Backup Owner <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={newDl.backup_user_id}
                    onChange={(e) => setNewDl({ ...newDl, backup_user_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border rounded-lg"
                  >
                    <option value="">Select Backup</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 text-[10px] text-slate-500">
                  Rule: Every deadline requires both primary and backup assignees to prevent missed dates.
                </div>
              </div>
            </div>

            {createError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{createError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewDeadlineOpen(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
              >
                Save Deadline
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default DeadlinesView;
