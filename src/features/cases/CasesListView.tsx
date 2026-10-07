// src/features/cases/CasesListView.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scale,
  Plus,
  Search,
  Filter,
  ExternalLink,
  ShieldAlert,
  Calendar,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { fetchCases, fetchClients, fetchProfiles } from '../../lib/api';
import { clock } from '../../lib/clock';
import { formatINRShort } from '../../lib/currency';
import { CASE_STAGES, CaseRecord, CoreClient, CoreProfile } from '../../lib/types';
import { NewCaseModal } from './NewCaseModal';

export const CasesListView: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [clients, setClients] = useState<CoreClient[]>([]);
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedCourt, setSelectedCourt] = useState('');
  const [selectedLead, setSelectedLead] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [hearingDateStart, setHearingDateStart] = useState('');
  const [hearingDateEnd, setHearingDateEnd] = useState('');

  const [newCaseOpen, setNewCaseOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cList, clientList, profList] = await Promise.all([
        fetchCases({
          stage: selectedStage || undefined,
          court: selectedCourt || undefined,
          leadUserId: selectedLead || undefined,
          clientId: selectedClient || undefined,
          search: search || undefined,
          dateRange: {
            start: hearingDateStart || undefined,
            end: hearingDateEnd || undefined,
          },
        }),
        fetchClients(),
        fetchProfiles(),
      ]);
      setCases(cList);
      setClients(clientList);
      setProfiles(profList);
    } catch (err) {
      console.error('Failed to load cases docket:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    selectedStage,
    selectedCourt,
    selectedLead,
    selectedClient,
    hearingDateStart,
    hearingDateEnd,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedStage('');
    setSelectedCourt('');
    setSelectedLead('');
    setSelectedClient('');
    setHearingDateStart('');
    setHearingDateEnd('');
  };

  const hasActiveFilters =
    search ||
    selectedStage ||
    selectedCourt ||
    selectedLead ||
    selectedClient ||
    hearingDateStart ||
    hearingDateEnd;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Court Matters &amp; Litigation Docket
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active proceedings across High Courts, Commercial Courts, and District Benches ({cases.length} matters)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setNewCaseOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm shadow-indigo-600/30 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Case Docket</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Case No., CNR, Cause Title, Party Name, or Forum..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition"
          >
            Search
          </button>
        </form>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {/* Stage */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Stage
            </label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              <option value="">All Stages</option>
              {CASE_STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Court */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Forum / Court
            </label>
            <input
              type="text"
              value={selectedCourt}
              onChange={(e) => setSelectedCourt(e.target.value)}
              placeholder="e.g. High Court"
              className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Client */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Client
            </label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client_name}
                </option>
              ))}
            </select>
          </div>

          {/* Lead Counsel */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Lead Counsel
            </label>
            <select
              value={selectedLead}
              onChange={(e) => setSelectedLead(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              <option value="">All Counsel</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Hearing Range Start */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Hearing From
            </label>
            <input
              type="date"
              value={hearingDateStart}
              onChange={(e) => setHearingDateStart(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Hearing Range End */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Hearing To
            </label>
            <input
              type="date"
              value={hearingDateEnd}
              onChange={(e) => setHearingDateEnd(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            <span className="text-slate-500">Filters applied</span>
            <button
              onClick={clearFilters}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Cases Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading cases docket...</div>
        ) : cases.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Scale className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Court Matters Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No matching litigation cases under the current criteria or permissions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Matter Code / CNR</th>
                  <th className="py-3 px-4">Cause Title &amp; Client</th>
                  <th className="py-3 px-4">Forum / Bench</th>
                  <th className="py-3 px-4">Current Stage</th>
                  <th className="py-3 px-4">Next Hearing</th>
                  <th className="py-3 px-4">Lead Counsel</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition cursor-pointer group"
                    onClick={() => navigate(`/cases/${c.id}`)}
                  >
                    {/* Code & CNR */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {c.project_code?.code || '—'}
                      </div>
                      {c.case_number && (
                        <div className="text-[11px] text-slate-500 font-mono">{c.case_number}</div>
                      )}
                      {c.cnr_number ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-700 dark:text-indigo-300">
                            {c.cnr_number}
                          </span>
                          <a
                            href="https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/cnr_index"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open in official eCourts Portal"
                            className="text-slate-400 hover:text-indigo-600"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : null}
                    </td>

                    {/* Cause Title & Client */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition truncate">
                          {c.cause_title}
                        </span>
                        {c.ethical_wall && (
                          <span title="Ethical Wall Active (Restricted to assigned team)">
                            <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        Client: {c.project_code?.client?.client_name || '—'} ({c.client_role})
                      </div>
                      {c.claim_value && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Claim: {formatINRShort(c.claim_value)}
                        </div>
                      )}
                    </td>

                    {/* Court / Forum */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{c.court}</div>
                      {c.bench && <div className="text-[11px] text-slate-400">{c.bench}</div>}
                    </td>

                    {/* Current Stage */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                        {c.current_stage}
                      </span>
                    </td>

                    {/* Next Hearing */}
                    <td className="py-3.5 px-4">
                      {c.next_hearing_date ? (
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-indigo-500" />
                            <span>{clock.formatDisplay(c.next_hearing_date)}</span>
                          </div>
                          {c.next_purpose && (
                            <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                              {c.next_purpose}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Date not fixed</span>
                      )}
                    </td>

                    {/* Lead */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {c.lead_user?.display_name || 'Unassigned'}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize">
                        {c.lead_user?.role.toLowerCase().replace(/_/g, ' ')}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Case Modal */}
      <NewCaseModal
        isOpen={newCaseOpen}
        onClose={() => setNewCaseOpen(false)}
        onSuccess={(caseId) => {
          loadData();
          navigate(`/cases/${caseId}`);
        }}
      />
    </div>
  );
};
