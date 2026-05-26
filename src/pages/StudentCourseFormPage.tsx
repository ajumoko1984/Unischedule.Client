import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { courseFormService, CourseFormData } from '../utils/courseFormService';
import { useAuth } from '../context/AuthContext';
import { format, parseISO } from 'date-fns';

export default function StudentCourseFormPage() {
  const { user } = useAuth();
  const [courseForms, setCourseForms] = useState<CourseFormData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadApprovedCourseforms();
    }
  }, [user]);

  const loadApprovedCourseforms = async () => {
    try {
      setIsLoading(true);
      const res = await courseFormService.getMyCourseforms({
        faculty: user?.faculty,
        courseOfStudy: user?.courseOfStudy,
        level: user?.level,
      });
      // Handle different response formats
      const data = res.data;
      let forms: CourseFormData[] = [];
      
      if (Array.isArray(data)) {
        forms = data;
      } else if (Array.isArray(data?.forms)) {
        forms = data.forms;
      } else if (Array.isArray(data?.courses)) {
        forms = data.courses;
      } else if (Array.isArray(data?.data)) {
        forms = data.data;
      }
      
      setCourseForms(forms.filter(form => form.status === 'approved'));
    } catch (err: any) {
      toast.success(err.response?.data?.message || 'No course forms found');
      setCourseForms([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 size={20} className="text-green-600" />;
      case 'rejected':
        return <AlertCircle size={20} className="text-red-600" />;
      case 'submitted':
        return <Clock size={20} className="text-blue-600" />;
      default:
        return <Clock size={20} className="text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      draft: { color: 'bg-slate-100 text-slate-700', label: 'Draft' },
      submitted: { color: 'bg-blue-100 text-blue-700', label: 'Pending Approval' },
      approved: { color: 'bg-green-100 text-green-700', label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-700', label: 'Rejected' },
    };
    const badge = badges[status] || badges.draft;
    return badge;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-slate-600">Loading course forms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">My Course Forms</h1>
        <p className="text-slate-600 mt-1">View your registered courses</p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">Note:</span> Your course form shows all courses you're registered for this semester. 
          Only exams for courses in your <span className="font-semibold">approved course form</span> will appear in your exam timetable.
          To add or drop courses, please contact your level adviser or class rep.
        </p>
      </div>

      {/* Course Forms List */}
      <div className="space-y-4">
        {Array.isArray(courseForms) && courseForms.map((form) => {
          const badge = getStatusBadge(form.status);
          const isActive = form.status === 'approved';

          return (
            <div
              key={form._id}
              className={`rounded-xl border p-6 transition ${
                isActive
                  ? 'bg-white border-primary-200 shadow-md'
                  : 'bg-white border-slate-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(form.status)}
                  <div>
                    <p className="text-sm font-medium text-slate-600">
                      {form.semester} Semester {form.academicYear}
                    </p>
                    <h3 className="text-lg font-semibold text-slate-800 mt-0.5">
                      {form.status === 'approved' ? 'Active Course Form' : 'Course Form'}
                    </h3>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                  {badge.label}
                </span>
              </div>

              {form.status === 'rejected' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-800">
                    <span className="font-semibold">Rejected:</span> Please contact your level adviser or class rep to review and resubmit your course form.
                  </p>
                </div>
              )}

              <div className="mb-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Registered Courses ({Array.isArray(form.courses) ? form.courses.length : 0}):</p>
                <div className="space-y-2">
                  {Array.isArray(form.courses) && form.courses.map((course: any, idx: number) => (
                    <div
                      key={idx}
                      className={`px-3 py-2 rounded-lg text-sm transition border ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 border-primary-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <p className="font-medium">
                        {typeof course === 'string' ? course : course.courseCode}
                      </p>
                      {typeof course === 'object' && course.courseTitle && (
                        <p className="text-xs mt-1 opacity-75">{course.courseTitle}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {isActive && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
                  <p className="text-sm text-green-800">
                    ✓ This is your active course form. Exams for these courses will appear in your exam timetable.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {courseForms.length === 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
          <AlertCircle size={40} className="mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No course forms yet</h3>
          <p className="text-slate-600">
            Please contact your level adviser or class rep to create your course form for this semester.
          </p>
        </div>
      )}
    </div>
  );
}
