// src/features/cases/RecordExpenseModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Receipt, IndianRupee, Check, AlertCircle, Trash2, Calendar, Tag } from 'lucide-react';
import { saveStageExpense, updateStageExpense, deleteStageExpense } from '../../lib/api';
import { clock } from '../../lib/clock';
import { EXPENSE_CATEGORIES, getAllCaseStages, StageExpenseRecord } from '../../lib/types';

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectCodeId: string;
  defaultStage?: string;
  existingExpense?: StageExpenseRecord | null;
}

export const RecordExpenseModal: React.FC<RecordExpenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectCodeId,
  defaultStage,
  existingExpense,
}) => {
  const allStages = getAllCaseStages();

  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState<string>('Documentation');
  const [stage, setStage] = useState<string>(defaultStage || 'Hearing');
  const [billable, setBillable] = useState(true);
  const [date, setDate] = useState(clock.todayYMD());
  const [description, setDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (existingExpense) {
        setAmount(existingExpense.amount);
        setCategory(existingExpense.category || 'Documentation');
        setStage(existingExpense.stage || defaultStage || 'Hearing');
        setBillable(existingExpense.billable !== false);
        setDate(existingExpense.date || clock.todayYMD());
        setDescription(existingExpense.description || '');
      } else {
        setAmount('');
        setCategory('Documentation');
        setStage(defaultStage || 'Hearing');
        setBillable(true);
        setDate(clock.todayYMD());
        setDescription('');
      }
      setError(null);
    }
  }, [isOpen, existingExpense, defaultStage]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount === '' || Number(amount) < 0) {
      setError('Please enter a valid expense amount.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (existingExpense?.id) {
        await updateStageExpense(existingExpense.id, {
          amount: Number(amount),
          category,
          stage,
          billable,
          date,
          description: description.trim() || undefined,
        });
      } else {
        await saveStageExpense({
          projectCodeId,
          amount: Number(amount),
          category,
          stage,
          billable,
          date,
          description: description.trim() || undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record stage expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingExpense?.id) return;
    if (!confirm('Are you sure you want to delete this expense record?')) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteStageExpense(existingExpense.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete expense record.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {existingExpense ? 'Edit Stage Expense' : 'Record Stage Expense'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Document notary, translation, travel, or process costs incurred at this stage
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount Incurred (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 2500"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date Incurred <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Category & Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Expense Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 font-medium"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Case Stage <span className="text-rose-500">*</span>
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
              >
                {allStages.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Voucher Details
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Notary charges for rejoinder affidavit, speed post tracking ED8192718IN, cab fare to City Civil Court..."
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Billable Toggle */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Billable to Client
              </span>
              <span className="text-[11px] text-slate-500 block">
                Include this expense in supplementary quotation / client disbursement invoice
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <p className="text-[10px] text-slate-400">
            • All stage expenses synchronize directly to the Finance Dashboard and case timeline for complete firm-wide operational cost audit.
          </p>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <div>
              {existingExpense?.id && (
                <button
                  type="button"
                  disabled={deleting || saving}
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition flex items-center gap-1 cursor-pointer"
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
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm shadow-amber-600/30 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{existingExpense ? 'Update Expense' : 'Save Expense'}</span>
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
