// src/components/common/GlobalSearchModal.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Scale, FileText, ArrowRight } from 'lucide-react';
import { fetchCases, fetchAgreements } from '../../lib/api';
import type { CaseRecord, AgreementRecord } from '../../lib/types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setCases([]);
      setAgreements([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setLoading(true);
        try {
          const [cList, aList] = await Promise.all([
            fetchCases({ search: query }),
            fetchAgreements({ search: query }),
          ]);
          setCases(cList.slice(0, 5));
          setAgreements(aList.slice(0, 5));
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      } else {
        setCases([]);
        setAgreements([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-indigo-500 mr-3 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cases, agreements, CNR, suit no., parties..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-400">Searching docket...</div>
          )}

          {!loading && query.trim().length < 2 && (
            <div className="py-8 text-center text-xs text-slate-400">
              Type at least 2 characters to search across court matters and agreements.
            </div>
          )}

          {!loading && query.trim().length >= 2 && cases.length === 0 && agreements.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching records found for "{query}".
            </div>
          )}

          {/* Cases Results */}
          {cases.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-indigo-500" />
                Court Cases ({cases.length})
              </div>
              <div className="space-y-1.5">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onClose();
                      navigate(`/cases/${c.id}`);
                    }}
                    className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer flex items-center justify-between group transition"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{c.cause_title}</span>
                        {c.case_number && (
                          <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                            {c.case_number}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{c.court}</span>
                        <span>•</span>
                        <span className="font-mono">{c.project_code?.code}</span>
                        <span>•</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">{c.current_stage}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agreements Results */}
          {agreements.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                Agreements ({agreements.length})
              </div>
              <div className="space-y-1.5">
                {agreements.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => {
                      onClose();
                      navigate(`/agreements/${a.id}`);
                    }}
                    className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer flex items-center justify-between group transition"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{a.title}</span>
                        <span className="text-[10px] font-mono bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                          {a.agreement_type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{a.project_code?.code}</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Stage: {a.stage}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
