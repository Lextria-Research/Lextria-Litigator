// src/features/cases/EditPartyModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Trash2, Users } from 'lucide-react';
import { updateParty, deleteParty } from '../../lib/api';
import type { CasePartyRecord } from '../../lib/types';

interface EditPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  party: CasePartyRecord;
}

export const EditPartyModal: React.FC<EditPartyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  party,
}) => {
  const [name, setName] = useState(party.name || '');
  const [side, setSide] = useState<'OURS' | 'OPPOSITE' | 'OTHER'>(party.side || 'OPPOSITE');
  const [role, setRole] = useState(party.party_role || '');
  const [counselName, setCounselName] = useState(party.counsel_name || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(party.name || '');
      setSide(party.side || 'OPPOSITE');
      setRole(party.party_role || '');
      setCounselName(party.counsel_name || '');
      setError(null);
    }
  }, [isOpen, party]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a party name.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateParty(party.id, {
        name: name.trim(),
        side,
        party_role: role.trim() || 'Party',
        counsel_name: counselName.trim() || null,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update party');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to remove party "${party.name}"?`)) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteParty(party.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to remove party');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Edit Litigation Party
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Party Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Innovations Corp"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Litigation Side
              </label>
              <select
                value={side}
                onChange={(e) => setSide(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="OURS">Our Client's Side (OURS)</option>
                <option value="OPPOSITE">Opposing Party (OPPOSITE)</option>
                <option value="OTHER">Third Party / Proforma (OTHER)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Party Role
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Defendant No. 1"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Counsel Name &amp; Contact Info
            </label>
            <input
              type="text"
              value={counselName}
              onChange={(e) => setCounselName(e.target.value)}
              placeholder="e.g. Adv. R. K. Sharma (98110XXXXX)"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={deleting || saving}
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deleting ? 'Removing...' : 'Remove'}</span>
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
                className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm shadow-indigo-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Save Party
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
