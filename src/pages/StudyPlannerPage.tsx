import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, BookOpen, Clock, CheckCircle2, Circle,
  Loader2, X, Trash2, ChevronRight, AlertCircle,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { StudyPlan, StudyTask, StudyTaskStatus, WeeklySummary } from '../types';

const STATUS_CONFIG: Record<StudyTaskStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:     { label: 'Pending',     color: 'text-slate-600',   bg: 'bg-slate-100',    icon: <Circle size={14} /> },
  in_progress: { label: 'In progress', color: 'text-blue-600',    bg: 'bg-blue-50',      icon: <Clock size={14} /> },
  completed:   { label: 'Done',        color: 'text-emerald-600', bg: 'bg-emerald-50',   icon: <CheckCircle2 size={14} /> },
  missed:      { label: 'Missed',      color: 'text-red-500',     bg: 'bg-red-50',       icon: <AlertCircle size={14} /> },
};

const DURATIONS = [30, 45, 60, 90, 120];

const emptyForm = {
  courseCode: '', courseTitle: '', task: '',
  scheduledAt: '', durationMinutes: 60, notes: '',
};

export default function StudyPlannerPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | StudyTaskStatus>('all');
  const [form, setForm] = useState({ ...emptyForm });
  const [showSummary, setShowSummary] = useState(false);

  const { data: plan, isLoading } = useQuery<StudyPlan>({
    queryKey: ['study-plan'],
    queryFn: () => api.get('/study-plan').then(r => r.data.data),
  });

  const { data: summary } = useQuery<WeeklySummary>({
    queryKey: ['weekly-summary'],
    queryFn: () => api.get('/study-plan/weekly-summary').then(r => r.data.data),
    enabled: showSummary,
  });

  const addTask = useMutation({
    mutationFn: () => api.post('/study-plan/tasks', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-plan'] });
      qc.invalidateQueries({ queryKey: ['weekly-summary'] });
      setShowModal(false);
      setForm({ ...emptyForm });
      toast.success('Study session added!');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: StudyTaskStatus }) =>
      api.patch(`/study-plan/tasks/${taskId}/status`, { status }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['study-plan'] });
      qc.invalidateQueries({ queryKey: ['weekly-summary'] });
      toast.success(res.data.message || 'Updated!');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => api.delete(`/study-plan/tasks/${taskId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-plan'] });
      qc.invalidateQueries({ queryKey: ['weekly-summary'] });
      toast.success('Task removed');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const tasks = plan?.tasks || [];
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  const sorted = [...filtered].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    missed: tasks.filter(t => t.status === 'missed').length,
  };

  // Course progress (all time)
  const courseMap: Record<string, { total: number; done: number; title: string }> = {};
  tasks.forEach(t => {
    if (!courseMap[t.courseCode]) courseMap[t.courseCode] = { total: 0, done: 0, title: t.courseTitle };
    courseMap[t.courseCode].total++;
    if (t.status === 'completed') courseMap[t.courseCode].done++;
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Study Planner</h1>
          <p className="text-sm text-slate-500 mt-1">Plan your study sessions and track your progress</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowSummary(v => !v)} className="btn-secondary">
            📊 {showSummary ? 'Hide' : 'Weekly'} Summary
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={15} /> Add Session
          </button>
        </div>
      </div>

      {/* Weekly Summary Panel */}
      {showSummary && summary && (
        <div className="card p-5 border-primary-100 bg-primary-50/30 animate-slide-up">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-800">This Week's Summary</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {format(parseISO(summary.weekStart), 'MMM d')} – {format(parseISO(summary.weekEnd), 'MMM d, yyyy')}
              </p>
            </div>
          </div>

          {/* Message */}
          <div className="bg-white border border-primary-100 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-slate-700 font-medium">{summary.message}</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-slate-100 p-3">
              <p className="text-xs text-slate-500 mb-1">Study sessions</p>
              <p className="text-xl font-semibold text-slate-800">{summary.study.completed}<span className="text-sm font-normal text-slate-400">/{summary.study.total}</span></p>
              {summary.study.missed > 0 && <p className="text-xs text-red-500 mt-0.5">{summary.study.missed} missed</p>}
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-3">
              <p className="text-xs text-slate-500 mb-1">Assignments</p>
              <p className="text-xl font-semibold text-slate-800">{summary.assignments.completed}<span className="text-sm font-normal text-slate-400">/{summary.assignments.total}</span></p>
              {summary.assignments.overdue > 0 && <p className="text-xs text-red-500 mt-0.5">{summary.assignments.overdue} overdue</p>}
            </div>
          </div>

          {/* Course progress */}
          {summary.courseProgress.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Course progress (all time)</p>
              {summary.courseProgress.map(cp => (
                <div key={cp.courseCode}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">{cp.courseCode}</span>
                    <span className="text-xs text-slate-500">{cp.completed}/{cp.total} tasks · {cp.percent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${cp.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total sessions', value: stats.total, color: 'text-slate-800' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-600' },
          { label: 'Pending', value: stats.pending, color: 'text-primary-600' },
          { label: 'Missed', value: stats.missed, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Course progress bars (all time) */}
      {Object.keys(courseMap).length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BookOpen size={16} className="text-primary-500" /> Course Progress
          </h2>
          <div className="space-y-3">
            {Object.entries(courseMap).map(([code, v]) => {
              const pct = v.total > 0 ? Math.round((v.done / v.total) * 100) : 0;
              return (
                <div key={code}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-semibold text-slate-700">{code}</span>
                      <span className="text-xs text-slate-400 ml-2">{v.title}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-600">{v.done}/{v.total} · {pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#10b981' : '#2563eb' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {(['all', 'pending', 'in_progress', 'completed', 'missed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium capitalize transition-colors ${
              filter === f ? 'bg-primary-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}>
            {f === 'all' ? 'All sessions' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Task list */}
      {sorted.length === 0 ? (
        <div className="card p-14 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
            <BookOpen size={24} className="text-primary-400" />
          </div>
          <h3 className="font-semibold text-slate-700">No study sessions yet</h3>
          <p className="text-sm text-slate-400 mt-1">Add your first study session to get started.</p>
          <button onClick={() => setShowModal(true)} className="mt-4 btn-primary"><Plus size={14} /> Add Session</button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(task => {
            const d = parseISO(task.scheduledAt);
            const cfg = STATUS_CONFIG[task.status];
            const dateLabel = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE, MMM d');
            const isUrgent = (isToday(d) || isTomorrow(d)) && task.status === 'pending';

            return (
              <div key={task._id} className={`card p-4 flex items-start gap-4 transition-all ${task.status === 'completed' ? 'opacity-60' : ''}`}>
                {/* Status toggle button */}
                <button
                  onClick={() => updateStatus.mutate({
                    taskId: task._id,
                    status: task.status === 'completed' ? 'pending' : task.status === 'pending' ? 'in_progress' : 'completed',
                  })}
                  className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${cfg.bg} ${cfg.color} hover:scale-110`}
                  title="Click to update status"
                >
                  {cfg.icon}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className={`font-medium text-slate-800 flex-1 ${task.status === 'completed' ? 'line-through text-slate-400' : ''}`}>
                      {task.task}
                    </p>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 font-mono mt-0.5">{task.courseCode} – {task.courseTitle}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                    <span className={`text-xs flex items-center gap-1 ${isUrgent ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                      <Clock size={11} /> {dateLabel} · {format(d, 'h:mm a')}
                    </span>
                    <span className="text-xs text-slate-400">{task.durationMinutes} min</span>
                    {task.notes && <span className="text-xs text-slate-400 italic truncate max-w-[200px]">{task.notes}</span>}
                  </div>
                </div>

                <button
                  onClick={() => { if (confirm('Remove this session?')) deleteTask.mutate(task._id); }}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Session Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-modal p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <BookOpen size={18} className="text-primary-600" /> Add Study Session
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Course code</label>
                  <input className="input uppercase" placeholder="EDT 411" value={form.courseCode} onChange={set('courseCode')} />
                </div>
                <div>
                  <label className="label">Course title</label>
                  <input className="input" placeholder="Curriculum Studies" value={form.courseTitle} onChange={set('courseTitle')} />
                </div>
              </div>
              <div>
                <label className="label">What will you study?</label>
                <input className="input" placeholder="e.g. Read Chapter 1, Solve past questions" value={form.task} onChange={set('task')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date & time</label>
                  <input type="datetime-local" className="input" value={form.scheduledAt} onChange={set('scheduledAt')} />
                </div>
                <div>
                  <label className="label">Duration</label>
                  <select className="input" value={form.durationMinutes} onChange={set('durationMinutes')}>
                    {DURATIONS.map(d => <option key={d} value={d}>{d} minutes</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea className="input resize-none" rows={2} placeholder="e.g. Focus on definitions and past questions" value={form.notes} onChange={set('notes')} />
              </div>
              <p className="text-xs text-primary-700 bg-primary-50 px-3 py-2 rounded-lg">
                🔔 You'll get an email reminder 1 hour before this session automatically.
              </p>
              <div className="flex gap-2 pt-1">
                <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary flex-1" onClick={() => addTask.mutate()} disabled={addTask.isPending || !form.courseCode || !form.task || !form.scheduledAt}>
                  {addTask.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}