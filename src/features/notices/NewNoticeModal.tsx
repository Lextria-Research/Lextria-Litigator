// src/features/notices/NewNoticeModal.tsx
import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Building2,
  Calendar,
  IndianRupee,
  User,
  AlertCircle,
  Check,
  Send,
  Scale,
} from 'lucide-react';
import {
  createCase,
  fetchClients,
  fetchProfiles,
  getNextProjectCode,
} from '../../lib/api';
import { clock } from '../../lib/clock';
import { formatProfileRole } from '../../lib/auth';
import type { CoreClient, CoreProfile } from '../../lib/types';
import { ClientSearchSelect } from '../../components/common/ClientSearchSelect';

interface NewNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewNoticeModal: React.FC<NewNoticeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [clients, setClients] = useState<CoreClient[]>([]);
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);

  // Form State
  const [projectCode, setProjectCode] = useState('');
  const [clientId, setClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientCode, setNewClientCode] = useState('');

  const [causeTitle, setCauseTitle] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [noticeDate, setNoticeDate] = useState(clock.todayYMD());
  const [claimValue, setClaimValue] = useState<number | ''>('');
  const [leadUserId, setLeadUserId] = useState('');
  const [noticeSummary, setNoticeSummary] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoadingInitial(true);
      setError(null);
      Promise.all([
        fetchClients(),
        fetchProfiles(),
        getNextProjectCode('LITIGATION'),
      ])
        .then(([cList, pList, nextCode]) => {
          setClients(cList || []);
          setProfiles(pList || []);
          setProjectCode(nextCode || 'LC--');
        })
        .catch((err) => {
          setError(err?.message || 'Failed to load initial notice data.');
        })
        .finally(() => {
          setLoadingInitial(false);
        });

      setClientId('');
      setNewClientName('');
      setNewClientCode('');
      setCauseTitle('');
      setOpponentName('');
      setNoticeDate(clock.todayYMD());
      setClaimValue('');
      setLeadUserId('');
      setNoticeSummary('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectCode.trim()) {
      setError('Notice project code is required.');
      return;
    }

    if (!clientId && !newClientName.trim()) {
      setError('Please select or specify a client for this legal notice.');
      return;
    }

    if (!causeTitle.trim()) {
      setError('Notice cause title / subject is required.');
      return;
    }

    if (!opponentName.trim()) {
      setError('Opposite party / notice recipient name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createCase({
        projectCode: projectCode.trim().toUpperCase(),
        caseType: 'PRE_LITIGATION',
        court: 'Pre-Litigation / Legal Notice',
        causeTitle: causeTitle.trim(),
        clientRole: 'PLAINTIFF',
        clientId: clientId || undefined,
        newClientName: newClientName.trim() || undefined,
        newClientCode: newClientCode.trim().toUpperCase() || undefined,
        currentStage: 'Notice',
        filingDate: noticeDate || clock.todayYMD(),
        leadUserId: leadUserId || undefined,
        claimValue: claimValue === '' ? undefined : Number(claimValue),
        oppositePartyName: opponentName.trim(),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to issue legal notice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Issue New Legal Notice</span>
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                  {projectCode}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Pre-litigation tracking docket • Shares unified LC code sequence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Client Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Client / Sender <span className="text-rose-500">*</span>
            </label>
            <ClientSearchSelect
              clients={clients}
              value={clientId}
              onChange={(id) => {
                setClientId(id);
                setNewClientName('');
                setNewClientCode('');
              }}
              placeholder="Search existing client by name or code (200+ clients)..."
            />
          </div>

          {/* Cause Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notice Subject / Cause Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={causeTitle}
              onChange={(e) => setCauseTitle(e.target.value)}
              placeholder="e.g. Statutory Demand Notice u/s 138 NI Act to ABC Logistics Pvt Ltd"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Opposite Party / Recipient */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Opposite Party / Recipient <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="Full legal name of person / company receiving the legal notice"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Date & Claim Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notice Issue / Dispatch Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={noticeDate}
                  onChange={(e) => setNoticeDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Demand / Claim Amount (₹)
              </label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={claimValue}
                  onChange={(e) =>
                    setClaimValue(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="e.g. 500000"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Lead Associate */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Lead Counsel / Assigned Associate
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <select
                value={leadUserId}
                onChange={(e) => setLeadUserId(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="">Select counsel...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({formatProfileRole(p)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Requisite Demand / Summary */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notice Summary &amp; Requisites (Optional)
            </label>
            <textarea
              rows={2}
              value={noticeSummary}
              onChange={(e) => setNoticeSummary(e.target.value)}
              placeholder="Summary of grievance, cease &amp; desist demands, reply period (e.g. 15 days), postal tracking number..."
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-start gap-2">
            <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-900 dark:text-indigo-300 leading-relaxed">
              If the dispute does not settle at this notice stage, this notice can be converted directly into a formal court case with a single click. The code <strong>{projectCode}</strong>, client details, opponent, and history will seamlessly transfer to the Court Cases docket.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loadingInitial}
              className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm shadow-indigo-600/30 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>Recording...</>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Issue Legal Notice</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
