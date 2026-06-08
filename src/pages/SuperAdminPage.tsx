import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, ClipboardList, CalendarDays, FileText, Bell, UserPlus } from 'lucide-react';
import api from '../utils/api';
import { courseFormService } from '../utils/courseFormService';
import { facultyService } from '../utils/facultyService';

function useCount(key: string, fn: () => Promise<any>) {
  const q = useQuery({
    queryKey: ['superadmin', key],
    queryFn: async () => {
      const res = await fn();
      // normalize axios responses and arrays
      const payload = res && typeof res === 'object' && 'data' in res ? (res as any).data : res;
      return Array.isArray(payload) ? payload : (payload?.data || payload || []);
    },
  });
  return { count: Array.isArray(q.data) ? q.data.length : 0, isLoading: q.isLoading };
}

export default function SuperAdminPage() {
  const users = useCount('users', () => api.get('/users'));
  const exams = useCount('exams', () => api.get('/exams'));
  const tests = useCount('tests', () => api.get('/tests'));
  const forms = useCount('forms', () => courseFormService.getAllCourseForms());
  const faculties = useCount('faculties', () => facultyService.getFaculties());

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Super Admin Console</h1>
        <p className="text-sm text-slate-500 mt-1">Overview and quick access to system-wide resources.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold">{users.isLoading ? '…' : users.count}</p>
              <p className="text-sm text-slate-500">Users</p>
            </div>
            <Users size={30} className="text-slate-400" />
          </div>
          <div className="mt-3 flex gap-2">
            <Link to="/users" className="btn-secondary">Manage</Link>
            <Link to="/admin/create-user" className="btn-primary">Create</Link>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold">{exams.isLoading ? '…' : exams.count}</p>
              <p className="text-sm text-slate-500">Exams</p>
            </div>
            <CalendarDays size={30} className="text-slate-400" />
          </div>
          <div className="mt-3 flex gap-2">
            <Link to="/exam-management" className="btn-secondary">Manage</Link>
            <Link to="/exam-timetable" className="btn-primary">View Timetable</Link>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold">{tests.isLoading ? '…' : tests.count}</p>
              <p className="text-sm text-slate-500">Tests</p>
            </div>
            <ClipboardList size={30} className="text-slate-400" />
          </div>
          <div className="mt-3">
            <Link to="/tests" className="btn-secondary">Manage</Link>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold">{forms.isLoading ? '…' : forms.count}</p>
              <p className="text-sm text-slate-500">Course Forms</p>
            </div>
            <FileText size={30} className="text-slate-400" />
          </div>
          <div className="mt-3">
            <Link to="/course-forms" className="btn-secondary">Manage</Link>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold">{faculties.isLoading ? '…' : faculties.count}</p>
              <p className="text-sm text-slate-500">Faculties</p>
            </div>
            <UserPlus size={30} className="text-slate-400" />
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold">—</p>
              <p className="text-sm text-slate-500">Events</p>
            </div>
            <ClipboardList size={30} className="text-slate-400" />
          </div>
          <div className="mt-3">
            <Link to="/events" className="btn-secondary">Manage</Link>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold">—</p>
              <p className="text-sm text-slate-500">Notifications</p>
            </div>
            <Bell size={30} className="text-slate-400" />
          </div>
          <div className="mt-3">
            <Link to="/notifications" className="btn-secondary">Manage</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
