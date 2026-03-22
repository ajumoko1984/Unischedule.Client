import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, CalendarDays,
  MapPin, Clock, BookOpen, CheckSquare,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, isSameMonth, isSameDay, isToday,
  parseISO, addDays, getDay,
} from 'date-fns';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Timetable, CalendarEvent, StudyPlan, Assignment } from '../types';

// ── Colour config per event type ──────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  lecture:    { bg: 'bg-primary-50',  text: 'text-primary-700',  dot: 'bg-primary-500',  border: 'border-primary-100' },
  lab:        { bg: 'bg-cyan-50',     text: 'text-cyan-700',     dot: 'bg-cyan-500',     border: 'border-cyan-100' },
  test:       { bg: 'bg-amber-50',    text: 'text-amber-700',    dot: 'bg-amber-500',    border: 'border-amber-100' },
  exam:       { bg: 'bg-red-50',      text: 'text-red-700',      dot: 'bg-red-500',      border: 'border-red-100' },
  seminar:    { bg: 'bg-purple-50',   text: 'text-purple-700',   dot: 'bg-purple-500',   border: 'border-purple-100' },
  assignment: { bg: 'bg-orange-50',   text: 'text-orange-700',   dot: 'bg-orange-500',   border: 'border-orange-100' },
  study:      { bg: 'bg-emerald-50',  text: 'text-emerald-700',  dot: 'bg-emerald-500',  border: 'border-emerald-100' },
  other:      { bg: 'bg-slate-50',    text: 'text-slate-600',    dot: 'bg-slate-400',    border: 'border-slate-100' },
};

interface CalendarItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  type: string;
  date: Date;
  venue?: string;
  color?: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAME_TO_NUM: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

export default function CalendarPage() {
  const { user } = useAuth();
  const isStudentOrRep = user?.role === 'student' || user?.role === 'class_rep';

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: timetables = [] } = useQuery<Timetable[]>({
    queryKey: ['timetables'],
    queryFn: () => api.get('/timetable').then(r => r.data.data),
  });

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then(r => r.data.data),
  });

  const { data: studyPlan } = useQuery<StudyPlan>({
    queryKey: ['study-plan'],
    queryFn: () => api.get('/study-plan').then(r => r.data.data),
    enabled: isStudentOrRep,
  });

  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['assignments'],
    queryFn: () => api.get('/assignments').then(r => r.data.data),
    enabled: isStudentOrRep,
  });

  // ── Build unified calendar items for the visible month range ──────────────
  const allItems = useMemo((): CalendarItem[] => {
    const items: CalendarItem[] = [];

    const monthStart = startOfMonth(currentMonth);
    const monthEnd   = endOfMonth(currentMonth);
    const calStart   = startOfWeek(monthStart);
    const calEnd     = endOfWeek(monthEnd);

    // 1. Timetable recurring slots — expand into actual dates within visible range
    for (const tt of timetables) {
      for (const slot of tt.slots) {
        const targetDayNum = DAY_NAME_TO_NUM[slot.day];
        if (targetDayNum === undefined) continue;

        // Walk through the calendar range, find all matching days
        let d = new Date(calStart);
        while (d <= calEnd) {
          if (getDay(d) === targetDayNum) {
            items.push({
              id: `${slot._id}-${format(d, 'yyyy-MM-dd')}`,
              title: slot.courseTitle,
              subtitle: slot.courseCode,
              time: `${slot.startTime} – ${slot.endTime}`,
              type: slot.type,
              date: new Date(d),
              venue: slot.venue,
              color: slot.color,
            });
          }
          d = addDays(d, 1);
        }
      }
    }

    // 2. Tests / exams / events
    for (const ev of events) {
      const d = parseISO(ev.date);
      items.push({
        id: ev._id,
        title: ev.title,
        subtitle: ev.courseCode,
        time: ev.startTime,
        type: ev.category,
        date: d,
        venue: ev.venue,
      });
    }

    // 3. Study sessions (student / class rep only)
    if (isStudentOrRep && studyPlan) {
      for (const task of studyPlan.tasks) {
        if (task.status === 'missed') continue;
        const d = parseISO(task.scheduledAt);
        items.push({
          id: `study-${task._id}`,
          title: task.task,
          subtitle: task.courseCode,
          time: format(d, 'h:mm a'),
          type: 'study',
          date: d,
        });
      }
    }

    // 4. Assignments (student / class rep only)
    if (isStudentOrRep) {
      for (const a of assignments) {
        if (a.status === 'completed') continue;
        items.push({
          id: `assign-${a._id}`,
          title: a.title,
          subtitle: a.courseCode,
          time: format(parseISO(a.deadline), 'h:mm a'),
          type: 'assignment',
          date: parseISO(a.deadline),
        });
      }
    }

    return items;
  }, [timetables, events, studyPlan, assignments, currentMonth, isStudentOrRep]);

  // ── Get items for a specific day ──────────────────────────────────────────
  const getItemsForDay = (day: Date): CalendarItem[] =>
    allItems
      .filter(item => isSameDay(item.date, day))
      .sort((a, b) => a.time.localeCompare(b.time));

  // ── Calendar grid days ────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end   = endOfWeek(endOfMonth(currentMonth));
    const days: Date[] = [];
    let d = start;
    while (d <= end) { days.push(new Date(d)); d = addDays(d, 1); }
    return days;
  }, [currentMonth]);

  const selectedDayItems = getItemsForDay(selectedDay);

  // ── Legend types to show ──────────────────────────────────────────────────
  const legendItems = [
    { type: 'lecture',    label: 'Lecture' },
    { type: 'lab',        label: 'Lab' },
    { type: 'test',       label: 'Test' },
    { type: 'exam',       label: 'Exam' },
    ...(isStudentOrRep ? [
      { type: 'study',      label: 'Study session' },
      { type: 'assignment', label: 'Assignment due' },
    ] : []),
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="text-sm text-slate-500 mt-1">All your classes, events and study sessions in one view</p>
        </div>
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-semibold text-slate-800 min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()); }}
            className="ml-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        {/* ── Left: Calendar grid ───────────────────────────────────────── */}
        <div className="card overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {DAYS_OF_WEEK.map(d => (
              <div key={d} className="py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayItems     = getItemsForDay(day);
              const isCurrentMo  = isSameMonth(day, currentMonth);
              const isSelected   = isSameDay(day, selectedDay);
              const isTodayDay   = isToday(day);
              const MAX_VISIBLE  = 3;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[88px] p-1.5 border-b border-r border-slate-50 cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary-50' : 'hover:bg-slate-50/70'
                  } ${!isCurrentMo ? 'opacity-40' : ''}`}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-end mb-1">
                    <span className={`w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-full transition-colors ${
                      isTodayDay
                        ? 'bg-primary-950 text-white'
                        : isSelected
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-slate-600'
                    }`}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Event pills */}
                  <div className="space-y-0.5">
                    {dayItems.slice(0, MAX_VISIBLE).map(item => {
                      const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.other;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${cfg.bg} ${cfg.text}`}
                          title={`${item.title} · ${item.time}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          <span className="truncate">{item.subtitle || item.title}</span>
                        </div>
                      );
                    })}
                    {dayItems.length > MAX_VISIBLE && (
                      <div className="text-[10px] text-slate-400 px-1.5 font-medium">
                        +{dayItems.length - MAX_VISIBLE} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Selected day detail panel ──────────────────────────── */}
        <div className="space-y-4">
          {/* Selected day header */}
          <div className="card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                isToday(selectedDay) ? 'bg-primary-950' : 'bg-slate-100'
              }`}>
                <p className={`text-[10px] font-bold uppercase ${isToday(selectedDay) ? 'text-white/80' : 'text-slate-500'}`}>
                  {format(selectedDay, 'MMM')}
                </p>
                <p className={`text-lg font-bold leading-none ${isToday(selectedDay) ? 'text-white' : 'text-slate-700'}`}>
                  {format(selectedDay, 'd')}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-800">{format(selectedDay, 'EEEE')}</p>
                <p className="text-xs text-slate-400">
                  {selectedDayItems.length === 0
                    ? 'Nothing scheduled'
                    : `${selectedDayItems.length} event${selectedDayItems.length > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {selectedDayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarDays size={28} className="text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">Free day — no events scheduled</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDayItems.map(item => {
                  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.other;
                  return (
                    <div key={item.id} className={`p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold leading-tight ${cfg.text}`}>{item.title}</p>
                          <p className={`text-xs mt-0.5 opacity-75 ${cfg.text}`}>{item.subtitle}</p>
                          <div className={`flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 ${cfg.text} opacity-70`}>
                            <span className="flex items-center gap-1 text-[11px]">
                              <Clock size={10} /> {item.time}
                            </span>
                            {item.venue && (
                              <span className="flex items-center gap-1 text-[11px]">
                                <MapPin size={10} /> {item.venue}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[10px] font-medium capitalize px-2 py-0.5 rounded-full bg-white/60 ${cfg.text} flex-shrink-0`}>
                          {item.type}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Legend</p>
            <div className="space-y-2">
              {legendItems.map(({ type, label }) => {
                const cfg = TYPE_CONFIG[type];
                return (
                  <div key={type} className="flex items-center gap-2.5">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <span className="text-xs text-slate-600 capitalize">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* This month summary */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {format(currentMonth, 'MMMM')} summary
            </p>
            <div className="space-y-2">
              {[
                { type: 'lecture', label: 'Lectures' },
                { type: 'test',    label: 'Tests' },
                { type: 'exam',    label: 'Exams' },
                ...(isStudentOrRep ? [
                  { type: 'study',      label: 'Study sessions' },
                  { type: 'assignment', label: 'Assignments due' },
                ] : []),
              ].map(({ type, label }) => {
                const count = allItems.filter(i =>
                  i.type === type && isSameMonth(i.date, currentMonth)
                ).length;
                if (count === 0) return null;
                const cfg = TYPE_CONFIG[type];
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-xs text-slate-600">{label}</span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}