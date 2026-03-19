import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const LEVELS = ['100', '200', '300', '400', '500'];

const FACULTY_DATA = {
  "Education": [
    "Educational Technology",
    "Health Education",
    "Human Kinetics",
    "Adult Education",
    "Primary Education Studies",
    "Business Education",
    "Education & Biology",
    "Education & Chemistry",
    "Education & Physics",
    "Education & Mathematics",
    "Education & Computer Science",
    "Education & English",
    "Education & Economics",
    "Education & Geography",
    "Education & History",
    "Education & Arabic",
    "Education & French",
    "Education & Yoruba"
  ],
  "Engineering": [
    "Biomedical Engineering",
    "Civil Engineering",
    "Computer Engineering",
    "Electrical & Electronics Engineering",
    "Mechanical Engineering",
    "Metallurgical & Materials Engineering",
    "Food Engineering"
  ],
  "Social Sciences": [
    "Economics",
    "Political Science",
    "Sociology",
    "Psychology",
    "Geography & Environmental Management",
    "Criminology & Security Studies",
    "Social Work"
  ],
  "Management Sciences": [
    "Accounting",
    "Business Administration",
    "Finance",
    "Marketing",
    "Public Administration",
    "Industrial Relations & Personnel Management"
  ],
  "Physical Sciences": [
    "Mathematics",
    "Statistics",
    "Physics",
    "Chemistry",
    "Industrial Chemistry",
    "Geology",
    "Applied Geophysics"
  ],
  "Life Sciences": [
    "Biochemistry",
    "Microbiology",
    "Plant Biology",
    "Zoology",
    "Optometry"
  ],
  "Arts": [
    "English Language",
    "History & International Studies",
    "Performing Arts",
    "Arabic",
    "French",
    "Yoruba",
    "Hausa",
    "Igbo",
    "Comparative Religious Studies",
    "Islamic Studies"
  ],
  "Law": [
    "Common Law",
    "Common & Islamic Law"
  ],
  "Environmental Sciences": [
    "Architecture",
    "Estate Management",
    "Quantity Surveying",
    "Surveying & Geoinformatics",
    "Urban & Regional Planning"
  ],
  "Agriculture": [
    "Agriculture",
    "Agricultural Science & Education",
    "Agricultural & Biosystems Engineering",
    "Fisheries & Aquaculture",
    "Food Science",
    "Forestry & Wildlife Management"
  ],
  "Communication & Information Sciences": [
    "Mass Communication",
    "Information & Communication Science",
    "Library & Information Science",
    "Telecommunication Science"
  ],
  "Basic Medical Sciences": [
    "Anatomy",
    "Physiology"
  ],
  "Clinical Sciences": [
    "Medicine & Surgery"
  ]
};

const FACULTIES = Object.keys(FACULTY_DATA);

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [form, setForm] = useState({
    fullName: '', email: '', password: '',
    faculty: '', level: '', courseOfStudy: '', matricNumber: '',
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleFacultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const faculty = e.target.value;
    setSelectedFaculty(faculty);
    setForm(f => ({ ...f, faculty: faculty, courseOfStudy: '' })); // Reset courseOfStudy when faculty changes
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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

      <div className="relative w-full max-w-[460px] animate-fade-in">
        <div className="bg-white rounded-2xl shadow-modal p-8">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-lg leading-tight">UniSchedule</div>
              <div className="text-xs text-slate-400">Create your student account</div>
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-slate-800 mb-1">Create account</h1>
          <p className="text-sm text-slate-500 mb-7">Fill in your details to get started</p>

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
                <label className="label">Matric number</label>
                <input className="input" placeholder="e.g. 20/52HA001" value={form.matricNumber} onChange={set('matricNumber')} />
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

            <div>
              <label className="label">Faculty</label>
              <select className="input" value={form.faculty} onChange={handleFacultyChange} required>
                <option value="">Select Faculty</option>
                {FACULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Level</label>
                <select className="input" value={form.level} onChange={set('level')} required>
                  <option value="">Select level</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l} Level</option>)}
                </select>
              </div>
              <div>
                <label className="label">Course of study</label>
                <select className="input" value={form.courseOfStudy} onChange={set('courseOfStudy')} required disabled={!selectedFaculty}>
                  <option value="">Select course of study</option>
                  {(FACULTY_DATA[selectedFaculty as keyof typeof FACULTY_DATA] || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-2.5 mt-2">
              {isLoading ? <><Loader2 size={16} className="animate-spin" />Creating account...</> : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-sm text-center text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">Sign in</Link>
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-white/40">University of Ilorin · Student Registration</p>
      </div>
    </div>
  );
}
