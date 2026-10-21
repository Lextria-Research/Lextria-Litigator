// src/features/notices/ConvertNoticeModal.tsx
import React, { useState } from 'react';
import {
  X,
  Scale,
  Calendar,
  Building2,
  FileText,
  AlertCircle,
  Check,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';
import { convertNoticeToCourtCase } from '../../lib/api';
import { clock } from '../../lib/clock';
import { getAllCaseStages, CaseRecord, CaseType } from '../../lib/types';

interface ConvertNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedCase: CaseRecord) => void;
  notice: CaseRecord;
}

const CASE_TYPE_OPTIONS: { value: CaseType; label: string }[] = [
  { value: 'COMMERCIAL_SUIT', label: 'Commercial Suit (Commercial Court)' },
  { value: 'CIVIL_SUIT', label: 'Original Civil Suit (O.S.)' },
  { value: 'IP_INFRINGEMENT', label: 'IP Infringement / Passing Off Suit' },
  { value: 'WRIT', label: 'Writ Petition (High Court)' },
  { value: 'ARBITRATION', label: 'Arbitration Petition / Section 9/11' },
  { value: 'CRIMINAL_COMPLAINT', label: 'Criminal Complaint / NI Act 138' },
  { value: 'CONSUMER', label: 'Consumer Forum Dispute' },
  { value: 'APPEAL', label: 'Appeal (First / Regular Appeal)' },
  { value: 'OTHER', label: 'Other Court Proceeding' },
];

export const ConvertNoticeModal: React.FC<ConvertNoticeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  notice,
}) => {
  const allStages = getAllCaseStages();

  const [courtName, setCourtName] = useState('Bengaluru City Civil Court');
  const [bench, setBench] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [cnrNumber, setCnrNumber] = useState('');
  const [caseType, setCaseType] = useState<CaseType>('COMMERCIAL_SUIT');
  const [filingDate, setFilingDate] = useState(clock.todayYMD());
  const [stage, setStage] = useState('Suit filed');
  const [judgeName, setJudgeName] = useState('');

  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courtName.trim()) {
      setError('Court name is required.');
      return;
    }

    setConverting(true);
    setError(null);

    try {
      const updated = await convertNoticeToCourtCase({
        caseId: notice.id,
        courtName: courtName.trim(),
        bench: bench.trim() || undefined,
        caseNumber: caseNumber.trim() || undefined,
        cnrNumber: cnrNumber.trim().toUpperCase() || undefined,
        caseType,
        filingDate,
        judgeName: judgeName.trim() || undefined,
        stage,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to convert notice to court case.');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Escalate &amp; Convert to Court Case</span>
              </h3>
              <p className="text-xs text-slate-500">
                Moves notice from Pre-Litigation directly to Court Cases docket
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
        <form onSubmit={handleConvert} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Locked Matter Continuity Banner */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  {notice.project_code?.code}
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-xs">
                  {notice.cause_title}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                Code Preserved
              </span>
            </div>

            <div className="text-[11px] text-slate-500 grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <div>
                Client: <strong className="text-slate-800 dark:text-slate-200">{notice.project_code?.client?.client_name || '—'}</strong>
              </div>
              <div>
                Opponent: <strong className="text-slate-800 dark:text-slate-200">{notice.opponent_name || 'Notice Recipient'}</strong>
              </div>
            </div>
          </div>

          {/* Suit / Case Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Court Case Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={caseType}
              onChange={(e) => setCaseType(e.target.value as CaseType)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-semibold"
            >
              {CASE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Court Name and Bench */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Court / Tribunal <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={courtName}
                  onChange={(e) => setCourtName(e.target.value)}
                  placeholder="e.g. City Civil Court Bengaluru"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Court Bench / Division
              </label>
              <input
                type="text"
                value={bench}
                onChange={(e) => setBench(e.target.value)}
                placeholder="e.g. Commercial Division, Court Hall 14"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Suit Number and CNR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Suit / Case Number
              </label>
              <input
                type="text"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="e.g. Com. O.S. 420/2026"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-mono font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                CNR Number (eCourts)
              </label>
              <input
                type="text"
                value={cnrNumber}
                onChange={(e) => setCnrNumber(e.target.value.toUpperCase())}
                placeholder="e.g. KABC010049212026"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-mono uppercase"
              />
            </div>
          </div>

          {/* Filing Date & Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Court Filing Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={filingDate}
                  onChange={(e) => setFilingDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Initial Court Stage <span className="text-rose-500">*</span>
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {allStages.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              All previously uploaded notice drafts, speed post receipts, stage expenses, and matter timeline will automatically persist and appear on the active Court Docket.
            </span>
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
              disabled={converting}
              className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm shadow-emerald-600/30 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {converting ? (
                <>Converting Matter...</>
              ) : (
                <>
                  <span>Transfer to Court Docket</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
