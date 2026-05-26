import { useState, useEffect } from 'react';
import { Plus, Loader2, X, Copy, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { facultyService, Faculty } from '../utils/facultyService';
import api from '../utils/api';

const ROLES = [
  { value: 'level_adviser', label: 'Level Adviser', color: 'emerald' },
  { value: 'exam_officer', label: 'Exam Officer', color: 'orange' },
  { value: 'super_admin', label: 'Super Admin', color: 'purple' },
];

const LEVELS = ['100', '200', '300', '400', '500'];

export default function AdminCreateUserPage() {
  const { user: authUser, isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loadingFaculties, setLoadingFaculties] = useState(true);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [createdUser, setCreatedUser] = useState<any>(null);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'level_adviser',
    facultyId: '',
    faculty: '',
    level: '',
    courseOfStudy: '',
  });

  useEffect(() => {
    if (!isAdmin) return;
    loadFaculties();
  }, [isAdmin]);

  const loadFaculties = async () => {
    try {
      setLoadingFaculties(true);
      const list = await facultyService.getFaculties();
      setFaculties(list);
    } catch (err) {
      toast.error('Failed to load faculties');
    } finally {
      setLoadingFaculties(false);
    }
  };

  useEffect(() => {
    if (selectedFacultyId) {
      loadDepartments();
    } else {
      setDepartments([]);
    }
  }, [selectedFacultyId]);

  const loadDepartments = async () => {
    try {
      setLoadingDepts(true);
      const list = await facultyService.getDepartments(selectedFacultyId);
      setDepartments(list);
    } catch (err) {
      toast.error('Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    if (field === 'facultyId') {
      const selected = faculties.find(f => f.id === value);
      setSelectedFacultyId(value);
      setForm(f => ({ ...f, facultyId: value, faculty: selected?.name || '', level: '' }));
    } else {
      setForm(f => ({ ...f, [field]: value }));
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm(f => ({ ...f, password }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.fullName || !form.email || !form.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (form.role === 'level_adviser' && (!form.facultyId || !form.level)) {
      toast.error('Please select faculty and level for Level Adviser');
      return;
    }

    if (form.role === 'exam_officer' && !form.facultyId) {
      toast.error('Please select faculty for Exam Officer');
      return;
    }

    try {
      setIsLoading(true);
     const response = await api.post('/auth/admin/create-user', {
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      role: form.role,
      facultyId: form.facultyId,
      faculty: form.faculty,
      level: form.role === 'level_adviser' ? form.level : undefined,
      courseOfStudy: form.role === 'level_adviser' ? form.courseOfStudy : undefined,  // ← add this
    });

      setCreatedUser({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
      });

      toast.success('User created successfully!');
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      fullName: '',
      email: '',
      password: '',
      role: 'level_adviser',
      facultyId: '',
      faculty: '',
      level: '',
      courseOfStudy: '',
    });
    setSelectedFacultyId('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h1>
          <p className="text-slate-600">Only Super Admins can access this page.</p>
        </div>
      </div>
    );
  }

  const selectedRole = ROLES.find(r => r.value === form.role);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Create User</h1>
          <p className="text-sm text-slate-500 mt-1">Create Level Advisers, Exam Officers, or other staff accounts</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowForm(!showForm); }} 
          className="btn-primary gap-2"
        >
          <Plus size={18} /> {showForm ? 'Close' : 'New User'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-5">Create New User Account</h2>
          
          <form onSubmit={handleCreateUser} className="space-y-4">
            {/* Basic Info */}
            <div>
              <label className="label">Full Name *</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Dr. John Smith"
                value={form.fullName}
                onChange={set('fullName')}
                required
              />
            </div>

            {/* Email & Faculty */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  className="input"
                  placeholder="user@university.edu"
                  value={form.email}
                  onChange={set('email')}
                  required
                />
              </div>
              <div>
                <label className="label">Faculty *</label>
                <select
                  className="input"
                  value={selectedFacultyId}
                  onChange={set('facultyId')}
                  disabled={loadingFaculties}
                  required
                >
                  <option value="">{loadingFaculties ? 'Loading...' : 'Select Faculty'}</option>
                  {faculties.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="label">Role *</label>
              <select
                className="input"
                value={form.role}
                onChange={set('role')}
                required
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Level (for Level Adviser only) */}
            {form.role === 'level_adviser' && (
              <div>
                <label className="label">Level *</label>
                <select
                  className="input"
                  value={form.level}
                  onChange={set('level')}
                  required
                >
                  <option value="">Select Level</option>
                  {LEVELS.map(l => (
                    <option key={l} value={l}>{l} Level</option>
                  ))}
                </select>
              </div>
            )}

            {/* Course of Study (for level_adviser only) */}
        {form.role === 'level_adviser' && (
          <div>
            <label className="label">Course of Study / Department *</label>
            <select
              className="input"
              value={form.courseOfStudy}
              onChange={set('courseOfStudy')}
              disabled={loadingDepts || !selectedFacultyId}
              required
            >
              <option value="">
                {!selectedFacultyId 
                  ? 'Select a faculty first' 
                  : loadingDepts 
                  ? 'Loading departments...' 
                  : 'Select Department'}
              </option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}

            {/* Password */}
            <div>
              <label className="label">Password *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={set('password')}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="btn-secondary"
                >
                  Generate
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className={`p-3 rounded-lg border text-sm ${
              selectedRole?.color === 'emerald' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              selectedRole?.color === 'orange' ? 'bg-orange-50 border-orange-200 text-orange-800' :
              'bg-purple-50 border-purple-200 text-purple-800'
            }`}>
              {form.role === 'level_adviser' && (
                'Level Advisers manage students in their assigned level and can assign class representatives.'
              )}
              {form.role === 'exam_officer' && (
                'Exam Officers create and manage exams and CBT timetables for their faculty.'
              )}
              {form.role === 'super_admin' && (
                'Super Admins have full access to the system and can create other admin accounts.'
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary flex-1"
              >
                {isLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> Creating...</>
                ) : (
                  <>Create User</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Created User Info */}
      {createdUser && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle2 size={24} className="text-emerald-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-emerald-900 text-lg">User Created Successfully!</h3>
              <p className="text-sm text-emerald-700 mt-1">Share these credentials with the user</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-white rounded-lg p-3 border border-emerald-100">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Full Name</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-800">{createdUser.fullName}</p>
                <button
                  onClick={() => copyToClipboard(createdUser.fullName)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-emerald-100">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Email</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-800 font-mono">{createdUser.email}</p>
                <button
                  onClick={() => copyToClipboard(createdUser.email)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-emerald-100">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Password</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-800 font-mono">{createdUser.password}</p>
                <button
                  onClick={() => copyToClipboard(createdUser.password)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-emerald-100">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Role</p>
              <p className="text-sm font-medium text-slate-800">{ROLES.find(r => r.value === createdUser.role)?.label}</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            ⚠️ <strong>Important:</strong> Make sure to share these credentials securely. The user should change their password on first login.
          </div>

          <button
            onClick={() => setCreatedUser(null)}
            className="w-full btn-secondary mt-4"
          >
            Done
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>How it works:</strong> Create staff accounts here. Level Advisers will be automatically linked to students who register for their level. Exam Officers can then manage exams and CBTs.
        </p>
      </div>
    </div>
  );
}
