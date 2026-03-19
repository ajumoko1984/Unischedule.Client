import { useQuery } from '@tanstack/react-query';
import { Users, ClipboardList, BookOpen, Bell, TrendingUp, Calendar } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { DashboardStats, CalendarEvent, Timetable } from '../types';

const DAYS: Record<string, number> = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5 };
const TODAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

const categoryColors: Record<string, string> = {
  lecture: 'bg-primary-50 text-primary-700 border-primary-100',
  lab: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  test: 'bg-amber-50 text-amber-700 border-amber-100',
  exam: 'bg-red-50 text-red-700 border-red-100',
  seminar: 'bg-purple-50 text-purple-700 border-purple-100',
  other: 'bg-slate-50 text-slate-600 border-slate-100',
};

const notifTypeIcon: Record<string, { icon: string; color: string }> = {
  venue_change: { icon: '📍', color: 'bg-amber-50' },
  new_event:    { icon: '📅', color: 'bg-primary-50' },
  reminder:     { icon: '🔔', color: 'bg-emerald-50' },
  announcement: { icon: '📢', color: 'bg-purple-50' },
  cancellation: { icon: '❌', color: 'bg-red-50' },
};

export default function DashboardPage() {
  const { user, canManage } = useAuth();

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

  // Today's slots
  const todaySlots = timetables
    .flatMap(t => t.slots.filter(s => s.day === TODAY_NAME))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Next 5 upcoming events
  const nextEvents = events.slice(0, 5);

  const statCards = [
    { label: 'Students enrolled', value: stats?.totalStudents ?? '—', icon: Users, color: 'text-primary-600 bg-primary-50' },
    { label: 'Upcoming tests', value: stats?.upcomingTests ?? '—', icon: ClipboardList, color: 'text-amber-600 bg-amber-50' },
    { label: 'Upcoming exams', value: stats?.upcomingExams ?? '—', icon: BookOpen, color: 'text-red-600 bg-red-50' },
    { label: 'Notifications sent', value: stats?.recentNotifications?.length ?? '—', icon: Bell, color: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.fullName.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.courseOfStudy} · {user?.level} Level ·{' '}
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

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
                  <div className={`w-0.5 self-stretch rounded-full mt-1`} style={{ backgroundColor: slot.color || '#2563eb' }} />
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
                      <p className="text-xs text-slate-500">{ev.courseCode} · {ev.venue} · {ev.startTime}</p>
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
