import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { examService } from '../utils/examService';
import { courseFormService } from '../utils/courseFormService';
import { Exam } from '../types';
import { useAuth } from '../context/AuthContext';

export default function ExamsListPage() {
  const { user } = useAuth();

  const isStudent = !!user && user.role === 'student';

  // 1. Fetch personal course form by studentId (carry-over / custom courses)
  const { data: studentFormData, isLoading: studentFormLoading } = useQuery({
    queryKey: ['student-course-form', user?._id],
    queryFn: async () => {
      const res = await courseFormService.getAllCourseForms({ studentId: user!._id });
      const forms = Array.isArray(res.data)
        ? res.data
        : res.data?.forms || res.data?.data || [];
      return forms.length > 0 ? forms[0] : null;
    },
    enabled: isStudent,
    staleTime: 1000 * 60 * 5,
  });

  // 2. Fetch dept-level approved course form — only used if no personal form exists
  const { data: deptFormData, isLoading: deptFormLoading } = useQuery({
    queryKey: ['dept-course-form', user?.faculty, user?.courseOfStudy, user?.level],
    queryFn: async () => {
      const res = await courseFormService.getAllCourseForms({
        faculty: user!.faculty,
        courseOfStudy: user!.courseOfStudy,
        level: user!.level,
        status: 'approved',
      });
      const forms = Array.isArray(res.data)
        ? res.data
        : res.data?.forms || res.data?.data || [];
      return forms.length > 0 ? forms[0] : null;
    },
    // Only fetch dept form if student has no personal form (or still loading)
    enabled: isStudent && !studentFormLoading && !studentFormData,
    staleTime: 1000 * 60 * 5,
  });

  // Personal form wins; dept form is fallback
  const activeForm = studentFormData || deptFormData || null;
  const formSource = studentFormData ? 'personal' : deptFormData ? 'department' : null;
  const formsLoading = isStudent && (studentFormLoading || (!studentFormData && deptFormLoading));

  // 3. Fetch all exams, then filter by active form's course codes
  const { data: exams = [], isLoading: examsLoading, isError } = useQuery<Exam[]>({
    queryKey: ['my-exams', user?.role, user?._id, activeForm?._id],
    queryFn: async () => {
      const res = await examService.getMyExams();
      const raw: Exam[] = Array.isArray(res.data)
        ? res.data
        : res.data?.exams || res.data?.data || [];

      if (!isStudent) return raw;

      if (!activeForm?.courses?.length) return [];

      const allowedCodes = new Set(
        activeForm.courses.map((c: any) =>
          (typeof c === 'string' ? c : c.courseCode).toUpperCase()
        )
      );

      return raw.filter(exam => allowedCodes.has((exam.courseCode || '').toUpperCase()));
    },
    enabled: !!user && (!isStudent || !!activeForm),
    staleTime: 1000 * 60 * 5,
  });

  // Build exam lookup map by course code
  const examByCourse: Record<string, Exam> = {};
  for (const ex of exams) {
    if (ex.courseCode) examByCourse[ex.courseCode.toUpperCase()] = ex;
  }

  const isLoading = formsLoading || examsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Exam Timetable</h1>
          <p className="text-sm text-slate-500">View your upcoming exams and schedule details.</p>
        </div>
      </div>

  
      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
          Loading exams...
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          Failed to load exams. Please try again later.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid gap-4">
          {/* Students: render from course form courses so TBA slots show */}
          {isStudent && activeForm?.courses?.length ? (
            activeForm.courses.map((c: any) => {
              const code = (typeof c === 'string' ? c : c.courseCode).toUpperCase();
              const title = typeof c === 'string' ? code : c.courseTitle;
              const exam = examByCourse[code];
              return (
                <article key={code} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{code}</p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900">{title}</h2>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {exam ? exam.status.replace('_', ' ') : 'No exam scheduled'}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Date</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {exam?.scheduleDate ? format(parseISO(exam.scheduleDate), 'PPP') : 'TBA'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Time</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {exam ? `${exam.startTime} — ${exam.endTime}` : 'TBA'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Venue</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {exam ? exam.venue || exam.location || 'TBA' : 'TBA'}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })
          ) : !isStudent ? (
            // Non-students: render raw exams list
            exams.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
                No exams found.
              </div>
            ) : (
              exams.map(exam => (
                <article key={exam._id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{exam.courseCode}</p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900">{exam.courseTitle}</h2>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {exam.status.replace('_', ' ')}
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Date</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {exam.scheduleDate ? format(parseISO(exam.scheduleDate), 'PPP') : 'TBA'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Time</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {exam.startTime} — {exam.endTime}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Venue</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {exam.venue || exam.location || 'TBA'}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
              No exams found for your registered courses.
            </div>
          )}
        </div>
      )}
    </div>
  );
}