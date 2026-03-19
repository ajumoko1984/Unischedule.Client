import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Loader2, X, UserCheck, UserX,
  Trash2, Shield, UserCog, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { User, UserRole } from '../types';

const roleStyle: Record<UserRole, { bg: string; text: string; label: string }> = {
  super_admin:   { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Super Admin' },
  level_adviser: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Level Adviser' },
  class_rep:     { bg: 'bg-primary-50', text: 'text-primary-700', label: 'Class Rep' },
  student:       { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Student' },
};

const ROLES: UserRole[] = ['super_admin', 'level_adviser', 'class_rep', 'student'];
const LEVELS = ['100', '200', '300', '400', '500'];
const DEPTS = [
  'Educational Technology', 'Science Education', 'Arts Education',
  'Social Science Education', 'Counsellor Education',
];

const emptyForm = {
  fullName: '', email: '', password: '', role: 'student' as UserRole,
  department: '', level: '', courseOfStudy: '', matricNumber: '',
};

export default function UsersPage() {
  const { user: authUser, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  // Assign rep form state
  const [assignLevel, setAssignLevel] = useState(authUser?.level || '');
  const [assignCourse, setAssignCourse] = useState(authUser?.courseOfStudy || '');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Fetch all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data.data),
  });

  // Fetch students for the assign-rep dropdown
  const { data: levelData, isFetching: loadingStudents } = useQuery<{
    students: User[];
    currentRep: User | null;
  }>({
    queryKey: ['students-for-level', assignLevel, assignCourse],
    queryFn: () =>
      api.get('/users/students-for-level', {
        params: { level: assignLevel, courseOfStudy: assignCourse },
      }).then(r => r.data.data),
    enabled: !!assignLevel && !!assignCourse && showAssignModal,
  });

  const createUser = useMutation({
    mutationFn: (data: object) => api.post('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowCreateModal(false);
      setForm({ ...emptyForm });
      toast.success('User created!');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create user'),
  });

  const toggleStatus = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/toggle`),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(res.data.message); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const assignRep = useMutation({
    mutationFn: (studentId: string) => api.post('/users/assign-rep', { studentId }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['students-for-level'] });
      setShowAssignModal(false);
      setSelectedStudentId('');
      toast.success(res.data.message);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to assign'),
  });

  const revokeRep = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/revoke-rep`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(res.data.message);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const filtered = users.filter(u => {
    const matchSearch =
      search === '' ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

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
          <h1 className="page-title">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">{users.length} total users</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {/* Assign Class Rep — super admin + level adviser */}
          <button onClick={() => {
            setAssignLevel(authUser?.level || '');
            setAssignCourse(authUser?.courseOfStudy || '');
            setShowAssignModal(true);
          }} className="btn-secondary">
            <UserCog size={15} /> Assign Class Rep
          </button>
          {/* Create user — super admin only */}
          {isAdmin && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus size={15} /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Role stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {ROLES.map(r => {
          const count = users.filter(u => u.role === r).length;
          const s = roleStyle[r];
          return (
            <button key={r} onClick={() => setRoleFilter(roleFilter === r ? 'all' : r)}
              className={`card p-3 text-center transition-all hover:shadow-elevated ${roleFilter === r ? 'ring-2 ring-primary-400' : ''}`}>
              <p className={`text-2xl font-semibold ${s.text}`}>{count}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search + role filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-44" value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}>
          <option value="all">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{roleStyle[r].label}</option>)}
        </select>
      </div>

      {/* Users table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3.5">User</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3.5">Role</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3.5">Level / Course</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3.5">Status</th>
                {isAdmin && (
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3.5">Joined</th>
                )}
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">No users found</td>
                </tr>
              ) : filtered.map(u => {
                const s = roleStyle[u.role];
                return (
                  <tr key={u._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-semibold flex-shrink-0">
                          {u.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{u.fullName}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-slate-700">{u.level} Level</p>
                      <p className="text-xs text-slate-400 truncate max-w-[160px]">{u.courseOfStudy}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        u.isActive !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {u.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5 text-xs text-slate-400">
                        {u.createdAt ? format(parseISO(u.createdAt), 'MMM d, yyyy') : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Revoke class rep button */}
                        {u.role === 'class_rep' && (
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${u.fullName} as Class Rep?`)) revokeRep.mutate(u._id);
                            }}
                            className="text-xs px-2.5 py-1.5 text-amber-600 hover:bg-amber-50 border border-amber-100 rounded-lg transition-colors"
                            title="Revoke class rep"
                          >
                            Revoke Rep
                          </button>
                        )}
                        {/* Toggle active — super admin only */}
                        {isAdmin && (
                          <button
                            onClick={() => toggleStatus.mutate(u._id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.isActive !== false
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={u.isActive !== false ? 'Deactivate' : 'Activate'}
                          >
                            {u.isActive !== false ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                        )}
                        {/* Delete — super admin only */}
                        {isAdmin && (
                          <button
                            onClick={() => { if (confirm(`Delete ${u.fullName}?`)) deleteUser.mutate(u._id); }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Assign Class Rep Modal ─────────────────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAssignModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-modal p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <UserCog size={18} className="text-primary-600" /> Assign Class Representative
              </h2>
              <button onClick={() => setShowAssignModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Level + Course selectors — only super admin needs to pick; level adviser is scoped */}
              {isAdmin && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Level</label>
                    <select className="input" value={assignLevel}
                      onChange={e => { setAssignLevel(e.target.value); setSelectedStudentId(''); }}>
                      <option value="">Select level</option>
                      {LEVELS.map(l => <option key={l} value={l}>{l} Level</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Course of study</label>
                    <input className="input" placeholder="e.g. Educational Tech."
                      value={assignCourse}
                      onChange={e => { setAssignCourse(e.target.value); setSelectedStudentId(''); }} />
                  </div>
                </div>
              )}

              {/* Current rep info */}
              {levelData?.currentRep && (
                <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-xl border border-primary-100">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-semibold">
                    {levelData.currentRep.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-primary-800">Current Rep: {levelData.currentRep.fullName}</p>
                    <p className="text-xs text-primary-500">Selecting a new student will replace them</p>
                  </div>
                </div>
              )}

              {/* Student dropdown */}
              <div>
                <label className="label">Select student to assign</label>
                {loadingStudents ? (
                  <div className="input flex items-center gap-2 text-slate-400">
                    <Loader2 size={14} className="animate-spin" /> Loading students…
                  </div>
                ) : !assignLevel || !assignCourse ? (
                  <div className="input text-slate-400">Fill level and course first</div>
                ) : levelData?.students.length === 0 ? (
                  <div className="input text-slate-400">No students found for this level/course</div>
                ) : (
                  <select className="input" value={selectedStudentId}
                    onChange={e => setSelectedStudentId(e.target.value)}>
                    <option value="">Choose a student…</option>
                    {levelData?.students.map(s => (
                      <option key={s._id} value={s._id}>{s.fullName}</option>
                    ))}
                  </select>
                )}
              </div>

              <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 px-3 py-2.5 rounded-xl">
                ⚠️ If there is already a class rep for this level, they will automatically be demoted back to student when you assign a new one.
              </p>

              <div className="flex gap-2 pt-1">
                <button className="btn-secondary flex-1" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn-primary flex-1"
                  disabled={!selectedStudentId || assignRep.isPending}
                  onClick={() => assignRep.mutate(selectedStudentId)}
                >
                  {assignRep.isPending
                    ? <><Loader2 size={14} className="animate-spin" /> Assigning…</>
                    : <><UserCog size={14} /> Assign as Class Rep</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create User Modal (Super Admin only) ──────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-modal p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Shield size={18} className="text-primary-600" /> Add New User
              </h2>
              <button onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input className="input" placeholder="e.g. Dr. Adewale Bakare"
                  value={form.fullName} onChange={set('fullName')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={set('email')} />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={form.role} onChange={set('role')}>
                    {/* Super admin can only create level_adviser from here — not super_admin */}
                    <option value="student">Student</option>
                    <option value="level_adviser">Level Adviser</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" placeholder="Temporary password"
                  value={form.password} onChange={set('password')} minLength={6} />
              </div>
              <div>
                <label className="label">department</label>
                <select className="input" value={form.department} onChange={set('department')}>
                  <option value="">Select department</option>
                  {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Level</label>
                  <select className="input" value={form.level} onChange={set('level')}>
                    <option value="">Select level</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l} Level</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Course of study</label>
                  <input className="input" placeholder="e.g. Educational Tech."
                    value={form.courseOfStudy} onChange={set('courseOfStudy')} />
                </div>
              </div>
              {form.role === 'student' && (
                <div>
                  <label className="label">Matric number</label>
                  <input className="input" placeholder="e.g. 20/52HA001"
                    value={form.matricNumber} onChange={set('matricNumber')} />
                </div>
              )}
              {form.role === 'level_adviser' && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-xs text-emerald-700">
                  ✅ This Level Adviser will have full management access for {form.level || '?'} Level — {form.courseOfStudy || '?'}.
                  They can assign and revoke the class rep for their level.
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button className="btn-secondary flex-1" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button className="btn-primary flex-1" onClick={() => createUser.mutate(form)}
                  disabled={createUser.isPending}>
                  {createUser.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  Create User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}