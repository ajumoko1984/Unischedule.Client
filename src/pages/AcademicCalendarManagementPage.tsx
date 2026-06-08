import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { academicCalendarService } from '../utils/academicCalendarService';
import { AcademicCalendarEvent, Semester } from '../types';
import { format, parseISO } from 'date-fns';
import { Plus, Edit2, Trash2, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const EVENT_TYPES = [
  { value: 'semester_start', label: 'Semester Start' },
  { value: 'semester_end', label: 'Semester End' },
  { value: 'exam_period_start', label: 'Exam Period Start' },
  { value: 'exam_period_end', label: 'Exam Period End' },
  { value: 'public_holiday', label: 'Public Holiday' },
  { value: 'registration_period', label: 'Registration Period' },
  { value: 'break', label: 'Break' },
  { value: 'other', label: 'Other Event' },
];

const SEMESTERS: Semester[] = ['First', 'Second'];
const ACADEMIC_YEARS = ['2025/2026', '2026/2027', '2027/2028'];

interface FormData {
  title: string;
  description: string;
  type: string;
  startDate: string;
  endDate: string;
  semester: string;
  academicYear: string;
  color: string;
}

const emptyForm: FormData = {
  title: '',
  description: '',
  type: 'other',
  startDate: '',
  endDate: '',
  semester: 'First',
  academicYear: '2025/2026',
  color: '#3b82f6',
};

export default function AcademicCalendarManagementPage() {
  const qc = useQueryClient();
  const [selectedYear, setSelectedYear] = useState('2025/2026');
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AcademicCalendarEvent | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ['academic-calendar-admin', selectedYear],
    queryFn: () => academicCalendarService.getAllEvents(selectedYear),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<AcademicCalendarEvent>) => academicCalendarService.createEvent(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic-calendar-admin', selectedYear] });
      toast.success('Event created!');
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create event');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AcademicCalendarEvent>) =>
      academicCalendarService.updateEvent(editingEvent!._id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic-calendar-admin', selectedYear] });
      toast.success('Event updated!');
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update event');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => academicCalendarService.deleteEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic-calendar-admin', selectedYear] });
      toast.success('Event deleted!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete event');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => academicCalendarService.publishEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic-calendar-admin', selectedYear] });
      qc.invalidateQueries({ queryKey: ['academic-calendar'] });
      toast.success('Event published!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to publish event');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => academicCalendarService.unpublishEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic-calendar-admin', selectedYear] });
      qc.invalidateQueries({ queryKey: ['academic-calendar'] });
      toast.success('Event unpublished!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to unpublish event');
    },
  });

  const handleSave = async () => {
    if (!form.title || !form.startDate || !form.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(form.startDate) > new Date(form.endDate)) {
      toast.error('Start date must be before end date');
      return;
    }

    const eventData: Partial<AcademicCalendarEvent> = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type as any,
      startDate: form.startDate,
      endDate: form.endDate,
      semester: form.semester as Semester,
      academicYear: form.academicYear,
      color: form.color,
    };

    if (editingEvent) {
      await updateMutation.mutateAsync(eventData);
    } else {
      await createMutation.mutateAsync(eventData);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingEvent(null);
    setShowForm(false);
  };

  const handleEdit = (event: AcademicCalendarEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description || '',
      type: event.type,
      startDate: event.startDate,
      endDate: event.endDate,
      semester: event.semester || 'First',
      academicYear: event.academicYear,
      color: event.color || '#3b82f6',
    });
    setShowForm(true);
  };

  const publishedEvents = events.filter(e => e.isPublished);
  const draftEvents = events.filter(e => !e.isPublished);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Academic Calendar Management</h1>
          <p className="text-slate-600 mt-1">Manage university-wide academic dates and deadlines</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary gap-2"
        >
          <Plus size={18} /> New Event
        </button>
      </div>

      {/* Year Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <label className="text-sm font-medium text-slate-700 block mb-2">Academic Year</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="input w-full md:w-48"
        >
          {ACADEMIC_YEARS.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <p>Failed to load academic calendar events.</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <Loader2 size={24} className="animate-spin mx-auto text-slate-400 mb-2" />
          <p className="text-slate-700">Loading events...</p>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Create/Edit Form */}
          {showForm && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label text-sm font-medium">Title *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., Semester 1 Begins"
                      value={form.title}
                      onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label text-sm font-medium">Event Type *</label>
                    <select
                      className="input"
                      value={form.type}
                      onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                    >
                      {EVENT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label text-sm font-medium">Description</label>
                  <textarea
                    className="input"
                    placeholder="Add details about this event..."
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label text-sm font-medium">Start Date *</label>
                    <input
                      type="date"
                      className="input"
                      value={form.startDate}
                      onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label text-sm font-medium">End Date *</label>
                    <input
                      type="date"
                      className="input"
                      value={form.endDate}
                      onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label text-sm font-medium">Academic Year *</label>
                    <select
                      className="input"
                      value={form.academicYear}
                      onChange={(e) => setForm(f => ({ ...f, academicYear: e.target.value }))}
                    >
                      {ACADEMIC_YEARS.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label text-sm font-medium">Semester</label>
                    <select
                      className="input"
                      value={form.semester}
                      onChange={(e) => setForm(f => ({ ...f, semester: e.target.value }))}
                    >
                      {SEMESTERS.map(sem => (
                        <option key={sem} value={sem}>{sem} Semester</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label text-sm font-medium">Color</label>
                    <input
                      type="color"
                      className="input h-10 cursor-pointer"
                      value={form.color}
                      onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="btn-primary flex-1 gap-2"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
                    {editingEvent ? 'Update Event' : 'Create Event'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Draft Events */}
          {draftEvents.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-800">Draft Events</h2>
              <div className="space-y-3">
                {draftEvents.map(event => (
                  <div key={event._id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-slate-800">{event.title}</h3>
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                            Draft
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{event.description}</p>
                        <div className="flex gap-4 text-sm text-slate-600">
                          <span>{format(parseISO(event.startDate), 'MMM d, yyyy')} - {format(parseISO(event.endDate), 'MMM d, yyyy')}</span>
                          {event.semester && <span>{event.semester} Semester</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(event)}
                          className="p-2 text-sm bg-primary-100 text-primary-600 rounded-lg hover:bg-primary-200"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => publishMutation.mutate(event._id)}
                          disabled={publishMutation.isPending}
                          className="p-2 text-sm bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                          title="Publish"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(event._id)}
                          disabled={deleteMutation.isPending}
                          className="p-2 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Published Events */}
          {publishedEvents.length > 0 && (
            <div className="bg-white rounded-xl border border-green-200 p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-800">Published Events</h2>
              <div className="space-y-3">
                {publishedEvents.map(event => (
                  <div key={event._id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-slate-800">{event.title}</h3>
                          <span className="px-2 py-1 bg-green-200 text-green-700 text-xs font-medium rounded">
                            Published
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{event.description}</p>
                        <div className="flex gap-4 text-sm text-slate-600">
                          <span>{format(parseISO(event.startDate), 'MMM d, yyyy')} - {format(parseISO(event.endDate), 'MMM d, yyyy')}</span>
                          {event.semester && <span>{event.semester} Semester</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(event)}
                          className="p-2 text-sm bg-primary-100 text-primary-600 rounded-lg hover:bg-primary-200"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => unpublishMutation.mutate(event._id)}
                          disabled={unpublishMutation.isPending}
                          className="p-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                          title="Unpublish"
                        >
                          <EyeOff size={16} />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(event._id)}
                          disabled={deleteMutation.isPending}
                          className="p-2 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {events.length === 0 && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
              <AlertCircle size={40} className="mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-1">No events yet</h3>
              <p className="text-slate-600 mb-6">Create your first academic calendar event</p>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="btn-primary gap-2 mx-auto"
              >
                <Plus size={18} /> Create Event
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
