// src/features/cases/UpdateHearingModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Calendar, Upload, Check, AlertCircle, Trash2, Receipt, IndianRupee } from 'lucide-react';
import { updateAfterHearing, deleteHearing, fetchProfiles } from '../../lib/api';
import { uploadLitigatorFile } from '../../lib/files';
import { clock } from '../../lib/clock';
import { formatProfileRole } from '../../lib/auth';
import type { CoreProfile } from '../../lib/types';
import { EXPENSE_CATEGORIES } from '../../lib/types';

interface UpdateHearingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  caseId: string;
  causeTitle: string;
  hearingId?: string;
  defaultHearingDate?: string;
  defaultPurpose?: string;
  defaultOutcome?: string;
  defaultNextDate?: string;
  defaultNextPurpose?: string;
  defaultAttendedBy?: string;
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
  defaultOutcome,
  defaultNextDate,
  defaultNextPurpose,
  defaultAttendedBy,
  clientCode,
  clientName,
  projectCode,
  projectCodeId,
}) => {
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [hearingDate, setHearingDate] = useState(defaultHearingDate || clock.todayYMD());
  const [purpose, setPurpose] = useState(defaultPurpose || 'Regular Hearing');
  const [outcome, setOutcome] = useState(defaultOutcome || '');
  const [nextDate, setNextDate] = useState(defaultNextDate || '');
  const [nextPurpose, setNextPurpose] = useState(defaultNextPurpose || '');
  const [attendedBy, setAttendedBy] = useState(defaultAttendedBy || '');
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stage Expense Incurred State
  const [hasExpense, setHasExpense] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseCategory, setExpenseCategory] = useState<string>('Documentation');
  const [expenseBillable, setExpenseBillable] = useState(true);
  const [expenseNotes, setExpenseNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchProfiles().then(setProfiles).catch(console.error);
      setHearingDate(defaultHearingDate || clock.todayYMD());
      setPurpose(defaultPurpose || 'Hearing');
      setOutcome(defaultOutcome || '');
      setNextDate(defaultNextDate || '');
      setNextPurpose(defaultNextPurpose || '');
      setAttendedBy(defaultAttendedBy || '');
      setOrderFile(null);
      setError(null);
      setHasExpense(false);
      setExpenseAmount('');
      setExpenseCategory('Documentation');
      setExpenseBillable(true);
      setExpenseNotes('');
    }
  }, [
    isOpen,
    defaultHearingDate,
    defaultPurpose,
    defaultOutcome,
    defaultNextDate,
    defaultNextPurpose,
    defaultAttendedBy,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
        expense:
          hasExpense && Number(expenseAmount) > 0
            ? {
                amount: Number(expenseAmount),
                category: expenseCategory,
                description: expenseNotes.trim() || undefined,
                billable: expenseBillable,
              }
            : null,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update hearing');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!hearingId) return;
    if (!confirm('Are you sure you want to delete this hearing record from the docket?')) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteHearing(hearingId);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete hearing');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              {hearingId ? 'Edit Court Hearing & Outcome' : 'Record Court Hearing'}
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
                    {p.display_name} ({formatProfileRole(p)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Purpose of Hearing
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
              Outcome &amp; Proceeding Notes
            </label>
            <textarea
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

          {/* Stage Expense Incurred Option */}
          <div className="p-3 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasExpense}
                  onChange={(e) => setHasExpense(e.target.checked)}
                  className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Record Incurred Expense at this Stage</span>
                </span>
              </label>
              <span className="text-[10px] text-amber-700/80 dark:text-amber-400 font-medium bg-amber-100/60 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                Syncs with Finance
              </span>
            </div>

            {hasExpense && (
              <div className="space-y-3 pt-1 border-t border-amber-200/50 dark:border-amber-900/40 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Expense Amount (₹) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required={hasExpense}
                        value={expenseAmount}
                        onChange={(e) =>
                          setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        placeholder="e.g. 1500"
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Expense Category
                    </label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expense Description / Itemization
                  </label>
                  <input
                    type="text"
                    value={expenseNotes}
                    onChange={(e) => setExpenseNotes(e.target.value)}
                    placeholder="e.g. Notary attestation fee, conveyance / cab fare to court, courier charges"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={expenseBillable}
                      onChange={(e) => setExpenseBillable(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                      Billable to Client (Include in Client Invoicing / Quotation)
                    </span>
                  </label>
                </div>
              </div>
            )}
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

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              {hearingId && (
                <button
                  type="button"
                  disabled={deleting || saving}
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleting ? 'Deleting...' : 'Delete'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm shadow-indigo-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Save Hearing
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
