// src/features/cases/AddMilestoneModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Trash2, History } from 'lucide-react';
import { createCustomMilestone, updateMatterEvent, deleteMatterEvent } from '../../lib/api';
import { clock } from '../../lib/clock';

interface AddMilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectCodeId: string;
  existingMilestone?: {
    id: string;
    date: string;
    title: string;
    detail?: string | null;
    category?: string;
  } | null;
}

export const AddMilestoneModal: React.FC<AddMilestoneModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectCodeId,
  existingMilestone,
}) => {
  const [date, setDate] = useState(existingMilestone?.date || clock.todayYMD());
  const [title, setTitle] = useState(existingMilestone?.title || '');
  const [detail, setDetail] = useState(existingMilestone?.detail || '');
  const [category, setCategory] = useState(existingMilestone?.category || 'PROGRESS');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDate(existingMilestone?.date || clock.todayYMD());
      setTitle(existingMilestone?.title || '');
      setDetail(existingMilestone?.detail || '');
      setCategory(existingMilestone?.category || 'PROGRESS');
      setError(null);
    }
  }, [isOpen, existingMilestone]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      setError('Please provide date and milestone title.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (existingMilestone) {
        await updateMatterEvent(existingMilestone.id, {
          title: title.trim(),
          detail: detail.trim() || undefined,
          occurredAt: date,
          eventCode: category,
        });
      } else {
        await createCustomMilestone({
          projectCodeId,
          title: title.trim(),
          detail: detail.trim() || undefined,
          occurredAt: date,
          category,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save milestone');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingMilestone) return;
    if (!confirm('Are you sure you want to remove this milestone from the timeline?')) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteMatterEvent(existingMilestone.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete milestone');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              {existingMilestone ? 'Edit Timeline Milestone' : 'Add Progress Milestone to Timeline'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
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
                Progress Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Milestone Tag
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="PROGRESS">Case Progression</option>
                <option value="MEDIATION">Mediation / ADR</option>
                <option value="SETTLEMENT">Settlement Dialogue</option>
                <option value="PROCESS_SERVED">Summons / Process Served</option>
                <option value="CAVEAT">Caveat Lodged</option>
                <option value="DISCOVERY">Admission / Denial / Inspection</option>
                <option value="PROCEDURAL">Procedural Compliance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Milestone Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mediation referral order passed; Sessions scheduled"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Detailed Notes / Description
            </label>
            <textarea
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Record details of the event, counsel instructions, or mediator remarks..."
              className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              {existingMilestone && (
                <button
                  type="button"
                  disabled={deleting || saving}
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleting ? 'Removing...' : 'Delete'}</span>
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
                    Save Milestone
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
