// src/features/agreements/NewAgreementModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Check, AlertCircle } from 'lucide-react';
import {
  fetchClients,
  createClient,
  createProjectCode,
  createAgreement,
  addAgreementVersion,
  fetchProfiles,
} from '../../lib/api';
import type { CoreClient, CoreProfile, AgreementType } from '../../lib/types';

interface NewAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (agreementId: string) => void;
  initialType?: AgreementType;
  initialTemplateDocId?: string | null;
}

export const NewAgreementModal: React.FC<NewAgreementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialType,
  initialTemplateDocId,
}) => {
  const [clients, setClients] = useState<CoreClient[]>([]);
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);

  const [clientId, setClientId] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCode, setNewClientCode] = useState('');

  const [projectCode, setProjectCode] = useState('');
  const [title, setTitle] = useState('');
  const [agreementType, setAgreementType] = useState<AgreementType>(initialType || 'NDA');
  const [clientSide, setClientSide] = useState('First Party');
  const [leadUserId, setLeadUserId] = useState('');
  const [reviewerUserId, setReviewerUserId] = useState('');
  const [governingLaw, setGoverningLaw] = useState('Laws of India (Courts of New Delhi)');
  const [keyTerms, setKeyTerms] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [renewalType, setRenewalType] = useState<'AUTO' | 'MANUAL' | 'NONE'>('NONE');
  const [noticeDays, setNoticeDays] = useState<number | ''>(30);
  const [counterpartyName, setCounterpartyName] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      Promise.all([fetchClients(), fetchProfiles()])
        .then(([c, p]) => {
          setClients(c);
          setProfiles(p);
          if (c.length > 0) setClientId(c[0].id);
          if (p.length > 0) {
            setLeadUserId(p[0].id);
            if (p.length > 1) setReviewerUserId(p[1].id);
          }
        })
        .catch(console.error);

      if (initialType) setAgreementType(initialType);
      const randNum = Math.floor(1000 + Math.random() * 9000);
      setProjectCode(`AGR-${new Date().getFullYear()}-${randNum}`);
      setError(null);
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide an Agreement Title.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let finalClientId = clientId;

      if (creatingClient) {
        if (!newClientName.trim() || !newClientCode.trim()) {
          throw new Error('Please enter Client Name and unique Client Code.');
        }
        const createdClient = await createClient({
          client_name: newClientName.trim(),
          client_code: newClientCode.trim().toUpperCase(),
          entity_type: 'LARGE_ENTITY',
        });
        finalClientId = createdClient.id;
      }

      // 1. Create project code in core.project_codes
      const newProj = await createProjectCode({
        code: projectCode.trim().toUpperCase(),
        clientId: finalClientId,
        department: 'AGREEMENT',
        title: title.trim(),
        leadAssigneeId: leadUserId || null,
      });

      // 2. Prepare parties
      const clientObj = clients.find((c) => c.id === finalClientId);
      const ourClientName = clientObj ? clientObj.client_name : 'Our Client';
      const initialParties = [
        {
          name: ourClientName,
          party_role: clientSide || 'First Party',
          entity_type: 'CLIENT',
        },
      ];
      if (counterpartyName.trim()) {
        initialParties.push({
          name: counterpartyName.trim(),
          party_role: 'Second Party / Counterparty',
          entity_type: 'COUNTERPARTY',
        });
      }

      // 3. Create agreement
      const createdAgr = await createAgreement({
        projectCodeId: newProj.id,
        agreementType,
        title: title.trim(),
        clientSide: clientSide || undefined,
        leadUserId: leadUserId || undefined,
        reviewerUserId: reviewerUserId || undefined,
        governingLaw: governingLaw || undefined,
        keyTerms: keyTerms || undefined,
        expiryDate: expiryDate || undefined,
        renewalType,
        noticeDays: noticeDays ? Number(noticeDays) : undefined,
        parties: initialParties,
      });

      // 4. If started from a template, copy template as Version 1
      if (initialTemplateDocId) {
        await addAgreementVersion({
          agreementId: createdAgr.id,
          versionNo: 1,
          documentId: initialTemplateDocId,
          sentTo: 'INTERNAL',
          changeSummary: 'Initialized draft from firm template library',
        });
      }

      onSuccess(createdAgr.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create agreement');
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
              New Agreement Docket
            </h3>
            <p className="text-xs text-slate-500">
              Create commercial contract, assign drafters, and initialize versioning
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

          {/* Client & Project Code */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                1. Client &amp; Matter Code
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
                    Client Code
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
                Project Code (core.project_codes)
              </label>
              <input
                type="text"
                required
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>

          {/* Title & Type */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Agreement Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master Services Agreement with Global Corp"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Agreement Type
              </label>
              <select
                value={agreementType}
                onChange={(e) => setAgreementType(e.target.value as AgreementType)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="NDA">NDA</option>
                <option value="MOU">MOU</option>
                <option value="SERVICE">Service Agreement</option>
                <option value="CONSULTANCY">Consultancy</option>
                <option value="EMPLOYMENT">Employment</option>
                <option value="LICENCE">Licence</option>
                <option value="ASSIGNMENT">Assignment</option>
                <option value="LEASE">Lease</option>
                <option value="SHAREHOLDERS">Shareholders</option>
                <option value="PARTNERSHIP">Partnership</option>
                <option value="DISTRIBUTION">Distribution</option>
                <option value="FRANCHISE">Franchise</option>
                <option value="SETTLEMENT">Settlement</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Parties: Our Side & Counterparty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Our Client Capacity
              </label>
              <input
                type="text"
                value={clientSide}
                onChange={(e) => setClientSide(e.target.value)}
                placeholder="e.g. Disclosing Party, Licensor, Client"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Counterparty Name
              </label>
              <input
                type="text"
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                placeholder="e.g. Global Tech Solutions Pvt Ltd"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Lead Drafter & Reviewer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Lead Drafter
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
                Internal Reviewer / Partner
              </label>
              <select
                value={reviewerUserId}
                onChange={(e) => setReviewerUserId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="">Select reviewer...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({p.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Renewal Terms */}
          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-3">
            <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              Term, Expiry &amp; Renewal Logic
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Renewal Type
                </label>
                <select
                  value={renewalType}
                  onChange={(e) => setRenewalType(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="NONE">None / Fixed Term</option>
                  <option value="MANUAL">Manual Review Notice</option>
                  <option value="AUTO">Auto-Renewal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notice Window (Days)
                </label>
                <input
                  type="number"
                  value={noticeDays}
                  onChange={(e) => setNoticeDays(e.target.value ? Number(e.target.value) : '')}
                  placeholder="30"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Key Terms / Special Clauses
            </label>
            <textarea
              rows={2}
              value={keyTerms}
              onChange={(e) => setKeyTerms(e.target.value)}
              placeholder="Commercial terms, IP ownership covenants, non-solicit covenants, milestone dates..."
              className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
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
                <>Creating Agreement...</>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Create Agreement Docket
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
