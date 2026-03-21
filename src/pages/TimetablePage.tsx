import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MapPin, Pencil, Loader2, X, Trash2, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Timetable, TimetableSlot, DayOfWeek } from '../types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMES = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
const SLOT_COLORS = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#db2777'];

const typeColors: Record<string, string> = {
  lecture: '#2563eb', lab: '#0891b2', test: '#d97706',
  exam: '#dc2626', seminar: '#7c3aed', other: '#64748b',
};

interface SlotFormData {
  courseCode: string; courseTitle: string; lecturer: string;
  venue: string; day: DayOfWeek; startTime: string; endTime: string;
  type: string; color: string;
}

const emptySlot: SlotFormData = {
  courseCode: '', courseTitle: '', lecturer: '', venue: '',
  day: 'Monday', startTime: '08:00', endTime: '10:00',
  type: 'lecture', color: '#2563eb',
};

export default function TimetablePage() {
  const { canManage, user } = useAuth();
  const qc = useQueryClient();

  const [activeDay, setActiveDay] = useState<DayOfWeek>(() => {
    const today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    return (DAYS.includes(today as DayOfWeek) ? today : 'Monday') as DayOfWeek;
  });
  const [showAddTimetable, setShowAddTimetable] = useState(false);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [showVenueModal, setShowVenueModal] = useState<{ timetableId: string; slot: TimetableSlot } | null>(null);
  const [notifySlot, setNotifySlot] = useState<TimetableSlot | null>(null);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [slotForm, setSlotForm] = useState<SlotFormData>(emptySlot);
  const [timetableForm, setTimetableForm] = useState({ title: '', semester: 'Second', academicYear: '2024/2025' });
  const [editTimetableForm, setEditTimetableForm] = useState({ title: '', semester: 'Second', academicYear: '2024/2025' });
  const [showEditTimetable, setShowEditTimetable] = useState(false);
  const [venueForm, setVenueForm] = useState({ newVenue: '', reason: '' });
  const [activeTimetableId, setActiveTimetableId] = useState<string | null>(null);

const { data, isLoading } = useQuery<Timetable[]>({
  queryKey: ['timetables'],
  queryFn: async (): Promise<Timetable[]> => {
    const res = await api.get('/timetable');
    return res.data.data;
  },
});

const timetables: Timetable[] = data ?? [];

useEffect(() => {
  if (timetables.length && !activeTimetableId) {
    setActiveTimetableId(timetables[0]._id);
  }
}, [timetables, activeTimetableId]);

 const activeTimetable = timetables.find(t => t._id === activeTimetableId) || timetables[0];
 
  const createTimetable = useMutation({
    mutationFn: (data: object) => api.post('/timetable', {
      ...data,faculty: user?.faculty, level: user?.level,
      courseOfStudy: user?.courseOfStudy, slots: [],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timetables'] }); setShowAddTimetable(false); toast.success('Timetable created!'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create'),
  });

  const addSlot = useMutation({
    mutationFn: (data: object) => api.put(`/timetable/${activeTimetable?._id}`, {
      slots: [...(activeTimetable?.slots || []), data],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timetables'] }); setShowAddSlot(false); setSlotForm(emptySlot); toast.success('Class added!'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const editSlot = useMutation({
    mutationFn: (data: SlotFormData) => {
      const updatedSlots = (activeTimetable?.slots || []).map(s =>
        s._id === editingSlot?._id ? { ...s, ...data } : s
      );
      return api.put(`/timetable/${activeTimetable?._id}`, { slots: updatedSlots });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timetables'] });
      setEditingSlot(null);
      setSlotForm(emptySlot);
      toast.success('Class updated!');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteSlot = useMutation({
    mutationFn: (slotId: string) => {
      const updatedSlots = (activeTimetable?.slots || []).filter(s => s._id !== slotId);
      return api.put(`/timetable/${activeTimetable?._id}`, { slots: updatedSlots });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timetables'] }); toast.success('Class removed!'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateTimetableMeta = useMutation({
    mutationFn: (data: object) => api.put(`/timetable/${activeTimetable?._id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timetables'] });
      setShowEditTimetable(false);
      toast.success('Timetable updated!');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteTimetable = useMutation({
    mutationFn: (id: string) => api.delete(`/timetable/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timetables'] });
      setActiveTimetableId(null);
      toast.success('Timetable deleted!');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateVenue = useMutation({
    mutationFn: (data: object) => api.put('/timetable/venue', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['timetables'] });
      setShowVenueModal(null);
      toast.success(res.data.message || 'Venue updated!');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const sendSlotNotification = useMutation({
    mutationFn: (slot: TimetableSlot) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayName = tomorrow.toLocaleDateString('en-NG', { weekday: 'long' });
      const isReminder = slot.day === dayName;

      const subject = isReminder
        ? `Reminder: ${slot.courseCode} – ${slot.courseTitle} is tomorrow`
        : `Class Notice: ${slot.courseCode} – ${slot.courseTitle}`;

      const defaultMsg = isReminder
        ? `This is a reminder that ${slot.courseTitle} (${slot.courseCode}) holds tomorrow, ${slot.day} from ${slot.startTime} to ${slot.endTime} at ${slot.venue}. Lecturer: ${slot.lecturer}.`
        : `Please be informed that ${slot.courseTitle} (${slot.courseCode}) holds on ${slot.day} from ${slot.startTime} to ${slot.endTime} at ${slot.venue}. Lecturer: ${slot.lecturer}.`;

      return api.post('/notifications/notify-slot', {
        subject,
        message: notifyMessage.trim() || defaultMsg,
        type: isReminder ? 'reminder' : 'announcement',
        courseCode: slot.courseCode,
        courseTitle: slot.courseTitle,
        venue: slot.venue,
        day: slot.day,
        time: `${slot.startTime} – ${slot.endTime}`,
      });
    },
    onSuccess: (res) => {
      toast.success(res.data.message || 'Students notified!');
      setNotifySlot(null);
      setNotifyMessage('');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to send'),
  });

  const daySlots = (activeTimetable?.slots || [])
    .filter(s => s.day === activeDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-primary-500" />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="text-sm text-slate-500 mt-1">Weekly class schedule for {user?.level} Level</p>
        </div>
        {canManage && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setShowAddSlot(true)} disabled={!activeTimetable} className="btn-primary">
              <Plus size={15} /> Add Class
            </button>
            <button onClick={() => setShowAddTimetable(true)} className="btn-secondary">
              <Plus size={15} /> New Timetable
            </button>
          </div>
        )}
      </div>

      {/* Timetable selector */}
      {timetables.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {timetables.map(t => (
            <div key={t._id} className="flex items-center gap-0.5">
              <button
                onClick={() => setActiveTimetableId(t._id)}
                className={`px-3 py-1.5 text-sm rounded-l-lg border-y border-l transition-colors ${
                  activeTimetable?._id === t._id
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.title}
              </button>
              {canManage && activeTimetable?._id === t._id && (
                <>
                  <button
                    onClick={() => {
                      setEditTimetableForm({ title: t.title, semester: t.semester, academicYear: t.academicYear });
                      setShowEditTimetable(true);
                    }}
                    className="px-2 py-1.5 text-sm border-y border-slate-200 bg-white text-slate-500 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="Edit timetable"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${t.title}"? This will remove all classes inside it.`)) {
                        deleteTimetable.mutate(t._id);
                      }
                    }}
                    className="px-2 py-1.5 text-sm rounded-r-lg border-y border-r border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete timetable"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
              {(!canManage || activeTimetable?._id !== t._id) && (
                <div className="w-px h-7 border-r border-slate-200" />
              )}
            </div>
          ))}
        </div>
      )}

      {timetables.length === 0 ? (
        <div className="card p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
            <Plus size={28} className="text-primary-400" />
          </div>
          <h3 className="font-semibold text-slate-700 text-lg">No timetable yet</h3>
          <p className="text-sm text-slate-400 mt-1 mb-5">
            {canManage ? 'Create your first timetable to get started.' : 'Your class rep or level adviser will add the timetable soon.'}
          </p>
          {canManage && (
            <button onClick={() => setShowAddTimetable(true)} className="btn-primary">
              <Plus size={15} /> Create Timetable
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Day tabs */}
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {DAYS.map(day => {
              const count = (activeTimetable?.slots || []).filter(s => s.day === day).length;
              const isToday = day === ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
              return (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className={`flex-1 min-w-[80px] px-4 py-3.5 text-sm font-medium transition-colors border-b-2 relative ${
                    activeDay === day
                      ? 'border-primary-600 text-primary-700 bg-primary-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.slice(0, 3)}</span>
                  {isToday && <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary-500 rounded-full" />}
                  {count > 0 && (
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      activeDay === day ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Slots */}
          <div className="p-5">
            {daySlots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-slate-400">No classes on {activeDay}</p>
                {canManage && (
                  <button onClick={() => { setSlotForm({ ...emptySlot, day: activeDay }); setShowAddSlot(true); }} className="mt-3 btn-ghost text-primary-600">
                    <Plus size={14} /> Add class
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {daySlots.map(slot => (
                  <div key={slot._id} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-card transition-all group">
                    {/* Time */}
                    <div className="text-right w-20 flex-shrink-0 pt-0.5">
                      <p className="text-sm font-semibold text-slate-800">{slot.startTime}</p>
                      <p className="text-xs text-slate-400">{slot.endTime}</p>
                    </div>
                    {/* Color bar */}
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: slot.color || typeColors[slot.type] || '#2563eb' }} />
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800">{slot.courseTitle}</p>
                          <p className="text-sm text-slate-500 font-mono">{slot.courseCode}</p>
                        </div>
                        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full capitalize mt-0.5`}
                          style={{ backgroundColor: (slot.color || typeColors[slot.type] || '#2563eb') + '18', color: slot.color || typeColors[slot.type] || '#2563eb' }}>
                          {slot.type}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin size={11} /> {slot.venue}
                        </span>
                        <span className="text-xs text-slate-400">👤 {slot.lecturer}</span>
                        {slot.venueHistory.length > 0 && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">venue changed</span>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setNotifySlot(slot); setNotifyMessage(''); }}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-transparent hover:border-amber-100 transition-colors"
                          title="Notify students"
                        >
                          <Bell size={13} />
                        </button>
                        <button
                          onClick={() => setShowVenueModal({ timetableId: activeTimetable!._id, slot })}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:bg-primary-50 px-2.5 py-1.5 rounded-lg border border-primary-100 transition-colors"
                          title="Change venue"
                        >
                          <MapPin size={12} /> Venue
                        </button>
                        <button
                          onClick={() => {
                            setEditingSlot(slot);
                            setSlotForm({
                              courseCode: slot.courseCode,
                              courseTitle: slot.courseTitle,
                              lecturer: slot.lecturer,
                              venue: slot.venue,
                              day: slot.day,
                              startTime: slot.startTime,
                              endTime: slot.endTime,
                              type: slot.type,
                              color: slot.color || typeColors[slot.type] || '#2563eb',
                            });
                          }}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg border border-transparent hover:border-primary-100 transition-colors"
                          title="Edit class"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove "${slot.courseTitle}" from timetable?`)) {
                              deleteSlot.mutate(slot._id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors"
                          title="Delete class"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Timetable Modal */}
      {showAddTimetable && (
        <Modal title="Create New Timetable" onClose={() => setShowAddTimetable(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input className="input" placeholder="e.g. EDT 400 Level – Second Semester 2024/2025"
                value={timetableForm.title} onChange={e => setTimetableForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Semester</label>
                <select className="input" value={timetableForm.semester} onChange={e => setTimetableForm(f => ({ ...f, semester: e.target.value }))}>
                  <option value="First">First Semester</option>
                  <option value="Second">Second Semester</option>
                </select>
              </div>
              <div>
                <label className="label">Academic Year</label>
                <input className="input" placeholder="2024/2025" value={timetableForm.academicYear}
                  onChange={e => setTimetableForm(f => ({ ...f, academicYear: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowAddTimetable(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={() => createTimetable.mutate(timetableForm)} disabled={createTimetable.isPending}>
                {createTimetable.isPending ? <Loader2 size={14} className="animate-spin" /> : null} Create
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Slot Modal */}
      {showAddSlot && (
        <Modal title="Add Class to Timetable" onClose={() => setShowAddSlot(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Course Code</label>
                <input className="input uppercase" placeholder="EDT 401" value={slotForm.courseCode}
                  onChange={e => setSlotForm(f => ({ ...f, courseCode: e.target.value }))} />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={slotForm.type}
                  onChange={e => setSlotForm(f => ({ ...f, type: e.target.value, color: typeColors[e.target.value] || '#2563eb' }))}>
                  {['lecture','lab','test','exam','seminar','other'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Course Title</label>
              <input className="input" placeholder="Instructional Technology" value={slotForm.courseTitle}
                onChange={e => setSlotForm(f => ({ ...f, courseTitle: e.target.value }))} />
            </div>
            <div>
              <label className="label">Lecturer</label>
              <input className="input" placeholder="Dr. Surname" value={slotForm.lecturer}
                onChange={e => setSlotForm(f => ({ ...f, lecturer: e.target.value }))} />
            </div>
            <div>
              <label className="label">Venue</label>
              <input className="input" placeholder="LT2, Faculty of Education" value={slotForm.venue}
                onChange={e => setSlotForm(f => ({ ...f, venue: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Day</label>
                <select className="input" value={slotForm.day} onChange={e => setSlotForm(f => ({ ...f, day: e.target.value as DayOfWeek }))}>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Start Time</label>
                <select className="input" value={slotForm.startTime} onChange={e => setSlotForm(f => ({ ...f, startTime: e.target.value }))}>
                  {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">End Time</label>
                <select className="input" value={slotForm.endTime} onChange={e => setSlotForm(f => ({ ...f, endTime: e.target.value }))}>
                  {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Colour tag</label>
              <div className="flex gap-2">
                {SLOT_COLORS.map(c => (
                  <button key={c} onClick={() => setSlotForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full transition-transform ${slotForm.color === c ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowAddSlot(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={() => addSlot.mutate(slotForm)} disabled={addSlot.isPending}>
                {addSlot.isPending ? <Loader2 size={14} className="animate-spin" /> : null} Add Class
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Slot Modal */}
      {editingSlot && (
        <Modal title="Edit Class" onClose={() => { setEditingSlot(null); setSlotForm(emptySlot); }}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Course Code</label>
                <input className="input uppercase" placeholder="EDT 401" value={slotForm.courseCode}
                  onChange={e => setSlotForm(f => ({ ...f, courseCode: e.target.value }))} />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={slotForm.type}
                  onChange={e => setSlotForm(f => ({ ...f, type: e.target.value, color: typeColors[e.target.value] || '#2563eb' }))}>
                  {['lecture','lab','test','exam','seminar','other'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Course Title</label>
              <input className="input" value={slotForm.courseTitle}
                onChange={e => setSlotForm(f => ({ ...f, courseTitle: e.target.value }))} />
            </div>
            <div>
              <label className="label">Lecturer</label>
              <input className="input" value={slotForm.lecturer}
                onChange={e => setSlotForm(f => ({ ...f, lecturer: e.target.value }))} />
            </div>
            <div>
              <label className="label">Venue</label>
              <input className="input" value={slotForm.venue}
                onChange={e => setSlotForm(f => ({ ...f, venue: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Day</label>
                <select className="input" value={slotForm.day} onChange={e => setSlotForm(f => ({ ...f, day: e.target.value as DayOfWeek }))}>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Start Time</label>
                <select className="input" value={slotForm.startTime} onChange={e => setSlotForm(f => ({ ...f, startTime: e.target.value }))}>
                  {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">End Time</label>
                <select className="input" value={slotForm.endTime} onChange={e => setSlotForm(f => ({ ...f, endTime: e.target.value }))}>
                  {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Colour tag</label>
              <div className="flex gap-2">
                {SLOT_COLORS.map(c => (
                  <button key={c} onClick={() => setSlotForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full transition-transform ${slotForm.color === c ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button className="btn-secondary flex-1" onClick={() => { setEditingSlot(null); setSlotForm(emptySlot); }}>Cancel</button>
              <button className="btn-primary flex-1" onClick={() => editSlot.mutate(slotForm)} disabled={editSlot.isPending}>
                {editSlot.isPending ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Timetable Modal */}
      {showEditTimetable && (
        <Modal title="Edit Timetable" onClose={() => setShowEditTimetable(false)}>
          <div className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input className="input" placeholder="e.g. EDT 400 Level – Second Semester 2024/2025"
                value={editTimetableForm.title}
                onChange={e => setEditTimetableForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Semester</label>
                <select className="input" value={editTimetableForm.semester}
                  onChange={e => setEditTimetableForm(f => ({ ...f, semester: e.target.value }))}>
                  <option value="First">First Semester</option>
                  <option value="Second">Second Semester</option>
                </select>
              </div>
              <div>
                <label className="label">Academic Year</label>
                <input className="input" placeholder="2024/2025" value={editTimetableForm.academicYear}
                  onChange={e => setEditTimetableForm(f => ({ ...f, academicYear: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowEditTimetable(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={() => updateTimetableMeta.mutate(editTimetableForm)}
                disabled={updateTimetableMeta.isPending}>
                {updateTimetableMeta.isPending ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Notify Students Modal */}
      {notifySlot && (
        <Modal title="Notify Students" onClose={() => { setNotifySlot(null); setNotifyMessage(''); }}>
          <div className="space-y-4">
            {/* Slot summary */}
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: (notifySlot.color || typeColors[notifySlot.type] || '#2563eb') + '20' }}>
                <Bell size={15} style={{ color: notifySlot.color || typeColors[notifySlot.type] || '#2563eb' }} />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{notifySlot.courseTitle}</p>
                <p className="text-xs text-slate-500 font-mono">{notifySlot.courseCode}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {notifySlot.day} · {notifySlot.startTime}–{notifySlot.endTime} · {notifySlot.venue}
                </p>
              </div>
            </div>

            {/* Smart default message hint */}
            <div className="text-xs text-slate-500 bg-primary-50 text-primary-700 px-3 py-2 rounded-lg">
              💡 Leave the message blank to send the default reminder text, or write a custom message below.
            </div>

            <div>
              <label className="label">Custom message <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder={`e.g. Don't forget to bring your assignment for ${notifySlot.courseCode} on ${notifySlot.day}…`}
                value={notifyMessage}
                onChange={e => setNotifyMessage(e.target.value)}
              />
            </div>

            <p className="text-xs text-slate-400">
              This will send an email to all active students in your level and course of study.
            </p>

            <div className="flex gap-2 pt-1">
              <button className="btn-secondary flex-1" onClick={() => { setNotifySlot(null); setNotifyMessage(''); }}>
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() => sendSlotNotification.mutate(notifySlot)}
                disabled={sendSlotNotification.isPending}
              >
                {sendSlotNotification.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
                  : <><Bell size={14} /> Send Notification</>
                }
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showVenueModal && (
        <Modal title="Update Class Venue" onClose={() => setShowVenueModal(null)}>
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
              <p className="font-medium text-slate-800">{showVenueModal.slot.courseCode} – {showVenueModal.slot.courseTitle}</p>
              <p className="text-xs text-slate-500 mt-0.5">{showVenueModal.slot.day} · {showVenueModal.slot.startTime}–{showVenueModal.slot.endTime}</p>
              <p className="text-xs mt-1">Current venue: <span className="font-medium">{showVenueModal.slot.venue}</span></p>
            </div>
            <div>
              <label className="label">New Venue</label>
              <input className="input" placeholder="e.g. Room 204, Education Block" value={venueForm.newVenue}
                onChange={e => setVenueForm(f => ({ ...f, newVenue: e.target.value }))} />
            </div>
            <div>
              <label className="label">Reason (optional)</label>
              <input className="input" placeholder="e.g. Renovation in original hall" value={venueForm.reason}
                onChange={e => setVenueForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            <p className="text-xs text-slate-500 bg-primary-50 text-primary-700 px-3 py-2 rounded-lg">
              📧 All students will be notified by email immediately.
            </p>
            <div className="flex gap-2 pt-1">
              <button className="btn-secondary flex-1" onClick={() => setShowVenueModal(null)}>Cancel</button>
              <button className="btn-primary flex-1" disabled={!venueForm.newVenue || updateVenue.isPending}
                onClick={() => updateVenue.mutate({ timetableId: showVenueModal.timetableId, slotId: showVenueModal.slot._id, newVenue: venueForm.newVenue, reason: venueForm.reason })}>
                {updateVenue.isPending ? <Loader2 size={14} className="animate-spin" /> : null} Update & Notify
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-modal p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}