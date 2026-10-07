// src/features/causeList/DailyCauseListView.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Printer,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Scale,
  ExternalLink,
  User,
  Building,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { fetchDailyCauseList } from '../../lib/api';
import { clock } from '../../lib/clock';

export const DailyCauseListView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(clock.todayYMD());
  const [hearings, setHearings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCauseList = async (date: string) => {
    setLoading(true);
    try {
      const data = await fetchDailyCauseList(date);
      setHearings(data);
    } catch (err) {
      console.error('Failed to load daily cause list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCauseList(selectedDate);
  }, [selectedDate]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(clock.todayYMD());
  };

  // Group hearings by Court
  const groupedByCourt = hearings.reduce((acc: Record<string, any[]>, item) => {
    const courtName = item.case?.court || 'Unspecified Court';
    if (!acc[courtName]) acc[courtName] = [];
    acc[courtName].push(item);
    return acc;
  }, {});

  const courtNames = Object.keys(groupedByCourt).sort();

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Controls & Header (hidden on print) */}
      <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Daily Cause List
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Court proceedings grouped by jurisdiction &amp; bench, single-page print ready
          </p>
        </div>

        {/* Date Controls & Print Action */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 transition"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded transition"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 transition"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-slate-800 dark:text-slate-200 focus:outline-indigo-500"
            />
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            Print Cause List
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="cause-list-printable bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 shadow-xs">
        {/* Printable Cause List Header */}
        <div className="border-b-2 border-slate-900 dark:border-slate-200 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[11px] font-bold tracking-widest text-indigo-700 dark:text-indigo-400 uppercase">
                LEXTRIA RESEARCH &bull; LITIGATION DOCKET
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-slate-900 dark:text-slate-100 mt-1">
                DAILY CAUSE LIST
              </h2>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                {formattedDate}
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-500 font-mono">
              <div>Total Matters: <span className="font-bold text-slate-800 dark:text-slate-200">{hearings.length}</span></div>
              <div>Courts: <span className="font-bold text-slate-800 dark:text-slate-200">{courtNames.length}</span></div>
              <div className="text-[10px] text-slate-400 mt-1">Printed: {clock.todayDisplay()}</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading daily cause list...</div>
        ) : hearings.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Scale className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
              No Matters Listed for this Date
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no court hearings or proceedings scheduled on {formattedDate}.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {courtNames.map((court) => {
              const courtHearings = groupedByCourt[court];
              return (
                <div key={court} className="space-y-3">
                  {/* Court Header */}
                  <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-700 pb-1.5">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                      <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      {court}
                    </h3>
                    <span className="text-[11px] font-mono font-semibold text-slate-500">
                      {courtHearings.length} {courtHearings.length === 1 ? 'matter' : 'matters'}
                    </span>
                  </div>

                  {/* Matters Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-semibold text-[10px] tracking-wider">
                        <tr>
                          <th className="py-2 px-2.5 w-10 text-center">#</th>
                          <th className="py-2 px-3 w-44">Case No. / CNR</th>
                          <th className="py-2 px-3">Cause Title</th>
                          <th className="py-2 px-3 w-36">Purpose / Stage</th>
                          <th className="py-2 px-3 w-32">Bench / Room</th>
                          <th className="py-2 px-3 w-40">Attending Counsel</th>
                          <th className="py-2 px-3 w-28 text-center no-print">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {courtHearings.map((h, idx) => {
                          const c = h.case;
                          return (
                            <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-2.5 text-center font-mono text-slate-500 font-semibold">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                                  {c?.case_number || 'Case No. Unassigned'}
                                </div>
                                {c?.cnr_number && (
                                  <div className="text-[10px] font-mono text-slate-400">
                                    CNR: {c.cnr_number}
                                  </div>
                                )}
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {c?.project_code?.code}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <Link
                                  to={`/cases/${c?.id}`}
                                  className="font-bold text-slate-900 dark:text-slate-100 hover:underline"
                                >
                                  {c?.cause_title || 'Untitled Case'}
                                </Link>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Role: <span className="font-semibold text-slate-700 dark:text-slate-300">{c?.client_role || '—'}</span> &bull; Client: {c?.project_code?.client?.client_name || '—'}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {h.purpose || 'Hearing'}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  Stage: {c?.current_stage || '—'}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono">
                                {c?.bench || 'Principal Bench'}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-medium">
                                  <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  <span>{h.attending_profile?.display_name || c?.lead_user?.display_name || 'Unassigned'}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center no-print">
                                <div className="flex items-center justify-center gap-1">
                                  <Link
                                    to={`/cases/${c?.id}`}
                                    className="px-2 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded"
                                  >
                                    View
                                  </Link>
                                  {c?.cnr_number && (
                                    <a
                                      href="https://services.ecourts.gov.in/ecourtindia_v6/"
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 text-slate-400 hover:text-indigo-600"
                                      title="Open eCourts"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Printed Footer */}
        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
          <div>Lextria Research Litigator &bull; Confidential &amp; Privileged Work Product</div>
          <div>Page 1 of 1</div>
        </div>
      </div>
    </div>
  );
};
export default DailyCauseListView;
