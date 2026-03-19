import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Bell, Trash2, Loader2, X, Calendar, MapPin, Clock } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { CalendarEvent, EventCategory } from '../types';

const CATEGORIES: EventCategory[] = ['test', 'exam', 'assignment', 'project', 'other'];
const SEMESTERS = ['First', 'Second'];

const catStyle: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  test:       { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-100', dot: 'bg-amber-400' },
  exam:       { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-100',   dot: 'bg-red-500' },
  assignment: { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-100',  dot: 'bg-blue-400' },
  project:    { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100',dot: 'bg-purple-400' },
  other:      { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-100', dot: 'bg-slate-400' },
};

const emptyForm = {
  title: '', courseCode: '', courseTitle: '', category: 'test' as EventCategory,
  date: '', startTime: '', endTime: '', venue: '', description: '',
  semester: 'Second', academicYear: '2024/2025', sendEmailNow: false,
};

export default function EventsPage() {
  const { canManage, user } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | EventCategory>('all');
  const [form, setForm] = useState({ ...emptyForm });

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then(r => r.data.data),
  });

  const createEvent = useMutation({
    mutationFn: (data: object) => api.post('/events', {
      ...data, faculty: user?.faculty, level: user?.level, courseOfStudy: user?.courseOfStudy,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setShowModal(false); setForm({ ...emptyForm }); toast.success('Event created!'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Event deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const sendReminder = useMutation({
    mutationFn: (id: string) => api.post(`/events/${id}/remind`),
    onSuccess: (res) => toast.success(res.data.message || 'Reminder sent!'),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const filtered = filter === 'all' ? events : events.filter(e => e.category === filter);
  const upcoming = filtered.filter(e => e.status === 'upcoming');
  const past = filtered.filter(e => e.status !== 'upcoming');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Tests & Exams</h1>
          <p className="text-sm text-slate-500 mt-1">All scheduled assessments and events</p>
        </div>
        {canManage && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex-shrink-0">
            <Plus size={15} /> Add Event
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {(['all', ...CATEGORIES] as const).map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors ${
              filter === cat ? 'bg-primary-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}>
            {cat === 'all' ? 'All events' : cat}
          </button>
        ))}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="section-title mb-3">Upcoming ({upcoming.length})</h2>
          <div className="grid gap-3">
            {upcoming.map(ev => <EventCard key={ev._id} event={ev} canManage={canManage} onDelete={deleteEvent.mutate} onRemind={sendReminder.mutate} reminderLoading={sendReminder.isPending} />)}
          </div>
        </div>
      )}

      {upcoming.length === 0 && (
        <div className="card p-14 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
            <Calendar size={24} className="text-primary-400" />
          </div>
          <h3 className="font-semibold text-slate-700">No upcoming events</h3>
          <p className="text-sm text-slate-400 mt-1">{canManage ? 'Add a test or exam to get started.' : 'Check back later.'}</p>
          {canManage && <button onClick={() => setShowModal(true)} className="mt-4 btn-primary"><Plus size={14} /> Add Event</button>}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h2 className="section-title mb-3">Past events ({past.length})</h2>
          <div className="grid gap-3">
            {past.map(ev => <EventCard key={ev._id} event={ev} canManage={canManage} onDelete={deleteEvent.mutate} onRemind={sendReminder.mutate} reminderLoading={false} isPast />)}
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-modal p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-800">Add Test / Exam / Event</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Event title</label>
                <input className="input" placeholder="e.g. EDT 401 Mid-Semester Test" value={form.title} onChange={set('title')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Course code</label>
                  <input className="input uppercase" placeholder="EDT 401" value={form.courseCode} onChange={set('courseCode')} />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={form.category} onChange={set('category')}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Course title</label>
                <input className="input" placeholder="Instructional Technology" value={form.courseTitle} onChange={set('courseTitle')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={form.date} onChange={set('date')} />
                </div>
                <div>
                  <label className="label">Venue</label>
                  <input className="input" placeholder="Exam Hall A" value={form.venue} onChange={set('venue')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start time</label>
                  <input type="time" className="input" value={form.startTime} onChange={set('startTime')} />
                </div>
                <div>
                  <label className="label">End time (optional)</label>
                  <input type="time" className="input" value={form.endTime} onChange={set('endTime')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Semester</label>
                  <select className="input" value={form.semester} onChange={set('semester')}>
                    {SEMESTERS.map(s => <option key={s} value={s}>{s} Semester</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Academic year</label>
                  <input className="input" placeholder="2024/2025" value={form.academicYear} onChange={set('academicYear')} />
                </div>
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <textarea className="input resize-none" rows={2} placeholder="Additional instructions..." value={form.description} onChange={set('description')} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded text-primary-600"
                  checked={form.sendEmailNow} onChange={e => setForm(f => ({ ...f, sendEmailNow: e.target.checked }))} />
                <span className="text-sm text-slate-600">Send email notification to all students now</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary flex-1" onClick={() => createEvent.mutate(form)} disabled={createEvent.isPending}>
                  {createEvent.isPending ? <Loader2 size={14} className="animate-spin" /> : null} Create Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, canManage, onDelete, onRemind, reminderLoading, isPast = false }:
  { event: CalendarEvent; canManage: boolean; onDelete: (id: string) => void; onRemind: (id: string) => void; reminderLoading: boolean; isPast?: boolean }) {
  const d = parseISO(event.date);
  const isUrgent = isToday(d) || isTomorrow(d);
  const style = catStyle[event.category] || catStyle.other;
  const dateLabel = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE, MMM d');

  return (
    <div className={`card p-4 flex items-start gap-4 ${isPast ? 'opacity-60' : ''}`}>
      {/* Date block */}
      <div className={`w-14 flex-shrink-0 flex flex-col items-center justify-center rounded-xl py-2.5 ${isUrgent && !isPast ? 'bg-red-50' : 'bg-slate-50'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wide ${isUrgent && !isPast ? 'text-red-400' : 'text-slate-400'}`}>{format(d, 'MMM')}</p>
        <p className={`text-2xl font-bold leading-none ${isUrgent && !isPast ? 'text-red-600' : 'text-slate-700'}`}>{format(d, 'd')}</p>
        <p className={`text-[10px] ${isUrgent && !isPast ? 'text-red-400' : 'text-slate-400'}`}>{format(d, 'EEE')}</p>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <h3 className="font-semibold text-slate-800 flex-1">{event.title}</h3>
          <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border capitalize ${style.bg} ${style.text} ${style.border}`}>
            {event.category}
          </span>
        </div>
        <p className="text-sm text-slate-500 font-mono mt-0.5">{event.courseCode} – {event.courseTitle}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={11} /> {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}</span>
          <span className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={11} /> {event.venue}</span>
          {event.emailSent && <span className="text-xs text-emerald-600 flex items-center gap-1">✓ Email sent</span>}
        </div>
        {event.description && <p className="text-xs text-slate-400 mt-1.5">{event.description}</p>}
      </div>

      {/* Actions */}
      {canManage && !isPast && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => onRemind(event._id)} disabled={reminderLoading}
            className="btn-ghost text-xs px-2.5 py-1.5 text-primary-600 hover:bg-primary-50 border border-primary-100">
            <Bell size={12} /> Remind
          </button>
          <button onClick={() => { if (confirm('Delete this event?')) onDelete(event._id); }}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
