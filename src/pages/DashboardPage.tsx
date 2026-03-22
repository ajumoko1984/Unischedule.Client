import { useQuery } from '@tanstack/react-query';
import {
  Users, ClipboardList, BookOpen, Bell, TrendingUp,
  Calendar, CheckSquare, AlertCircle, CheckCircle2, Clock,
  CalendarRange, ChevronRight,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, differenceInDays, isPast, startOfWeek, endOfWeek, addDays, getDay } from 'date-fns';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { DashboardStats, CalendarEvent, Timetable, Assignment, StudyPlan, WeeklySummary } from '../types';

const TODAY_NAME = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

const categoryColors: Record<string, string> = {
  lecture: 'bg-primary-50 text-primary-700 border-primary-100',
  lab:     'bg-cyan-50 text-cyan-700 border-cyan-100',
  test:    'bg-amber-50 text-amber-700 border-amber-100',
  exam:    'bg-red-50 text-red-700 border-red-100',
  seminar: 'bg-purple-50 text-purple-700 border-purple-100',
  other:   'bg-slate-50 text-slate-600 border-slate-100',
};

const notifTypeIcon: Record<string, { icon: string; color: string }> = {
  venue_change: { icon: '📍', color: 'bg-amber-50' },
  new_event:    { icon: '📅', color: 'bg-primary-50' },
  reminder:     { icon: '🔔', color: 'bg-emerald-50' },
  announcement: { icon: '📢', color: 'bg-purple-50' },
  cancellation: { icon: '❌', color: 'bg-red-50' },
};

export default function DashboardPage() {
  const { user, canManage, isLevelAdviser, isAdmin } = useAuth();
  const isStudent   = user?.role === 'student';
  const isClassRep  = user?.role === 'class_rep';
  const showStudyTools = isStudent || isClassRep;

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['stats'],
    queryFn: () => api.get('/users/stats').then(r => r.data.data),
  });

  const { data: timetables = [] } = useQuery<Timetable[]>({
    queryKey: ['timetables'],
    queryFn: () => api.get('/timetable').then(r => r.data.data),
  });

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['events', 'upcoming'],
    queryFn: () => api.get('/events?upcoming=true').then(r => r.data.data),
  });

  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['assignments'],
    queryFn: () => api.get('/assignments').then(r => r.data.data),
    enabled: showStudyTools,
  });

  const { data: studyPlan } = useQuery<StudyPlan>({
    queryKey: ['study-plan'],
    queryFn: () => api.get('/study-plan').then(r => r.data.data),
    enabled: showStudyTools,
  });

  const { data: weeklySummary } = useQuery<WeeklySummary>({
    queryKey: ['weekly-summary'],
    queryFn: () => api.get('/study-plan/weekly-summary').then(r => r.data.data),
    enabled: showStudyTools,
  });

  // Today's timetable slots
  const todaySlots = timetables
    .flatMap(t => t.slots.filter(s => s.day === TODAY_NAME))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const nextEvents = events.slice(0, 4);

  // Upcoming assignments (not completed, sorted by deadline)
  const pendingAssignments = assignments
    .filter(a => a.status !== 'completed')
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  const overdueCount = assignments.filter(a => a.status === 'overdue').length;

  // Today's study sessions
  const todayStudySessions = (studyPlan?.tasks || []).filter(t => {
    return isToday(parseISO(t.scheduledAt));
  }).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  // ── Stat cards differ by role ──────────────────────────────────────────────
  const adminStatCards = [
    { label: 'Students enrolled', value: stats?.totalStudents ?? '—', icon: Users,        color: 'text-primary-600 bg-primary-50' },
    { label: 'Upcoming tests',    value: stats?.upcomingTests ?? '—',  icon: ClipboardList, color: 'text-amber-600 bg-amber-50' },
    { label: 'Upcoming exams',    value: stats?.upcomingExams ?? '—',  icon: BookOpen,      color: 'text-red-600 bg-red-50' },
    { label: 'Notifications sent',value: stats?.recentNotifications?.length ?? '—', icon: Bell, color: 'text-emerald-600 bg-emerald-50' },
  ];

  const studentStatCards = [
    { label: "Today's classes",    value: todaySlots.length,                                              icon: Calendar,     color: 'text-primary-600 bg-primary-50' },
    { label: 'Pending assignments',value: pendingAssignments.length,                                      icon: CheckSquare,  color: 'text-amber-600 bg-amber-50' },
    { label: 'Overdue',            value: overdueCount,                                                   icon: AlertCircle,  color: overdueCount > 0 ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-50' },
    { label: 'Study sessions done (this week)', value: weeklySummary?.study.completed ?? '—', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50' },
  ];

  const statCards = showStudyTools ? studentStatCards : adminStatCards;

  // ── This week's upcoming slots (next 5 days) for the calendar preview ────
  const DAY_NAME_TO_NUM: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  const weekStart = startOfWeek(new Date());
  const weekEnd   = endOfWeek(new Date());
  const thisWeekSlots: { day: string; date: Date; courseCode: string; courseTitle: string; startTime: string; type: string; color?: string }[] = [];
  for (const tt of timetables) {
    for (const slot of tt.slots) {
      const targetDay = DAY_NAME_TO_NUM[slot.day];
      if (targetDay === undefined) continue;
      let d = new Date(weekStart);
      while (d <= weekEnd) {
        if (getDay(d) === targetDay && d >= new Date()) {
          thisWeekSlots.push({ day: slot.day, date: new Date(d), courseCode: slot.courseCode, courseTitle: slot.courseTitle, startTime: slot.startTime, type: slot.type, color: slot.color });
        }
        d = addDays(d, 1);
      }
    }
  }
  // Add upcoming events this week
  const thisWeekEvents = events.filter(ev => {
    const d = parseISO(ev.date);
    return d >= new Date() && d <= weekEnd;
  });

  const totalThisWeek = thisWeekSlots.length + thisWeekEvents.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.fullName.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.courseOfStudy} · {user?.level} Level · {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Weekly summary banner — students only */}
      {showStudyTools && weeklySummary && (weeklySummary.study.total > 0 || weeklySummary.assignments.total > 0) && (
        <div className="card p-4 flex items-center gap-4 bg-primary-50/40 border-primary-100">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">This week: {weeklySummary.study.completed}/{weeklySummary.study.total} study sessions · {weeklySummary.assignments.completed}/{weeklySummary.assignments.total} assignments</p>
            <p className="text-xs text-slate-500 truncate">{weeklySummary.message}</p>
          </div>
          <Link to="/study-planner" className="btn-secondary text-xs flex-shrink-0">View details</Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
                <p className="text-3xl font-semibold text-slate-800 mt-1">{value}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={17} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Calendar quick-access strip ──────────────────────────────────── */}
      <Link to="/calendar" className="card p-4 flex items-center gap-4 hover:shadow-elevated transition-all group cursor-pointer no-underline block">
        <div className="w-11 h-11 bg-primary-950 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary-900 transition-colors">
          <CalendarRange size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">View Full Calendar</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalThisWeek > 0
              ? `${thisWeekSlots.length} class${thisWeekSlots.length !== 1 ? 'es' : ''}${thisWeekEvents.length > 0 ? ` · ${thisWeekEvents.length} test/exam${thisWeekEvents.length !== 1 ? 's' : ''}` : ''} remaining this week`
              : 'No more scheduled classes this week'}
          </p>
        </div>
        {/* Mini day pills */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {['Mon','Tue','Wed','Thu','Fri'].map((d, i) => {
            const dayDate = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i);
            const hasEvent = thisWeekSlots.some(s => isToday(s.date) ? false : format(s.date, 'EEE') === d)
              || thisWeekEvents.some(ev => format(parseISO(ev.date), 'EEE') === d);
            const isCurrentDay = isToday(dayDate);
            return (
              <div key={d} className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                isCurrentDay
                  ? 'bg-primary-950 text-white'
                  : hasEvent
                  ? 'bg-primary-50 text-primary-600'
                  : 'bg-slate-50 text-slate-400'
              }`}>
                <span>{d}</span>
                {hasEvent && !isCurrentDay && <div className="w-1 h-1 bg-primary-400 rounded-full mt-0.5" />}
                {isCurrentDay && <div className="w-1 h-1 bg-white rounded-full mt-0.5" />}
              </div>
            );
          })}
        </div>
        <ChevronRight size={16} className="text-slate-400 group-hover:text-primary-500 transition-colors flex-shrink-0" />
      </Link>

      {/* Main grid */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Today's schedule */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Calendar size={16} className="text-primary-500" />
              Today's Schedule
              <span className="text-xs font-normal text-slate-400">({TODAY_NAME})</span>
            </h2>
            <span className="text-xs text-slate-400">{todaySlots.length} class{todaySlots.length !== 1 ? 'es' : ''}</span>
          </div>

          {todaySlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <Calendar size={20} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No classes today</p>
              <p className="text-xs text-slate-400 mt-1">Enjoy your free day!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todaySlots.map(slot => (
                <div key={slot._id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                  <div className="text-right w-20 flex-shrink-0">
                    <p className="text-xs font-medium text-slate-700">{slot.startTime}</p>
                    <p className="text-xs text-slate-400">{slot.endTime}</p>
                  </div>
                  <div className="w-0.5 self-stretch rounded-full mt-1" style={{ backgroundColor: slot.color || '#2563eb' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{slot.courseTitle}</p>
                    <p className="text-xs text-slate-500">{slot.courseCode} · {slot.venue}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize ${categoryColors[slot.type] || categoryColors.other}`}>
                    {slot.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming tests & exams */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-500" />
              Upcoming Tests & Exams
            </h2>
            <span className="text-xs text-slate-400">{nextEvents.length} upcoming</span>
          </div>

          {nextEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <ClipboardList size={20} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-2">
              {nextEvents.map(ev => {
                const d = parseISO(ev.date);
                const relative = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'MMM d');
                const isUrgent = isToday(d) || isTomorrow(d);
                return (
                  <div key={ev._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${isUrgent ? 'bg-red-50' : 'bg-slate-100'}`}>
                      <p className={`text-[10px] font-semibold uppercase ${isUrgent ? 'text-red-500' : 'text-slate-500'}`}>{format(d, 'MMM')}</p>
                      <p className={`text-sm font-bold leading-none ${isUrgent ? 'text-red-600' : 'text-slate-700'}`}>{format(d, 'd')}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{ev.title}</p>
                      <p className="text-xs text-slate-500">{ev.courseCode} · {ev.startTime}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize ${ev.category === 'exam' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                        {ev.category}
                      </span>
                      <p className={`text-[10px] mt-1 ${isUrgent ? 'text-red-500 font-medium' : 'text-slate-400'}`}>{relative}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Student-specific section: Assignments + Today's Study Sessions */}
      {showStudyTools && (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Pending assignments */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <CheckSquare size={16} className="text-primary-500" />
                Assignments
              </h2>
              <Link to="/assignments" className="text-xs text-primary-600 hover:underline">View all →</Link>
            </div>

            {overdueCount > 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg mb-3">
                <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-700 font-medium">{overdueCount} overdue assignment{overdueCount > 1 ? 's' : ''} — check ASAP</p>
              </div>
            )}

            {pendingAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 size={24} className="text-emerald-400 mb-2" />
                <p className="text-sm text-slate-500">All caught up! No pending assignments.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingAssignments.map(a => {
                  const d = parseISO(a.deadline);
                  const isOverdue = a.status === 'overdue' || isPast(d);
                  const daysLeft  = differenceInDays(d, new Date());
                  const urgentDue = daysLeft <= 2 && !isOverdue;
                  return (
                    <div key={a._id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <div className={`w-1.5 self-stretch rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-400' : urgentDue ? 'bg-amber-400' : 'bg-primary-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{a.title}</p>
                        <p className="text-xs text-slate-500 font-mono">{a.courseCode}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-[11px] font-medium ${isOverdue ? 'text-red-500' : urgentDue ? 'text-amber-600' : 'text-slate-400'}`}>
                          {isOverdue ? 'Overdue!' : daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d left`}
                        </p>
                        <span className={`text-[10px] capitalize px-1.5 py-0.5 rounded ${
                          a.priority === 'high' ? 'bg-red-50 text-red-600' : a.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                        }`}>{a.priority}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today's study sessions */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <BookOpen size={16} className="text-primary-500" />
                Today's Study Sessions
              </h2>
              <Link to="/study-planner" className="text-xs text-primary-600 hover:underline">Planner →</Link>
            </div>

            {todayStudySessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <BookOpen size={20} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">No study sessions today</p>
                <Link to="/study-planner" className="text-xs text-primary-600 mt-1 hover:underline">Plan one now →</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {todayStudySessions.map(t => {
                  const statusColor = t.status === 'completed' ? 'text-emerald-600' : t.status === 'in_progress' ? 'text-blue-600' : t.status === 'missed' ? 'text-red-500' : 'text-slate-500';
                  return (
                    <div key={t._id} className={`flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors ${t.status === 'completed' ? 'opacity-60' : ''}`}>
                      <div className={`mt-0.5 flex-shrink-0 ${statusColor}`}>
                        {t.status === 'completed' ? <CheckCircle2 size={16} /> : t.status === 'in_progress' ? <Clock size={16} /> : <Clock size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium text-slate-800 truncate ${t.status === 'completed' ? 'line-through text-slate-400' : ''}`}>{t.task}</p>
                        <p className="text-xs text-slate-500 font-mono">{t.courseCode} · {format(parseISO(t.scheduledAt), 'h:mm a')} · {t.durationMinutes}min</p>
                      </div>
                      <span className={`text-[11px] capitalize font-medium ${statusColor}`}>{t.status.replace('_', ' ')}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent notifications */}
      {stats?.recentNotifications && stats.recentNotifications.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Bell size={16} className="text-primary-500" />
            Recent Notifications
          </h2>
          <div className="space-y-2">
            {stats.recentNotifications.map(n => {
              const meta = notifTypeIcon[n.type] || notifTypeIcon.announcement;
              return (
                <div key={n._id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${meta.color}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{n.subject}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      By {n.sentBy?.fullName} · {n.recipientCount} recipients · {format(parseISO(n.createdAt), 'MMM d, h:mm a')}
                      {n.isAutomatic && <span className="ml-1 text-emerald-500">· auto</span>}
                    </p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${n.deliveryStatus === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {n.deliveryStatus}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}