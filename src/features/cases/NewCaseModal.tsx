// src/features/cases/NewCaseModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Plus, ShieldAlert, Check, AlertCircle } from 'lucide-react';
import {
  fetchClients,
  createClient,
  createProjectCode,
  createCase,
  fetchProfiles,
} from '../../lib/api';
import { clock } from '../../lib/clock';
import type { CoreClient, CoreProfile, CaseType, ClientRole } from '../../lib/types';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (caseId: string) => void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [clients, setClients] = useState<CoreClient[]>([]);
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);

  // Client Selection / Creation state
  const [clientId, setClientId] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCode, setNewClientCode] = useState('');

  // Project code
  const [projectCode, setProjectCode] = useState('');

  // Case details
  const [caseType, setCaseType] = useState<CaseType>('COMMERCIAL_SUIT');
  const [court, setCourt] = useState('');
  const [bench, setBench] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [cnrNumber, setCnrNumber] = useState('');
  const [filingDate, setFilingDate] = useState(clock.todayYMD());
  const [causeTitle, setCauseTitle] = useState('');
  const [clientRole, setClientRole] = useState<ClientRole>('PLAINTIFF');
  const [currentStage, setCurrentStage] = useState('Suit filed');
  const [leadUserId, setLeadUserId] = useState('');
  const [ethicalWall, setEthicalWall] = useState(false);
  const [claimValue, setClaimValue] = useState<number | ''>('');
  const [courtFee, setCourtFee] = useState<number | ''>('');

  // Initial next hearing
  const [nextHearingDate, setNextHearingDate] = useState('');
  const [nextPurpose, setNextPurpose] = useState('');

  // Parties
  const [oppositePartyName, setOppositePartyName] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      Promise.all([fetchClients(), fetchProfiles()])
        .then(([c, p]) => {
          setClients(c);
          setProfiles(p);
          if (c.length > 0) setClientId(c[0].id);
          if (p.length > 0) setLeadUserId(p[0].id);
        })
        .catch(console.error);

      // Auto generate suggested project code
      const randNum = Math.floor(1000 + Math.random() * 9000);
      setProjectCode(`LIT-${new Date().getFullYear()}-${randNum}`);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!causeTitle.trim()) {
      setError('Please provide a Cause Title (e.g. Plaintiff vs Defendant).');
      return;
    }
    if (!court.trim()) {
      setError('Please provide the Court or Forum name.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let finalClientId = clientId;

      // 1. If creating client inline
      if (creatingClient) {
        if (!newClientName.trim() || !newClientCode.trim()) {
          throw new Error('Please provide both Client Name and Client Code.');
        }
        const createdClient = await createClient({
          client_name: newClientName.trim(),
          client_code: newClientCode.trim().toUpperCase(),
          entity_type: 'LARGE_ENTITY',
        });
        finalClientId = createdClient.id;
      }

      // 2. Create project code in core.project_codes
      const newProj = await createProjectCode({
        code: projectCode.trim().toUpperCase(),
        clientId: finalClientId,
        department: 'LITIGATION',
        title: causeTitle.trim(),
        leadAssigneeId: leadUserId || null,
      });

      // 3. Prepare initial parties
      const clientObj = clients.find((c) => c.id === finalClientId);
      const ourPartyName = clientObj ? clientObj.client_name : 'Our Client';
      const initialParties: Array<{ name: string; side: 'OURS' | 'OPPOSITE' | 'OTHER'; party_role: string }> = [
        {
          name: ourPartyName,
          side: 'OURS',
          party_role: clientRole,
        },
      ];
      if (oppositePartyName.trim()) {
        initialParties.push({
          name: oppositePartyName.trim(),
          side: 'OPPOSITE' as const,
          party_role: clientRole === 'PLAINTIFF' ? 'DEFENDANT' : 'PLAINTIFF',
        });
      }

      // 4. Create case in litigator.cases
      const createdCase = await createCase({
        projectCodeId: newProj.id,
        caseType,
        court: court.trim(),
        bench: bench.trim() || undefined,
        caseNumber: caseNumber.trim() || undefined,
        cnrNumber: cnrNumber.trim() || undefined,
        filingDate: filingDate || undefined,
        causeTitle: causeTitle.trim(),
        clientRole,
        currentStage,
        nextHearingDate: nextHearingDate || undefined,
        nextPurpose: nextPurpose || undefined,
        leadUserId: leadUserId || undefined,
        ethicalWall,
        claimValue: claimValue ? Number(claimValue) : undefined,
        courtFee: courtFee ? Number(courtFee) : undefined,
        parties: initialParties,
      });

      onSuccess(createdCase.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create case');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              New Court Case Docket
            </h3>
            <p className="text-xs text-slate-500">
              Creates master matter, core project code, and initial hearing docket
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Client & Project Code Row */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                1. Client &amp; Core Matter Reference
              </span>
              <button
                type="button"
                onClick={() => setCreatingClient(!creatingClient)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{creatingClient ? 'Select Existing Client' : 'Create New Client'}</span>
              </button>
            </div>

            {creatingClient ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="e.g. Apex BioPharma Ltd"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Client Code (Unique)
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientCode}
                    onChange={(e) => setNewClientCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CLI-1092"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Client (core.clients)
                </label>
                <select
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.client_code} — {c.client_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Matter Project Code (core.project_codes)
              </label>
              <input
                type="text"
                required
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                placeholder="e.g. LIT-2026-0042"
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>

          {/* Cause Title & Role */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cause Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={causeTitle}
                onChange={(e) => setCauseTitle(e.target.value)}
                placeholder="e.g. Apex BioPharma vs. Global Health Corp"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Client Role
              </label>
              <select
                value={clientRole}
                onChange={(e) => setClientRole(e.target.value as ClientRole)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="PLAINTIFF">Plaintiff</option>
                <option value="DEFENDANT">Defendant</option>
                <option value="PETITIONER">Petitioner</option>
                <option value="RESPONDENT">Respondent</option>
                <option value="APPELLANT">Appellant</option>
                <option value="COMPLAINANT">Complainant</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Court, Bench, Type */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Court / Forum <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={court}
                onChange={(e) => setCourt(e.target.value)}
                placeholder="e.g. High Court of Delhi"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Bench / Court Hall
              </label>
              <input
                type="text"
                value={bench}
                onChange={(e) => setBench(e.target.value)}
                placeholder="e.g. Commercial Court 3"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Case Type
              </label>
              <select
                value={caseType}
                onChange={(e) => setCaseType(e.target.value as CaseType)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="COMMERCIAL_SUIT">Commercial Suit</option>
                <option value="CIVIL_SUIT">Civil Suit</option>
                <option value="IP_INFRINGEMENT">IP Infringement</option>
                <option value="WRIT">Writ Petition</option>
                <option value="APPEAL">Appeal</option>
                <option value="ARBITRATION">Arbitration</option>
                <option value="CONSUMER">Consumer</option>
                <option value="CRIMINAL_COMPLAINT">Criminal Complaint</option>
                <option value="PRE_LITIGATION">Pre-Litigation</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Numbers: Case No & CNR */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Case / Suit Number
              </label>
              <input
                type="text"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="e.g. CS(COMM) 204/2026"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                eCourts 16-Digit CNR Number
              </label>
              <input
                type="text"
                value={cnrNumber}
                onChange={(e) => setCnrNumber(e.target.value.toUpperCase())}
                placeholder="e.g. DLHC010023452026"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>

          {/* Lead Counsel & Opposite Party */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Lead Assignee / Counsel
              </label>
              <select
                value={leadUserId}
                onChange={(e) => setLeadUserId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="">Select counsel...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({p.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Opposite Party Name
              </label>
              <input
                type="text"
                value={oppositePartyName}
                onChange={(e) => setOppositePartyName(e.target.value)}
                placeholder="e.g. Global Health Corp"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Financials & Stage */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Claim Value (₹)
              </label>
              <input
                type="number"
                step="any"
                value={claimValue}
                onChange={(e) => setClaimValue(e.target.value ? Number(e.target.value) : '')}
                placeholder="₹"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Court Fee Paid (₹)
              </label>
              <input
                type="number"
                step="any"
                value={courtFee}
                onChange={(e) => setCourtFee(e.target.value ? Number(e.target.value) : '')}
                placeholder="₹"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Current Stage
              </label>
              <select
                value={currentStage}
                onChange={(e) => setCurrentStage(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="Notice sent">Notice sent</option>
                <option value="Notice served">Notice served</option>
                <option value="Suit filed">Suit filed</option>
                <option value="Summons">Summons</option>
                <option value="Written statement">Written statement</option>
                <option value="Interim application">Interim application</option>
                <option value="Evidence">Evidence</option>
                <option value="Final arguments">Final arguments</option>
                <option value="Judgment">Judgment</option>
              </select>
            </div>
          </div>

          {/* Ethical Wall Toggle */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Ethical Wall Restriction
                </div>
                <div className="text-[11px] text-amber-700 dark:text-amber-400">
                  When enabled, this matter is hidden from unauthorized staff and visible only to assigned team members.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={ethicalWall}
              onChange={(e) => setEthicalWall(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          {/* Initial Next Hearing */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Upcoming Hearing Date
              </label>
              <input
                type="date"
                value={nextHearingDate}
                onChange={(e) => setNextHearingDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Upcoming Hearing Purpose
              </label>
              <input
                type="text"
                value={nextPurpose}
                onChange={(e) => setNextPurpose(e.target.value)}
                placeholder="e.g. Return of Summons, Interim Relief"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm shadow-indigo-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>Creating Docket...</>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Create Case Matter
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
