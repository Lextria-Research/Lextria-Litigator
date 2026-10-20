// src/features/cases/QuotationModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Eye,
  Download,
  AlertCircle,
  Coins,
  Check,
  Trash2,
  Calendar,
} from 'lucide-react';
import { saveCaseQuotation } from '../../lib/api';
import { uploadLitigatorFile, MAX_UPLOAD_SIZE_BYTES } from '../../lib/files';
import { getStoredUser, isSuperAdminOrFinance } from '../../lib/auth';
import type { CoreDocument, QuotationRecord } from '../../lib/types';

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  caseId: string;
  projectCodeId?: string;
  clientCode?: string;
  clientName?: string;
  projectCode?: string;
  existingQuotation?: QuotationRecord | null;
  existingQuotationAmount?: number | null;
  existingQuotationNumber?: string | null;
  existingDocument?: CoreDocument | null;
  onOpenDocumentViewer?: (doc: CoreDocument) => void;
}

export const QuotationModal: React.FC<QuotationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  caseId,
  projectCodeId,
  clientCode,
  clientName,
  projectCode,
  existingQuotation,
  existingQuotationAmount,
  existingQuotationNumber,
  existingDocument,
  onOpenDocumentViewer,
}) => {
  const currentUser = getStoredUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [feeAmount, setFeeAmount] = useState<number | ''>(
    existingQuotation?.total_prof_fee ?? existingQuotationAmount ?? ''
  );
  const [quoteNumber, setQuoteNumber] = useState(
    existingQuotation?.quote_number ?? existingQuotationNumber ?? ''
  );
  const [notes, setNotes] = useState(existingQuotation?.notes || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFeeAmount(existingQuotation?.total_prof_fee ?? existingQuotationAmount ?? '');
      setQuoteNumber(existingQuotation?.quote_number ?? existingQuotationNumber ?? '');
      setNotes(existingQuotation?.notes || '');
      setSelectedFile(null);
      setError(null);
    }
  }, [isOpen, existingQuotation, existingQuotationAmount, existingQuotationNumber]);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError('File exceeds 4.2 MB limit. Please choose a smaller file.');
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectCodeId) {
      setError('Matter project code is missing.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Upload Quotation PDF / Document if provided
      if (selectedFile) {
        await uploadLitigatorFile({
          file: selectedFile,
          category: 'Quotation',
          clientCode,
          clientName,
          projectCode,
          projectCodeId,
          financeOnly: true,
          uploadedByUserId: currentUser?.id,
        });
      }

      // 2. Save Quotation financial details if entered or if existing
      const hasFee = feeAmount !== '' && !isNaN(Number(feeAmount));
      if (hasFee || quoteNumber.trim() || notes.trim()) {
        await saveCaseQuotation({
          projectCodeId,
          totalProfFee: hasFee ? Number(feeAmount) : 0,
          quoteNumber: quoteNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save quotation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Case Quotation &amp; Document
              </h3>
              <p className="text-[11px] text-slate-500">
                Upload quotation proposal PDF and record fee agreement
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section 1: Quotation Document Upload & In-dashboard View */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Quotation PDF / Document
            </label>

            {/* If a quotation document already exists */}
            {existingDocument && !selectedFile && (
              <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {existingDocument.file_name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Uploaded on {new Date(existingDocument.uploaded_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onOpenDocumentViewer && (
                    <button
                      type="button"
                      onClick={() => onOpenDocumentViewer(existingDocument)}
                      className="px-2.5 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-1 shadow-2xs"
                      title="Open and read document in dashboard"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Open in Dashboard</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition"
                    title="Replace with another file"
                  >
                    Replace
                  </button>
                </div>
              </div>
            )}

            {/* Selected new file preview */}
            {selectedFile ? (
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 truncate">
                    {selectedFile.name}
                  </span>
                  <span className="text-[10px] text-emerald-600 shrink-0">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                  title="Remove selected file"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : !existingDocument ? (
              /* Dropzone */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleFileChange(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`p-5 border-2 border-dashed rounded-xl cursor-pointer text-center transition flex flex-col items-center justify-center gap-1.5 ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-800/30'
                }`}
              >
                <Upload className="w-5 h-5 text-indigo-500" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Drop Quotation PDF or click to browse
                </span>
                <span className="text-[10px] text-slate-400">
                  Supports PDF, DOC, DOCX up to 4.2 MB
                </span>
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* Section 2: Financial Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quotation / Professional Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 150000"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quote Reference No.
              </label>
              <input
                type="text"
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
                placeholder="e.g. LEXT/2026/Q-412"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Billing Terms / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Stage-based billing: 50% advance, 50% on filing"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              * Visible to Superadmin &amp; Finance Only
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-xs"
              >
                {saving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Quotation</span>
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
