// src/features/calendar/CalendarView.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Scale,
  Clock,
  Filter,
} from 'lucide-react';
import { fetchCalendarEvents, fetchProfiles } from '../../lib/api';
import { clock } from '../../lib/clock';
import type { CoreProfile } from '../../lib/types';

export const CalendarView: React.FC = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<CoreProfile[]>([]);
  const [selectedPerson, setSelectedPerson] = useState('');
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const [currentDate, setCurrentDate] = useState(new Date());
  const [hearings, setHearings] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles().then(setProfiles).catch(console.error);
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      // Range for current month +/- 7 days for padding
      const start = new Date(year, month - 1, 20).toISOString().slice(0, 10);
      const end = new Date(year, month + 2, 10).toISOString().slice(0, 10);

      const res = await fetchCalendarEvents(start, end);
      setHearings(res.hearings);
      setDeadlines(res.deadlines);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [currentDate]);

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Generate calendar days for month view
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: Array<{ day: number; dateStr: string; isCurrentMonth: boolean }> = [];

  // Previous month padding
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const mStr = String(month === 0 ? 12 : month).padStart(2, '0');
    const yStr = month === 0 ? year - 1 : year;
    calendarDays.push({
      day: d,
      dateStr: `${yStr}-${mStr}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(month + 1).padStart(2, '0');
    calendarDays.push({
      day: d,
      dateStr: `${year}-${mStr}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: true,
    });
  }

  // Next month padding (up to 35 or 42 cells)
  const remainingCells = (7 - (calendarDays.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const mStr = String(month + 2 > 12 ? 1 : month + 2).padStart(2, '0');
    const yStr = month + 2 > 12 ? year + 1 : year;
    calendarDays.push({
      day: d,
      dateStr: `${yStr}-${mStr}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false,
    });
  }

  // Filter events by selected person
  const filteredHearings = hearings.filter((h) => {
    if (!selectedPerson) return true;
    return h.attended_by === selectedPerson || h.case?.lead_user_id === selectedPerson;
  });

  const filteredDeadlines = deadlines.filter((d) => {
    if (!selectedPerson) return true;
    return d.owner_user_id === selectedPerson;
  });

  const todayStr = clock.todayYMD();

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Court Hearings &amp; Statutory Deadlines Calendar
          </h1>
          <p className="text-xs text-slate-500">
            Unified appearance schedule and procedural milestone tracker
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Person Filter */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
            >
              <option value="">All Team Members</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Month/Week Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md transition ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-md transition ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Week
            </button>
          </div>

          {/* Prev / Today / Next Buttons */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5">
            <button
              onClick={handlePrev}
              className="p-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded py-1"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Month Title Banner */}
      <div className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
        <span>
          {monthNames[month]} {year}
        </span>
        {loading && <span className="text-xs font-normal text-slate-400">Loading events...</span>}
      </div>

      {/* Month Calendar Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center py-2.5">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
          {calendarDays.map((cDay, idx) => {
            const isToday = cDay.dateStr === todayStr;
            const dayHearings = filteredHearings.filter((h) => h.hearing_date === cDay.dateStr);
            const dayDeadlines = filteredDeadlines.filter((d) => d.due_date === cDay.dateStr);

            return (
              <div
                key={idx}
                className={`min-h-[110px] p-2 flex flex-col justify-between transition ${
                  cDay.isCurrentMonth
                    ? 'bg-white dark:bg-slate-900'
                    : 'bg-slate-50/50 dark:bg-slate-950/40 text-slate-400'
                } ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''}`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-semibold inline-flex items-center justify-center rounded-full ${
                      isToday
                        ? 'w-6 h-6 bg-indigo-600 text-white font-bold'
                        : cDay.isCurrentMonth
                        ? 'text-slate-800 dark:text-slate-200'
                        : 'text-slate-400'
                    }`}
                  >
                    {cDay.day}
                  </span>

                  {(dayHearings.length > 0 || dayDeadlines.length > 0) && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {dayHearings.length + dayDeadlines.length}
                    </span>
                  )}
                </div>

                {/* Day Items List */}
                <div className="space-y-1 flex-1 overflow-y-auto max-h-24">
                  {/* Hearings Chips */}
                  {dayHearings.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => navigate(`/cases/${h.case?.id}`)}
                      className="p-1 rounded bg-indigo-100 dark:bg-indigo-950/70 hover:bg-indigo-200 dark:hover:bg-indigo-900 text-indigo-900 dark:text-indigo-200 text-[10px] font-medium truncate cursor-pointer transition flex items-center gap-1 border border-indigo-200/60 dark:border-indigo-800/60"
                      title={`${h.case?.cause_title} (${h.purpose})`}
                    >
                      <Scale className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                      <span className="truncate">{h.case?.cause_title || h.purpose}</span>
                    </div>
                  ))}

                  {/* Deadlines Chips */}
                  {dayDeadlines.map((dl) => (
                    <div
                      key={dl.id}
                      onClick={() => navigate('/deadlines')}
                      className="p-1 rounded bg-rose-100 dark:bg-rose-950/70 hover:bg-rose-200 dark:hover:bg-rose-900 text-rose-900 dark:text-rose-200 text-[10px] font-medium truncate cursor-pointer transition flex items-center gap-1 border border-rose-200/60 dark:border-rose-800/60"
                      title={`Deadline: ${dl.title}`}
                    >
                      <Clock className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                      <span className="truncate">{dl.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend Footer */}
      <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-500" />
          <span>Court Hearings (Indigo)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-rose-500" />
          <span>Statutory &amp; Court Deadlines (Rose)</span>
        </div>
      </div>
    </div>
  );
};
