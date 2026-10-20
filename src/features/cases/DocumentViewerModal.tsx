// src/features/cases/DocumentViewerModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, FileText, AlertCircle, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { getDocumentUrl } from '../../lib/files';
import type { CoreDocument } from '../../lib/types';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: CoreDocument | null;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  document,
}) => {
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !document) {
      setDocUrl(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    getDocumentUrl(document)
      .then((url) => {
        if (isMounted) {
          setDocUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to load document preview');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, document]);

  if (!isOpen || !document) return null;

  const isPdf =
    document.mime_type === 'application/pdf' ||
    document.file_name.toLowerCase().endsWith('.pdf');

  const isImage =
    Boolean(document.mime_type && document.mime_type.startsWith('image/')) ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(document.file_name);

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-2">
                <span>{document.file_name}</span>
                {document.category && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {document.category}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 flex items-center gap-2">
                <span>{formatFileSize(document.size_bytes)}</span>
                {document.mime_type && <span>• {document.mime_type}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {docUrl && (
              <>
                <a
                  href={docUrl}
                  download={document.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-1.5"
                  title="Download File"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900 transition flex items-center gap-1.5"
                  title="Open in Separate Tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Tab</span>
                </a>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Close Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Content Area */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative overflow-hidden flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              <p className="text-xs">Opening document in dashboard...</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-6 max-w-md text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
              {docUrl && (
                <a
                  href={docUrl}
                  download={document.file_name}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File Instead</span>
                </a>
              )}
            </div>
          )}

          {!loading && !error && docUrl && (
            <>
              {isPdf && (
                <iframe
                  src={docUrl}
                  className="w-full h-full border-0 bg-white"
                  title={document.file_name}
                />
              )}

              {isImage && (
                <div className="w-full h-full p-4 flex items-center justify-center overflow-auto">
                  <img
                    src={docUrl}
                    alt={document.file_name}
                    className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                  />
                </div>
              )}

              {!isPdf && !isImage && (
                <div className="p-8 max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {document.file_name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      This file format ({document.mime_type || 'document'}) is ready for download or external application viewing.
                    </p>
                  </div>
                  <div className="flex justify-center gap-3 pt-2">
                    <a
                      href={docUrl}
                      download={document.file_name}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </a>
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Externally</span>
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
