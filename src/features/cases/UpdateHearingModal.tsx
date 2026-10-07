// src/features/cases/UpdateHearingModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Calendar, Upload, Check, AlertCircle } from 'lucide-react';
import { updateAfterHearing, fetchProfiles } from '../../lib/api';
import { uploadLitigatorFile } from '../../lib/files';
import { clock } from '../../lib/clock';
import type { CoreProfile } from '../../lib/types';

interface UpdateHearingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  caseId: string;
  causeTitle: string;
  hearingId?: string;
  defaultHearingDate?: string;
  defaultPurpose?: string;
  clientCode?: string;
  clientName?: string;
  projectCode?: string;
  projectCodeId?: string;
}

export const UpdateHearingModal: React.FC<UpdateHearingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  caseId,
  causeTitle,
  hearingId,
  defaultHearingDate,
  defaultPurpose,
  clientCode,
  clientName,
  projectCode,
  projectCodeId,
}) => {
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [hearingDate, setHearingDate] = useState(defaultHearingDate || clock.todayYMD());
  const [purpose, setPurpose] = useState(defaultPurpose || 'Regular Hearing');
  const [outcome, setOutcome] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [nextPurpose, setNextPurpose] = useState('');
  const [attendedBy, setAttendedBy] = useState('');
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProfiles().then(setProfiles).catch(console.error);
      setHearingDate(defaultHearingDate || clock.todayYMD());
      setPurpose(defaultPurpose || 'Hearing');
      setOutcome('');
      setNextDate('');
      setNextPurpose('');
      setError(null);
    }
  }, [isOpen, defaultHearingDate, defaultPurpose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome.trim()) {
      setError('Please provide the hearing outcome or daily order summary.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let orderDocId: string | null = null;
      if (orderFile) {
        const doc = await uploadLitigatorFile({
          file: orderFile,
          category: 'Orders',
          clientCode,
          clientName,
          projectCode,
          projectCodeId,
        });
        orderDocId = doc.id;
      }

      await updateAfterHearing({
        caseId,
        hearingId,
        hearingDate,
        purpose,
        outcome: outcome.trim(),
        nextDate: nextDate || null,
        nextPurpose: nextPurpose ? nextPurpose.trim() : null,
        attendedBy: attendedBy || null,
        orderDocumentId: orderDocId,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update hearing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Update After Hearing
            </h3>
            <p className="text-xs text-slate-500 truncate max-w-md">{causeTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hearing Date
              </label>
              <input
                type="date"
                required
                value={hearingDate}
                onChange={(e) => setHearingDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Attended By
              </label>
              <select
                value={attendedBy}
                onChange={(e) => setAttendedBy(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select counsel...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({p.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Purpose of Concluded Hearing
            </label>
            <input
              type="text"
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Objections on IA, Final Arguments, Summons returnable"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Outcome &amp; Proceeding Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Record daily court order, judge directions, ad-interim reliefs or adjournment terms..."
              className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-3">
            <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              Next Hearing Scheduled
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Next Date
                </label>
                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Next Purpose
                </label>
                <input
                  type="text"
                  value={nextPurpose}
                  onChange={(e) => setNextPurpose(e.target.value)}
                  placeholder="e.g. Cross-examination, Orders"
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Upload Daily Order PDF (Optional)
            </label>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 transition">
                <Upload className="w-3.5 h-3.5 text-indigo-500" />
                <span>{orderFile ? orderFile.name : 'Choose Order File'}</span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setOrderFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              {orderFile && (
                <button
                  type="button"
                  onClick={() => setOrderFile(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
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
                <>Updating Hearing...</>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save Hearing &amp; Schedule Next
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
