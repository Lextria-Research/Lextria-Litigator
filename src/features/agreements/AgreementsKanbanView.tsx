// src/features/agreements/AgreementsKanbanView.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Kanban,
  List,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Shield,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  fetchAgreements,
  fetchProfiles,
  updateAgreementStage,
} from '../../lib/api';
import {
  AGREEMENT_STAGES,
  AGREEMENT_TYPES,
  AgreementRecord,
  AgreementStage,
  CoreProfile,
} from '../../lib/types';
import { NewAgreementModal } from './NewAgreementModal';

const KANBAN_STAGES: AgreementStage[] = [
  'INTAKE',
  'DRAFTING',
  'INTERNAL_REVIEW',
  'CLIENT_REVIEW',
  'COUNTERPARTY_REVIEW',
  'NEGOTIATION',
  'FINALIZED',
  'EXECUTED',
  'STAMPED_REGISTERED',
];

export const AgreementsKanbanView: React.FC = () => {
  const navigate = useNavigate();
  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedLead, setSelectedLead] = useState('');
  const [selectedStage, setSelectedStage] = useState('');

  // Modals
  const [newAgrOpen, setNewAgrOpen] = useState(false);
  const [stageModalAgr, setStageModalAgr] = useState<AgreementRecord | null>(null);
  const [targetStage, setTargetStage] = useState<AgreementStage | null>(null);
  const [executionDateInput, setExecutionDateInput] = useState('');
  const [stageError, setStageError] = useState<string | null>(null);
  const [updatingStage, setUpdatingStage] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [agrList, profList] = await Promise.all([
        fetchAgreements({
          agreementType: selectedType || undefined,
          leadUserId: selectedLead || undefined,
          stage: selectedStage || undefined,
          search: search || undefined,
        }),
        fetchProfiles(),
      ]);
      setAgreements(agrList);
      setProfiles(profList);
    } catch (err) {
      console.error('Failed to load agreements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedType, selectedLead, selectedStage, search]);

  const handleStageChangeRequest = (agr: AgreementRecord, newStage: AgreementStage) => {
    setStageModalAgr(agr);
    setTargetStage(newStage);
    setExecutionDateInput(agr.execution_date || new Date().toISOString().split('T')[0]);
    setStageError(null);
  };

  const handleConfirmStageChange = async () => {
    if (!stageModalAgr || !targetStage) return;
    setUpdatingStage(true);
    setStageError(null);
    try {
      await updateAgreementStage(stageModalAgr.id, targetStage, {
        executionDate: targetStage === 'EXECUTED' ? executionDateInput : undefined,
      });
      setStageModalAgr(null);
      setTargetStage(null);
      await loadData();
    } catch (err: any) {
      setStageError(err.message || 'Failed to update stage');
    } finally {
      setUpdatingStage(false);
    }
  };

  const getStageBadgeColor = (st: string) => {
    switch (st) {
      case 'INTAKE':
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      case 'DRAFTING':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'INTERNAL_REVIEW':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'CLIENT_REVIEW':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'COUNTERPARTY_REVIEW':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'NEGOTIATION':
        return 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 'FINALIZED':
        return 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800';
      case 'EXECUTED':
      case 'STAMPED_REGISTERED':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'EXPIRED':
      case 'TERMINATED':
      case 'ABANDONED':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Contracts &amp; Agreements Vault
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            End-to-end contract drafting, stakeholder review stages, signing, stamping, and renewals
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Table
            </button>
          </div>

          <button
            type="button"
            onClick={() => setNewAgrOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            New Agreement
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agreement title, type, code..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* Agreement Type Filter */}
        <div className="w-40">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
          >
            <option value="">All Types</option>
            {AGREEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Lead Drafter Filter */}
        <div className="w-44">
          <select
            value={selectedLead}
            onChange={(e) => setSelectedLead(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
          >
            <option value="">All Drafters / Leads</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </div>

        {/* Stage Filter (for List mode) */}
        {viewMode === 'list' && (
          <div className="w-40">
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
            >
              <option value="">All Stages</option>
              {AGREEMENT_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        )}

        {(search || selectedType || selectedLead || selectedStage) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedType('');
              setSelectedLead('');
              setSelectedStage('');
            }}
            className="text-xs text-slate-400 hover:text-indigo-600 transition underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading agreements docket...</div>
      ) : agreements.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            No Agreements Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Get started by logging a new agreement intake or filtering by different criteria.
          </p>
          <button
            type="button"
            onClick={() => setNewAgrOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            Create First Agreement
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban Board */
        <div className="flex gap-4 overflow-x-auto pb-6">
          {KANBAN_STAGES.map((stage) => {
            const stageAgreements = agreements.filter((a) => a.stage === stage);
            return (
              <div
                key={stage}
                className="w-72 shrink-0 bg-slate-100/70 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[calc(100vh-250px)]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {stage.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                    {stageAgreements.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
                  {stageAgreements.map((agr) => (
                    <div
                      key={agr.id}
                      className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700 shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-600 transition group flex flex-col justify-between"
                    >
                      <div>
                        {/* Header Info */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {agr.agreement_type}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {agr.project_code?.code}
                          </span>
                        </div>

                        {/* Title */}
                        <Link
                          to={`/agreements/${agr.id}`}
                          className="font-bold text-xs text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-2"
                        >
                          {agr.title}
                        </Link>

                        {/* Client */}
                        <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                          Client: <span className="font-medium text-slate-700 dark:text-slate-300">{agr.project_code?.client?.client_name || '—'}</span>
                        </div>

                        {/* Parties & Terms */}
                        {agr.key_terms && (
                          <div className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic">
                            &ldquo;{agr.key_terms}&rdquo;
                          </div>
                        )}
                      </div>

                      {/* Card Footer */}
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <User className="w-3 h-3 text-indigo-500" />
                          <span className="truncate max-w-[80px]">
                            {agr.lead_user?.display_name?.split(' ')[0] || 'Unassigned'}
                          </span>
                        </div>

                        {/* Move stage action dropdown */}
                        <div className="relative">
                          <select
                            value={agr.stage}
                            onChange={(e) =>
                              handleStageChangeRequest(agr, e.target.value as AgreementStage)
                            }
                            className="text-[10px] font-semibold bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-300 focus:outline-indigo-500"
                          >
                            {AGREEMENT_STAGES.map((s) => (
                              <option key={s} value={s}>
                                {s.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}

                  {stageAgreements.length === 0 && (
                    <div className="py-8 text-center text-[11px] text-slate-400 italic">
                      Empty stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Agreement Title</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Stage</th>
                  <th className="py-3 px-3">Lead Drafter</th>
                  <th className="py-3 px-3">Effective &bull; Expiry</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {agreements.map((agr) => (
                  <tr key={agr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <Link
                        to={`/agreements/${agr.id}`}
                        className="font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 transition"
                      >
                        {agr.title}
                      </Link>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {agr.project_code?.code}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {agr.agreement_type}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {agr.project_code?.client?.client_name || '—'}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getStageBadgeColor(
                          agr.stage
                        )}`}
                      >
                        {agr.stage.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-800 dark:text-slate-200">
                        {agr.lead_user?.display_name || 'Unassigned'}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      <div>Eff: {agr.effective_date || '—'}</div>
                      <div>Exp: {agr.expiry_date || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        to={`/agreements/${agr.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Open <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stage Change Validation Modal */}
      {stageModalAgr && targetStage && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Advance Agreement Stage
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Moving <span className="font-bold text-slate-900 dark:text-slate-100">&ldquo;{stageModalAgr.title}&rdquo;</span> from{' '}
              <span className="font-semibold text-amber-600">{stageModalAgr.stage.replace(/_/g, ' ')}</span> to{' '}
              <span className="font-bold text-indigo-600">{targetStage.replace(/_/g, ' ')}</span>.
            </p>

            {targetStage === 'EXECUTED' && (
              <div className="space-y-2 p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900">
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Execution / Signing Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={executionDateInput}
                  onChange={(e) => setExecutionDateInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
                <p className="text-[11px] text-slate-500">
                  Rule: Requires a signed copy marked &lsquo;sent to FINAL&rsquo; in Versions. On execution, a RENEWAL deadline will be auto-generated.
                </p>
              </div>
            )}

            {stageError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{stageError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStageModalAgr(null);
                  setTargetStage(null);
                  setStageError(null);
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingStage}
                onClick={handleConfirmStageChange}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {updatingStage ? 'Validating...' : 'Confirm Transition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Agreement Modal */}
      {newAgrOpen && (
        <NewAgreementModal
          isOpen={newAgrOpen}
          onClose={() => setNewAgrOpen(false)}
          onSuccess={(agreementId) => {
            setNewAgrOpen(false);
            loadData();
            navigate(`/agreements/${agreementId}`);
          }}
        />
      )}
    </div>
  );
};
export default AgreementsKanbanView;
