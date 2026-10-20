// src/features/cases/EditDeadlineModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Trash2, Clock } from 'lucide-react';
import { updateDeadline, deleteDeadline, fetchProfiles } from '../../lib/api';
import type { DeadlineRecord, CoreProfile } from '../../lib/types';

interface EditDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deadline: DeadlineRecord;
}

export const EditDeadlineModal: React.FC<EditDeadlineModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  deadline,
}) => {
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [title, setTitle] = useState(deadline.title || '');
  const [dueDate, setDueDate] = useState(deadline.due_date || '');
  const [deadlineType, setDeadlineType] = useState(deadline.deadline_type || 'STATUTORY');
  const [ownerUserId, setOwnerUserId] = useState(deadline.owner_user_id || '');
  const [backupUserId, setBackupUserId] = useState(deadline.backup_user_id || '');
  const [status, setStatus] = useState<'OPEN' | 'DONE'>(deadline.status || 'OPEN');
  const [doneNote, setDoneNote] = useState(deadline.done_note || '');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProfiles().then(setProfiles).catch(console.error);
      setTitle(deadline.title || '');
      setDueDate(deadline.due_date || '');
      setDeadlineType(deadline.deadline_type || 'STATUTORY');
      setOwnerUserId(deadline.owner_user_id || '');
      setBackupUserId(deadline.backup_user_id || '');
      setStatus(deadline.status || 'OPEN');
      setDoneNote(deadline.done_note || '');
      setError(null);
    }
  }, [isOpen, deadline]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      setError('Please provide title and due date.');
      return;
    }
    if (!ownerUserId || !backupUserId) {
      setError('Both owner and backup owner are required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateDeadline(deadline.id, {
        title: title.trim(),
        due_date: dueDate,
        deadline_type: deadlineType,
        owner_user_id: ownerUserId,
        backup_user_id: backupUserId,
        status,
        done_note: status === 'DONE' ? doneNote.trim() || null : null,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update deadline');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this statutory deadline?')) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteDeadline(deadline.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete deadline');
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
            <Clock className="w-4 h-4 text-purple-600" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Edit Statutory Deadline
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Deadline Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 30 days to file Written Statement"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="OPEN">OPEN / In Progress</option>
                <option value="DONE">DONE / Compliance Met</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Primary Owner <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={ownerUserId}
                onChange={(e) => setOwnerUserId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select owner...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Backup Owner <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={backupUserId}
                onChange={(e) => setBackupUserId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select backup...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {status === 'DONE' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Completion Note / Filing Diary Number
              </label>
              <input
                type="text"
                value={doneNote}
                onChange={(e) => setDoneNote(e.target.value)}
                placeholder="e.g. Filed via e-filing portal diary no. 1298492"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={deleting || saving}
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deleting ? 'Deleting...' : 'Delete'}</span>
            </button>

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
                className="px-5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm shadow-purple-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Save Deadline
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
