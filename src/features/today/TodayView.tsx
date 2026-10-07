// src/features/today/TodayView.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  AlertTriangle,
  Scale,
  Plus,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { litigatorDb } from '../../lib/supabase';
import { clock } from '../../lib/clock';
import { fetchTodayDashboard } from '../../lib/api';
import { UpdateHearingModal } from '../cases/UpdateHearingModal';
import { NewCaseModal } from '../cases/NewCaseModal';
import { NewAgreementModal } from '../agreements/NewAgreementModal';

export const TodayView: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Today & week hearings
  const [todayHearings, setTodayHearings] = useState<any[]>([]);
  const [weekHearings, setWeekHearings] = useState<any[]>([]);

  // Deadlines
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [overdueDeadlines, setOverdueDeadlines] = useState<any[]>([]);

  // Orders with compliance pending
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  // "Update after hearing" queue (hearing date passed, no outcome yet)
  const [unupdatedHearings, setUnupdatedHearings] = useState<any[]>([]);

  // Modals
  const [updateHearingTarget, setUpdateHearingTarget] = useState<any | null>(null);
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newAgreementOpen, setNewAgreementOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const todayStr = clock.todayYMD();
    const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    try {
      const dashboard = await fetchTodayDashboard(todayStr, next7Days);
      setTodayHearings(dashboard.todayHearings);
      setWeekHearings(dashboard.weekHearings);
      setUnupdatedHearings(dashboard.unupdatedHearings);
      setOverdueDeadlines(dashboard.overdueDeadlines);
      setUpcomingDeadlines(dashboard.upcomingDeadlines);
      setPendingOrders(dashboard.pendingOrders);
    } catch (err) {
      console.error('Error loading Today dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Litigation Master Docket &amp; Daily Focus
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Today: <span className="font-semibold text-slate-700 dark:text-slate-300">{clock.todayDisplay()}</span> • Active court appearances, compliance deadlines &amp; post-hearing records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNewCaseOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm shadow-indigo-600/30 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Case</span>
          </button>

          <button
            type="button"
            onClick={() => setNewAgreementOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-500" />
            <span>New Agreement</span>
          </button>
        </div>
      </div>

      {/* ACTION REQUIRED BANNER: Update after hearing queue */}
      {unupdatedHearings.length > 0 && (
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Update After Hearing Required ({unupdatedHearings.length})
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  These hearings have concluded but daily court orders, outcomes, and next dates have not been logged yet.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unupdatedHearings.map((h) => (
              <div
                key={h.id}
                className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-amber-200/70 dark:border-amber-800/50 flex flex-col justify-between space-y-2 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      Hearing Date: {clock.formatDisplay(h.hearing_date)}
                    </span>
                    <span className="font-mono">{h.case?.project_code?.code}</span>
                  </div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 line-clamp-1">
                    {h.case?.cause_title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {h.case?.court} • Purpose: {h.purpose}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400">
                    {h.attending_profile?.display_name ? `Attended: ${h.attending_profile.display_name}` : 'Unassigned'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUpdateHearingTarget(h)}
                    className="px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md transition shadow-2xs"
                  >
                    Log Outcome
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2-Column Grid: Left (Hearings) & Right (Deadlines & Compliance) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Court Hearings */}
        <div className="space-y-6">
          {/* Hearings Today */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Court Hearings Today ({todayHearings.length})
                </h3>
              </div>
              <button
                onClick={() => navigate('/cause-list')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>Daily Cause List</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {todayHearings.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No court hearings scheduled for today.
              </div>
            ) : (
              <div className="space-y-3">
                {todayHearings.map((h) => (
                  <div
                    key={h.id}
                    className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 bg-slate-50/50 dark:bg-slate-800/30 transition flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                          {h.case?.cause_title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {h.case?.court} {h.case?.bench ? `(${h.case.bench})` : ''} • Purpose:{' '}
                          <span className="font-medium text-slate-700 dark:text-slate-300">{h.purpose}</span>
                        </div>
                        {h.case?.cnr_number && (
                          <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                            CNR: {h.case.cnr_number}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 shrink-0">
                        TODAY
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        Counsel: {h.attending_profile?.display_name || 'Assigned Lead'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setUpdateHearingTarget(h)}
                          className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition"
                        >
                          Update Outcome
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/cases/${h.case?.id}`)}
                          className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                        >
                          View Case
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hearings Later This Week */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Hearings This Week ({weekHearings.length})
                </h3>
              </div>
              <button
                onClick={() => navigate('/calendar')}
                className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition flex items-center gap-1"
              >
                <span>Full Calendar</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {weekHearings.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No further hearings scheduled for this week.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {weekHearings.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => navigate(`/cases/${h.case?.id}`)}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg px-2 cursor-pointer transition"
                  >
                    <div>
                      <div className="font-medium text-xs text-slate-900 dark:text-slate-100">
                        {h.case?.cause_title}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {h.case?.court} • {h.purpose}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {clock.formatDisplay(h.hearing_date)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {clock.daysDifference(h.hearing_date)} day(s) away
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Deadlines & Compliance Orders */}
        <div className="space-y-6">
          {/* Overdue & Upcoming 7-day Deadlines */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Critical Deadlines (Next 7 Days &amp; Overdue)
                </h3>
              </div>
              <button
                onClick={() => navigate('/deadlines')}
                className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition flex items-center gap-1"
              >
                <span>All Deadlines</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Overdue Section */}
            {overdueDeadlines.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                  Overdue ({overdueDeadlines.length})
                </div>
                {overdueDeadlines.map((dl) => (
                  <div
                    key={dl.id}
                    className="p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-xs text-rose-900 dark:text-rose-200">
                        {dl.title}
                      </div>
                      <div className="text-[11px] text-rose-700 dark:text-rose-400">
                        Due: {clock.formatDisplay(dl.due_date)} • Owner: {dl.owner_profile?.display_name || 'Unassigned'}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                      OVERDUE
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming Section */}
            {upcomingDeadlines.length === 0 && overdueDeadlines.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No statutory or court deadlines due in the next 7 days.
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map((dl) => (
                  <div
                    key={dl.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center justify-between transition"
                  >
                    <div>
                      <div className="font-medium text-xs text-slate-900 dark:text-slate-100">
                        {dl.title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {dl.case?.cause_title || dl.agreement?.title} • {dl.deadline_type}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {clock.formatDisplay(dl.due_date)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Owner: {dl.owner_profile?.display_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Orders with Compliance Pending */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Court Orders with Compliance Pending ({pendingOrders.length})
                </h3>
              </div>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No court orders requiring active compliance verification.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 rounded-xl flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-xs text-purple-950 dark:text-purple-200">
                        {ord.summary}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {ord.case?.cause_title} ({ord.order_type})
                      </div>
                      <div className="text-[10px] text-purple-700 dark:text-purple-300 mt-1">
                        Compliance Owner: {ord.compliance_owner_profile?.display_name || 'Assigned Counsel'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                        Due: {clock.formatDisplay(ord.compliance_due)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Update Hearing Modal */}
      {updateHearingTarget && (
        <UpdateHearingModal
          isOpen={Boolean(updateHearingTarget)}
          onClose={() => setUpdateHearingTarget(null)}
          onSuccess={() => {
            setUpdateHearingTarget(null);
            loadData();
          }}
          caseId={updateHearingTarget.case_id || updateHearingTarget.case?.id}
          causeTitle={updateHearingTarget.case?.cause_title || 'Court Matter'}
          hearingId={updateHearingTarget.id}
          defaultHearingDate={updateHearingTarget.hearing_date}
          defaultPurpose={updateHearingTarget.purpose}
          clientCode={updateHearingTarget.case?.project_code?.client?.client_code}
          clientName={updateHearingTarget.case?.project_code?.client?.client_name}
          projectCode={updateHearingTarget.case?.project_code?.code}
          projectCodeId={updateHearingTarget.case?.project_code?.id}
        />
      )}

      {/* New Case Modal */}
      <NewCaseModal
        isOpen={newCaseOpen}
        onClose={() => setNewCaseOpen(false)}
        onSuccess={(caseId) => {
          loadData();
          navigate(`/cases/${caseId}`);
        }}
      />

      {/* New Agreement Modal */}
      <NewAgreementModal
        isOpen={newAgreementOpen}
        onClose={() => setNewAgreementOpen(false)}
        onSuccess={(agrId) => {
          loadData();
          navigate(`/agreements/${agrId}`);
        }}
      />
    </div>
  );
};
