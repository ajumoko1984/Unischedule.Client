import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { examService } from '../utils/examService';
import { courseFormService } from '../utils/courseFormService';
import { Exam } from '../types';
import { useAuth } from '../context/AuthContext';

export default function ExamsListPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'my'>('all');

  const isStudent = !!user && user.role === 'student';
  const isClassRep = !!user && user.role === 'class_rep';
  const isStudentOrRep = isStudent || isClassRep;
  const isLecturer = !!user && user.role === 'lecturer';
  const isLevelAdviser = !!user && user.role === 'level_adviser';
  const isAdminOrExamOfficer = !!user && (user.role === 'exam_officer' || user.role === 'super_admin');

  // 1. Fetch personal course form by studentId/class rep (carry-over / custom courses)
  const { data: studentFormData, isLoading: studentFormLoading } = useQuery({
    queryKey: ['student-course-form', user?._id],
    queryFn: async () => {
      const res = await courseFormService.getAllCourseForms({ studentId: user!._id });
      const forms = Array.isArray(res.data)
        ? res.data
        : res.data?.forms || res.data?.data || [];
      return forms.length > 0 ? forms[0] : null;
    },
    enabled: isStudentOrRep,
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
    enabled: isStudentOrRep && !studentFormLoading && !studentFormData,
    staleTime: 1000 * 60 * 5,
  });

  // Personal form wins; dept form is fallback
  const activeForm = studentFormData || deptFormData || null;
  const formSource = studentFormData ? 'personal' : deptFormData ? 'department' : null;
  const formsLoading = isStudentOrRep && (studentFormLoading || (!studentFormData && deptFormLoading));

  // 3. Fetch exams based on role: admin/exam officer can see all exams, others see only published exams
  const { data: exams = [], isLoading: examsLoading, isError } = useQuery<Exam[]>({
    queryKey: ['exams', user?.role, user?._id],
    queryFn: async () => {
      const res = isAdminOrExamOfficer
        ? await examService.getAllExams()
        : await examService.getPublishedExams();
      return Array.isArray(res.data)
        ? res.data
        : res.data?.exams || res.data?.data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // Build exam lookup map by course code
  const examByCourse: Record<string, Exam> = {};
  for (const ex of exams) {
    if (ex.courseCode) examByCourse[ex.courseCode.toUpperCase()] = ex;
  }

  const myCourseCodes = useMemo<string[]>(() => {
    if (!isStudentOrRep || !activeForm?.courses) return [];
    return Array.from(new Set(
      (activeForm.courses as any[])
        .map((c: any) => (typeof c === 'string' ? c : c.courseCode || '').toUpperCase())
        .filter(Boolean)
    ));
  }, [isStudentOrRep, activeForm?.courses]);

  const displayExams = useMemo(() => {
    return isAdminOrExamOfficer ? exams : exams.filter(exam => exam.status === 'published');
  }, [exams, isAdminOrExamOfficer]);

  const searchTerm = searchQuery.trim().toLowerCase();

  const filteredActiveCourses = useMemo(() => {
    if (!activeForm?.courses?.length) return [];
    return (activeForm.courses as any[]).filter((c: any) => {
      const code = (typeof c === 'string' ? c : c.courseCode).toUpperCase();
      const title = typeof c === 'string' ? code : c.courseTitle || '';
      return !searchTerm || code.toLowerCase().includes(searchTerm) || title.toLowerCase().includes(searchTerm);
    });
  }, [activeForm?.courses, searchTerm]);

  const filteredExams = useMemo(() => {
    return displayExams.filter(exam => {
      const code = (exam.courseCode || '').toLowerCase();
      const title = (exam.courseTitle || '').toLowerCase();
      const matchesSearch = !searchTerm || code.includes(searchTerm) || title.includes(searchTerm);
      if (!matchesSearch) return false;

      if (viewMode === 'my') {
        if (isStudentOrRep) {
          return !!exam.courseCode && myCourseCodes.includes(exam.courseCode.toUpperCase());
        }
        if (isLecturer) {
          return exam.invigilators?.some(inv => inv === user?.fullName || inv === user?._id);
        }
        if (isLevelAdviser) {
          return exam.faculty === user?.faculty && exam.level === user?.level && exam.courseOfStudy === user?.courseOfStudy;
        }
      }

      return true;
    });
  }, [displayExams, searchTerm, viewMode, isStudentOrRep, isLecturer, isLevelAdviser, myCourseCodes, user]);

  const isLoading = formsLoading || examsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Exam Timetable</h1>
          <p className="text-sm text-slate-500">Browse published exams and search by course code or title.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            className="input w-full sm:w-72"
            placeholder="Search by course code or title"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="input w-full sm:w-64"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'all' | 'my')}
          >
            <option value="all">{isAdminOrExamOfficer ? 'All exams' : 'All published exams'}</option>
            {(isStudentOrRep || isLecturer || isLevelAdviser) && (
              <option value="my">
                {isStudentOrRep ? 'My exams' : isLecturer ? 'Assigned exams' : 'My level exams'}
              </option>
            )}
          </select>
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
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* Students: render from course form courses so TBA slots show */}
          {isStudentOrRep && viewMode === 'my' ? (
            activeForm?.courses?.length ? (
              filteredActiveCourses.length ? (
                filteredActiveCourses.map((c: any) => {
                  const code = (typeof c === 'string' ? c : c.courseCode).toUpperCase();
                  const title = typeof c === 'string' ? code : c.courseTitle;
                  const exam = examByCourse[code];
                  const population = exam?.studentPopulation ?? 'TBA';
                  return (
                    <article key={code} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-medium text-slate-500">{code}</p>
                          <h2 className="mt-0.5 text-base font-semibold text-slate-900 leading-tight">{title}</h2>
                        </div>
                        <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-600 flex-shrink-0">
                          {exam ? exam.status.replace('_', ' ') : 'No exam scheduled'}
                        </div>
                      </div>

                      <div className="mt-2 grid gap-1.5 sm:grid-cols-3 text-[11px]">
                        <div className="rounded-lg bg-slate-50 p-2">
                          <p className="text-[8px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Date</p>
                          <p className="mt-0.5 font-medium text-slate-900 leading-tight">
                            {exam?.scheduleDate ? format(parseISO(exam.scheduleDate), 'PPP') : 'TBA'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          <p className="text-[8px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Time</p>
                          <p className="mt-0.5 font-medium text-slate-900 leading-tight">
                            {exam ? `${exam.startTime} — ${exam.endTime}` : 'TBA'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          <p className="text-[8px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Venue</p>
                          <p className="mt-0.5 font-medium text-slate-900 leading-tight">
                            {exam ? exam.venue || exam.location || 'TBA' : 'TBA'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex gap-1.5 items-start text-[11px]">
                        <div className="rounded-lg bg-slate-50 p-2 flex-1">
                          <p className="text-[8px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Invigilators</p>
                          <p className="mt-0.5 font-medium text-slate-900 leading-tight text-[10px]">
                            {exam?.invigilators?.filter(Boolean).length ? exam.invigilators.filter(Boolean).join(', ') : 'TBA'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2 flex-1">
                          <p className="text-[8px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Students</p>
                          <p className="mt-0.5 font-medium text-slate-900 text-center text-lg">{population}</p>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
                  No exams match your search.
                </div>
              )
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
                {formsLoading ? 'Loading your course form...' : 'No active course form found. Your exams will still show under All published exams.'}
              </div>
            )
          ) : filteredExams.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
              No exams match your search.
            </div>
          ) : (
            filteredExams.map(exam => {
              const population = exam.studentPopulation ?? 'TBA';
              return (
                <article key={exam._id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-medium text-slate-500">{exam.courseCode}</p>
                      <h2 className="mt-0.5 text-base font-semibold text-slate-900 leading-tight">{exam.courseTitle}</h2>
                    </div>
                    <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-600 flex-shrink-0">
                      {exam.status.replace('_', ' ')}
                    </div>
                  </div>

                  <div className="mt-2 grid gap-1.5 sm:grid-cols-3 text-[11px]">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-[8px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Date</p>
                      <p className="mt-0.5 font-medium text-slate-900 leading-tight">
                        {exam.scheduleDate ? format(parseISO(exam.scheduleDate), 'PPP') : 'TBA'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-[8px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Time</p>
                      <p className="mt-0.5 font-medium text-slate-900 leading-tight">
                        {exam.startTime} — {exam.endTime}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-[8px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Venue</p>
                      <p className="mt-0.5 font-medium text-slate-900 leading-tight">
                        {exam.venue || exam.location || 'TBA'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex gap-1.5 items-start text-[11px]">
                    <div className="rounded-lg bg-slate-50 p-2 flex-1">
                      <p className="text-[8px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Invigilators</p>
                      <p className="mt-0.5 font-medium text-slate-900 leading-tight text-[10px]">
                        {exam.invigilators?.filter(Boolean).length ? exam.invigilators.filter(Boolean).join(', ') : 'TBA'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 flex-1">
                      <p className="text-[8px] uppercase tracking-[0.08em] text-slate-500 font-semibold">Students</p>
                      <p className="mt-0.5 font-medium text-slate-900 text-center text-lg">{population}</p>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}