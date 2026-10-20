// src/features/cases/EditOrderModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Trash2, FileText } from 'lucide-react';
import { createOrder, updateOrder, deleteOrder, fetchProfiles } from '../../lib/api';
import { clock } from '../../lib/clock';
import type { OrderRecord, CoreProfile } from '../../lib/types';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  caseId: string;
  order?: OrderRecord | null;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  caseId,
  order,
}) => {
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [orderDate, setOrderDate] = useState(order?.order_date || clock.todayYMD());
  const [orderType, setOrderType] = useState<OrderRecord['order_type']>(
    order?.order_type || 'INTERIM'
  );
  const [summary, setSummary] = useState(order?.summary || '');
  const [complianceRequired, setComplianceRequired] = useState(
    Boolean(order?.compliance_required)
  );
  const [complianceDue, setComplianceDue] = useState(order?.compliance_due || '');
  const [complianceOwner, setComplianceOwner] = useState(order?.compliance_owner || '');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchProfiles().then(setProfiles).catch(console.error);
      setOrderDate(order?.order_date || clock.todayYMD());
      setOrderType(order?.order_type || 'INTERIM');
      setSummary(order?.summary || '');
      setComplianceRequired(Boolean(order?.compliance_required));
      setComplianceDue(order?.compliance_due || '');
      setComplianceOwner(order?.compliance_owner || '');
      setError(null);
    }
  }, [isOpen, order]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      setError('Please provide a brief summary of the court order.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (order) {
        await updateOrder(order.id, {
          order_date: orderDate,
          order_type: orderType,
          summary: summary.trim(),
          compliance_required: complianceRequired,
          compliance_due: complianceRequired && complianceDue ? complianceDue : null,
          compliance_owner: complianceRequired && complianceOwner ? complianceOwner : null,
        });
      } else {
        await createOrder({
          case_id: caseId,
          order_date: orderDate,
          order_type: orderType,
          summary: summary.trim(),
          compliance_required: complianceRequired,
          compliance_due: complianceRequired && complianceDue ? complianceDue : null,
          compliance_owner: complianceRequired && complianceOwner ? complianceOwner : null,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    if (!confirm('Are you sure you want to delete this order record?')) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteOrder(order.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete order');
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
            <FileText className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              {order ? 'Edit Judicial Order' : 'Record Judicial Order'}
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
                Order Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Order Classification
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="INTERIM">Interim Order / Injunction</option>
                <option value="FINAL">Final Judgment / Decree</option>
                <option value="PROCEDURAL">Procedural Direction</option>
                <option value="COSTS">Costs Imposed</option>
                <option value="OTHER">Other Order</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Order Summary / Directions <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g. Ad-interim injunction granted restraining defendant from manufacturing infringing marks..."
              className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Compliance toggle */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={complianceRequired}
                onChange={(e) => setComplianceRequired(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Action / Compliance Required by Court
              </span>
            </label>

            {complianceRequired && (
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Compliance Due Date
                  </label>
                  <input
                    type="date"
                    value={complianceDue}
                    onChange={(e) => setComplianceDue(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Compliance Owner
                  </label>
                  <select
                    value={complianceOwner}
                    onChange={(e) => setComplianceOwner(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select owner...</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              {order && (
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
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm shadow-emerald-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {order ? 'Save Order' : 'Record Order'}
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
