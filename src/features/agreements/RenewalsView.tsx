// src/features/agreements/RenewalsView.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  FileText,
  User,
  ArrowRight,
} from 'lucide-react';
import { fetchAgreements, fetchDeadlines, markDeadlineDone } from '../../lib/api';
import { clock } from '../../lib/clock';
import { AgreementRecord, DeadlineRecord } from '../../lib/types';

interface RenewalItem {
  id: string;
  agreementId: string;
  agreementTitle: string;
  agreementType: string;
  clientName: string;
  projectCode: string;
  expiryDate?: string | null;
  noticeDays?: number | null;
  noticeDueDate?: string | null;
  renewalType: string;
  leadUser?: string;
  daysToExpiry: number | null;
  daysToNotice: number | null;
  deadlineId?: string;
}

export const RenewalsView: React.FC = () => {
  const [items, setItems] = useState<RenewalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'notice_due' | 'expiring_soon'>('all');

  const loadRenewals = async () => {
    setLoading(true);
    try {
      const [agrs, deadlines] = await Promise.all([
        fetchAgreements(),
        fetchDeadlines({ status: 'OPEN' }),
      ]);

      const today = new Date(clock.todayYMD() + 'T00:00:00');
      const ninetyDaysFromNow = new Date(today);
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

      const renewalList: RenewalItem[] = [];

      for (const agr of agrs) {
        if (!agr.expiry_date) continue;

        const expDate = new Date(agr.expiry_date + 'T00:00:00');
        const diffDaysExp = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let noticeDueDateStr: string | null = null;
        let diffDaysNotice: number | null = null;

        if (agr.notice_days && agr.notice_days > 0) {
          const nDate = new Date(expDate);
          nDate.setDate(nDate.getDate() - agr.notice_days);
          noticeDueDateStr = nDate.toISOString().split('T')[0];
          diffDaysNotice = Math.ceil((nDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Match renewal deadlines
        const matchingDeadline = deadlines.find(
          (d) => d.agreement_id === agr.id && d.deadline_type === 'RENEWAL'
        );

        // Include if expiring within 90 days, notice due within 90 days, or already overdue
        const isExpiringIn90 = diffDaysExp <= 90;
        const isNoticeDueIn90 = diffDaysNotice !== null && diffDaysNotice <= 90;

        if (isExpiringIn90 || isNoticeDueIn90 || matchingDeadline) {
          renewalList.push({
            id: agr.id,
            agreementId: agr.id,
            agreementTitle: agr.title,
            agreementType: agr.agreement_type,
            clientName: agr.project_code?.client?.client_name || '—',
            projectCode: agr.project_code?.code || '—',
            expiryDate: agr.expiry_date,
            noticeDays: agr.notice_days,
            noticeDueDate: noticeDueDateStr,
            renewalType: agr.renewal_type || 'NONE',
            leadUser: agr.lead_user?.display_name,
            daysToExpiry: diffDaysExp,
            daysToNotice: diffDaysNotice,
            deadlineId: matchingDeadline?.id,
          });
        }
      }

      // Sort by earliest notice due or earliest expiry
      renewalList.sort((a, b) => {
        const aKey = a.daysToNotice !== null ? a.daysToNotice : a.daysToExpiry || 999;
        const bKey = b.daysToNotice !== null ? b.daysToNotice : b.daysToExpiry || 999;
        return aKey - bKey;
      });

      setItems(renewalList);
    } catch (err) {
      console.error('Failed to load renewals docket:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRenewals();
  }, []);

  const filteredItems = items.filter((item) => {
    if (filter === 'notice_due') {
      return item.daysToNotice !== null && item.daysToNotice <= 30;
    }
    if (filter === 'expiring_soon') {
      return item.daysToExpiry !== null && item.daysToExpiry <= 60;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <RefreshCw className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Contract Renewals &amp; Expirations Docket
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Agreements expiring or with notice deadlines in the next 90 days
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              filter === 'all'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            All (90d)
          </button>
          <button
            type="button"
            onClick={() => setFilter('notice_due')}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              filter === 'notice_due'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Notice Window Close (30d)
          </button>
          <button
            type="button"
            onClick={() => setFilter('expiring_soon')}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              filter === 'expiring_soon'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Expiring Soon (60d)
          </button>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Scanning contracts for renewal windows...</div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
            All Contract Renewals Up to Date
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No agreements have expiration dates or notice period cutoffs within the next 90 days.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isNoticeOverdue = item.daysToNotice !== null && item.daysToNotice < 0;
            const isExpOverdue = item.daysToExpiry !== null && item.daysToExpiry < 0;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl p-4 sm:p-5 shadow-2xs transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Left Info */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {item.agreementType}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {item.projectCode}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Renewal: {item.renewalType}
                    </span>
                  </div>

                  <Link
                    to={`/agreements/${item.agreementId}`}
                    className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                  >
                    {item.agreementTitle}
                  </Link>

                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                    <span>Client: <strong className="text-slate-700 dark:text-slate-300">{item.clientName}</strong></span>
                    <span>&bull;</span>
                    <span>Lead: <strong className="text-slate-700 dark:text-slate-300">{item.leadUser || 'Unassigned'}</strong></span>
                  </div>
                </div>

                {/* Deadlines & Badges */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
                  {/* Notice Deadline */}
                  {item.noticeDueDate && (
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Notice Cutoff</div>
                      <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {item.noticeDueDate}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.2 rounded-full inline-block mt-0.5 ${
                          isNoticeOverdue
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : item.daysToNotice !== null && item.daysToNotice <= 15
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {isNoticeOverdue
                          ? `${Math.abs(item.daysToNotice!)}d Overdue!`
                          : `In ${item.daysToNotice} days`}
                      </span>
                    </div>
                  )}

                  {/* Expiry Date */}
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Expires On</div>
                    <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                      {item.expiryDate}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.2 rounded-full inline-block mt-0.5 ${
                        isExpOverdue
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : item.daysToExpiry !== null && item.daysToExpiry <= 30
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      }`}
                    >
                      {isExpOverdue
                        ? `${Math.abs(item.daysToExpiry!)}d Expired`
                        : `In ${item.daysToExpiry} days`}
                    </span>
                  </div>

                  {/* Action Link */}
                  <Link
                    to={`/agreements/${item.agreementId}`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold transition"
                  >
                    Action <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default RenewalsView;
