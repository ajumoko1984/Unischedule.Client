import { useState, FormEvent, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { facultyService, Faculty } from '../utils/facultyService';
import api from '../utils/api';
import toast from 'react-hot-toast';

const LEVELS = ['100', '200', '300', '400', '500'];

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loadingFaculties, setLoadingFaculties] = useState(true);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [laExists, setLaExists] = useState<boolean | null>(null);
  const [checkingLA, setCheckingLA] = useState(false);
  
  const [form, setForm] = useState({
    fullName: '', 
    email: '', 
    password: '',
    role: 'student',
    facultyId: '',
    faculty: '',
    level: '', 
    courseOfStudy: '', 
    matricNumber: '',
  });

  // Load faculties on mount
  useEffect(() => {
    const loadFaculties = async () => {
      setLoadingFaculties(true);
      const facultyList = await facultyService.getFaculties();
      setFaculties(facultyList);
      setLoadingFaculties(false);
    };
    loadFaculties();
  }, []);

  // Load departments when faculty changes
  useEffect(() => {
    if (selectedFacultyId) {
      const loadDepartments = async () => {
        setLoadingDepts(true);
        const deptList = await facultyService.getDepartments(selectedFacultyId);
        setDepartments(deptList);
        setLoadingDepts(false);
      };
      loadDepartments();
    } else {
      setDepartments([]);
    }
  }, [selectedFacultyId]);

  // Check if Level Adviser exists when level/department changes
  useEffect(() => {
    if (form.level && form.courseOfStudy) {
      checkLevelAdviserExists();
    }
  }, [form.level, form.courseOfStudy]);

  const checkLevelAdviserExists = async () => {
    try {
      setCheckingLA(true);
      setLaExists(null);
      
      // Use the backend API directly through the shared axios instance
      const res = await api.get('/users/level-adviser-exists', {
        params: {
          faculty: form.faculty,
          facultyId: selectedFacultyId,
          level: form.level,
          department: form.courseOfStudy,
          courseOfStudy: form.courseOfStudy,
        },
      });
      setLaExists(res.data.exists);
      
      if (!res.data.exists) {
        toast.error('No Level Adviser found for this level. Please contact your Level Adviser first.');
      }
    } catch (err) {
      console.error('Error checking LA:', err);
      setLaExists(null);
    } finally {
      setCheckingLA(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleFacultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const facultyId = e.target.value;
    const selectedFac = faculties.find(f => f.id === facultyId);
    
    setSelectedFacultyId(facultyId);
    setForm(f => ({ 
      ...f, 
      facultyId, 
      faculty: selectedFac?.name || '',
      courseOfStudy: '' // Reset department selection
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (laExists === false) {
      toast.error('Cannot register: No Level Adviser assigned to your level. Please contact your Level Adviser first.');
      return;
    }

    if (laExists === null) {
      toast.error('Please wait while we verify your Level Adviser assignment.');
      return;
    }

    try {
      await register(form);
      toast.success('Account created! Welcome to UniSchedule.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-[480px] animate-fade-in">
        <div className="bg-white rounded-2xl shadow-modal p-8">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 bg-primary-950 rounded-xl flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-lg leading-tight">UniSchedule</div>
              <div className="text-xs text-slate-400">Create your account</div>
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Create account</h1>
          <p className="text-sm text-slate-500 mb-6">Fill in your details to register as a student</p>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-800">
            ℹ️ You will be automatically linked to your Level Adviser based on your level and department.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" placeholder="e.g. Adesola Rasheed" value={form.fullName} onChange={set('fullName')} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="your@email.com" value={form.email} onChange={set('email')} required />
              </div>
              <div>
                <label className="label">Faculty</label>
                <select className="input" value={selectedFacultyId} onChange={handleFacultyChange} required disabled={loadingFaculties}>
                  <option value="">{loadingFaculties ? 'Loading...' : 'Select Faculty'}</option>
                  {faculties.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Level</label>
                <select className="input" value={form.level} onChange={set('level')} required>
                  <option value="">Select level</option>
                  {LEVELS.map(l => (
                    <option key={l} value={l}>{l} Level</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Department</label>
                <select 
                  className="input" 
                  value={form.courseOfStudy} 
                  onChange={set('courseOfStudy')} 
                  required 
                  disabled={!selectedFacultyId || loadingDepts}
                >
                  <option value="">
                    {loadingDepts ? 'Loading...' : selectedFacultyId ? 'Select Department' : 'Choose faculty first'}
                  </option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Matric number</label>
              <input className="input" placeholder="e.g. 20/52HA001" value={form.matricNumber} onChange={set('matricNumber')} />
            </div>

            {/* Level Adviser Status */}
            {form.level && form.courseOfStudy && (
              <div className={`p-3 rounded-lg border flex items-start gap-2 ${
                laExists === true ? 'bg-emerald-50 border-emerald-200' :
                laExists === false ? 'bg-red-50 border-red-200' :
                'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex-1">
                  {checkingLA && (
                    <div className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-slate-400" />
                      <span className="text-sm text-slate-600">Checking Level Adviser...</span>
                    </div>
                  )}
                  {laExists === true && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span className="text-sm text-emerald-700 font-medium">✓ Level Adviser assigned for your level</span>
                    </div>
                  )}
                  {laExists === false && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={16} className="text-red-600" />
                        <span className="text-sm text-red-700 font-medium">No Level Adviser found</span>
                      </div>
                      <p className="text-xs text-red-600 ml-6">Please contact your Level Adviser to create an account first</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading || laExists === false || checkingLA} 
              className="btn-primary w-full justify-center py-2.5 mt-4"
            >
              {isLoading ? (
                <><Loader2 size={16} className="animate-spin" /> Creating account...</>
              ) : laExists === false ? (
                <>❌ Cannot Register - No Level Adviser</>
              ) : checkingLA ? (
                <>⏳ Verifying Level Adviser...</>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="mt-6 text-sm text-center text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">Sign in</Link>
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-white/40">University of Ilorin · Account Registration</p>
      </div>
    </div>
  );
}
