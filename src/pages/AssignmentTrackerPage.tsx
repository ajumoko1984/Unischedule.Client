import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, CheckSquare, Square, Loader2, X,
  Trash2, Clock, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { format, parseISO, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { Assignment, AssignmentPriority, AssignmentStatus } from '../types';

const PRIORITY_CONFIG: Record<AssignmentPriority, { label: string; color: string; bg: string; border: string }> = {
  high:   { label: 'High',   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-100' },
  medium: { label: 'Medium', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-100' },
  low:    { label: 'Low',    color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-100' },
};

const STATUS_TABS: { value: 'all' | AssignmentStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
];

const emptyForm = {
  courseCode: '', courseTitle: '', title: '',
  description: '', deadline: '', priority: 'medium' as AssignmentPriority,
};

export default function AssignmentTrackerPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | AssignmentStatus>('all');
  const [form, setForm] = useState({ ...emptyForm });

  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['assignments'],
    queryFn: () => api.get('/assignments').then(r => r.data.data),
  });

  const createAssignment = useMutation({
    mutationFn: () => api.post('/assignments', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['weekly-summary'] });
      setShowModal(false);
      setForm({ ...emptyForm });
      toast.success('Assignment added!');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const toggleComplete = useMutation({
    mutationFn: (id: string) => api.patch(`/assignments/${id}/toggle`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['weekly-summary'] });
      toast.success(res.data.message || 'Updated!');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AssignmentStatus }) =>
      api.put(`/assignments/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Status updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteAssignment = useMutation({
    mutationFn: (id: string) => api.delete(`/assignments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['weekly-summary'] });
      toast.success('Assignment removed');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const filtered = filter === 'all' ? assignments : assignments.filter(a => a.status === filter);
  const sorted = [...filtered].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  const stats = {
    total: assignments.length,
    completed: assignments.filter(a => a.status === 'completed').length,
    pending: assignments.filter(a => ['pending', 'in_progress'].includes(a.status)).length,
    overdue: assignments.filter(a => a.status === 'overdue').length,
  };

  const getDeadlineLabel = (deadline: string) => {
    const d = parseISO(deadline);
    if (isPast(d)) return { text: 'Overdue', urgent: true };
    if (isToday(d)) return { text: 'Due today!', urgent: true };
    if (isTomorrow(d)) return { text: 'Due tomorrow', urgent: true };
    const days = differenceInDays(d, new Date());
    if (days <= 3) return { text: `Due in ${days} days`, urgent: true };
    return { text: format(d, 'EEE, MMM d'), urgent: false };
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Assignment Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">Never miss a deadline — track every assignment</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex-shrink-0">
          <Plus size={15} /> Add Assignment
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-800' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-600' },
          { label: 'Pending', value: stats.pending, color: 'text-primary-600' },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Overdue alert */}
      {stats.overdue > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            You have {stats.overdue} overdue assignment{stats.overdue > 1 ? 's' : ''}. Address them as soon as possible!
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              filter === tab.value ? 'bg-primary-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Assignment list */}
      {sorted.length === 0 ? (
        <div className="card p-14 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
            <CheckSquare size={24} className="text-primary-400" />
          </div>
          <h3 className="font-semibold text-slate-700">No assignments here</h3>
          <p className="text-sm text-slate-400 mt-1">Add your assignments and stay ahead of deadlines.</p>
          <button onClick={() => setShowModal(true)} className="mt-4 btn-primary"><Plus size={14} /> Add Assignment</button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(a => {
            const pCfg = PRIORITY_CONFIG[a.priority];
            const { text: deadlineText, urgent } = getDeadlineLabel(a.deadline);
            const isDone = a.status === 'completed';

            return (
              <div key={a._id} className={`card p-4 flex items-start gap-3 transition-all ${isDone ? 'opacity-60' : ''}`}>
                {/* Checkbox */}
                <button
                  onClick={() => toggleComplete.mutate(a._id)}
                  className={`mt-0.5 flex-shrink-0 transition-colors ${isDone ? 'text-emerald-500' : 'text-slate-300 hover:text-primary-500'}`}
                >
                  {isDone ? <CheckCircle2 size={20} /> : <Square size={20} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className={`font-medium text-slate-800 flex-1 ${isDone ? 'line-through text-slate-400' : ''}`}>
                      {a.title}
                    </p>
                    <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border capitalize ${pCfg.bg} ${pCfg.color} ${pCfg.border}`}>
                      {pCfg.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 font-mono mt-0.5">{a.courseCode} – {a.courseTitle}</p>
                  {a.description && <p className="text-xs text-slate-400 mt-1">{a.description}</p>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                    <span className={`text-xs flex items-center gap-1 ${urgent && !isDone ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                      <Clock size={11} /> {deadlineText}
                    </span>
                    {!isDone && (
                      <select
                        value={a.status}
                        onChange={e => updateStatus.mutate({ id: a._id, status: e.target.value as AssignmentStatus })}
                        className="text-xs text-slate-500 bg-transparent border-none outline-none cursor-pointer hover:text-primary-600"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    )}
                    {isDone && a.completedAt && (
                      <span className="text-xs text-emerald-600">✓ Done {format(parseISO(a.completedAt), 'MMM d')}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => { if (confirm('Remove this assignment?')) deleteAssignment.mutate(a._id); }}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-modal p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <CheckSquare size={18} className="text-primary-600" /> Add Assignment
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Assignment title</label>
                <input className="input" placeholder="e.g. Research paper on media literacy" value={form.title} onChange={set('title')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Course code</label>
                  <input className="input uppercase" placeholder="EDT 411" value={form.courseCode} onChange={set('courseCode')} />
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" value={form.priority} onChange={set('priority')}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Course title</label>
                <input className="input" placeholder="Curriculum Studies" value={form.courseTitle} onChange={set('courseTitle')} />
              </div>
              <div>
                <label className="label">Deadline</label>
                <input type="datetime-local" className="input" value={form.deadline} onChange={set('deadline')} />
              </div>
              <div>
                <label className="label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea className="input resize-none" rows={2} placeholder="Additional details..." value={form.description} onChange={set('description')} />
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                ⏰ You'll receive an email reminder the day before the deadline.
              </p>
              <div className="flex gap-2 pt-1">
                <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary flex-1" onClick={() => createAssignment.mutate()}
                  disabled={createAssignment.isPending || !form.title || !form.courseCode || !form.deadline}>
                  {createAssignment.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}