import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Calendar, Clock, MapPin, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { CourseCodeSuggestion, useCourseCodeSuggestions } from '../hooks/useCourseCodeSuggestions';
import { testService, TestData } from '../utils/testService';
import { courseFormService } from '../utils/courseFormService';
import { Test, Semester } from '../types';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const getCurrentAcademicYear = (dateString?: string) => {
  const date = dateString ? new Date(dateString) : new Date();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

const getCurrentSemester = (dateString?: string): Semester => {
  const date = dateString ? new Date(dateString) : new Date();
  const month = date.getMonth() + 1;
  return (month >= 8 || month <= 1) ? 'First' : 'Second';
};

const EMPTY_FORM: Partial<TestData> = {
  courseCode: '',
  courseTitle: '',
  testType: 'written',
  scheduleDate: '',
  startTime: '09:00',
  endTime: '11:00',
  venue: '',
  invigilators: [],
  students: [],
  instructions: '',
};

export default function CBTTestPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isExamOfficer = user?.role === 'exam_officer' || user?.role === 'super_admin';
  const isClassRep = user?.role === 'class_rep';
  const isStudent = user?.role === 'student';
  const isStudentOrRep = isStudent || isClassRep;

  const [typeFilter, setTypeFilter] = useState<'all' | 'written' | 'cbt' | 'practical' | 'oral'>('all');
  const [academicYearFilter, setAcademicYearFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [newTest, setNewTest] = useState<Partial<TestData>>(EMPTY_FORM);

  const { suggestions, courseCodeMap } = useCourseCodeSuggestions() as {
    suggestions: CourseCodeSuggestion[];
    courseCodeMap: Map<string, string>;
  };
  const courseOptions = useMemo<string[]>(() => suggestions.map(s => s.courseCode), [suggestions]);

  // ── Same shared-cache queries as ExamsListPage / CalendarPage ──────────────
  const { data: studentFormData, isLoading: studentFormLoading } = useQuery({
    queryKey: ['student-course-form', user?._id],
    queryFn: async () => {
      const res = await courseFormService.getAllCourseForms({ studentId: user!._id, status: 'approved' });
      const forms = Array.isArray(res.data) ? res.data : (res.data?.forms || res.data?.data || []);
      return forms.length > 0 ? forms[0] : null;
    },
    enabled: isStudentOrRep && !!user?._id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: deptFormData } = useQuery({
    queryKey: ['dept-course-form', user?.faculty, user?.courseOfStudy, user?.level],
    queryFn: async () => {
      const res = await courseFormService.getAllCourseForms({
        faculty: user!.faculty,
        courseOfStudy: user!.courseOfStudy,
        level: user!.level,
        status: 'approved',
      });
      const forms = Array.isArray(res.data) ? res.data : (res.data?.forms || res.data?.data || []);
      return forms.length > 0 ? forms[0] : null;
    },
    enabled: isStudentOrRep && !studentFormLoading && !studentFormData,
    staleTime: 1000 * 60 * 5,
  });

  const activeForm = studentFormData || deptFormData || null;

  // ── Always use getMyTests — backend now does personal form first ──────────
  const { data: allTests = [], isLoading, refetch } = useQuery<Test[]>({
    queryKey: ['my-tests', user?.role, user?._id, activeForm?._id],
    queryFn: async () => {
      const res = await testService.getMyTests();
      return Array.isArray(res.data) ? res.data : (res.data?.tests || res.data?.data || []);
    },
    // For students/reps wait for activeForm so backend knows who they are
    enabled: !!user && (!isStudentOrRep || !!activeForm),
    staleTime: 1000 * 60 * 5,
  });

  // ── Client-side filters (type + academic year) ────────────────────────────
  const filteredTests = useMemo(() => allTests.filter(test => {
    if (typeFilter !== 'all' && test.testType !== typeFilter) return false;
    if (academicYearFilter && test.academicYear && !test.academicYear.includes(academicYearFilter)) return false;
    if (isStudent) return test.status === 'published';
    if (isClassRep) return test.testType !== 'cbt' || test.status === 'published';
    return true;
  }), [allTests, typeFilter, academicYearFilter, isStudent, isClassRep]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const set = (key: string, value: any) => setNewTest(prev => ({ ...prev, [key]: value }));

  const handleCourseCodeChange = (value: string) => {
    const code = value.toUpperCase();
    set('courseCode', code);
    const title = courseCodeMap.get(code.trim());
    if (title) set('courseTitle', title);
  };

  const getStudentIdsForCourse = async (courseCode: string) => {
    try {
      const res = await api.get('/course-forms', {
        params: { faculty: user?.faculty, courseOfStudy: user?.courseOfStudy, level: user?.level, status: 'approved' },
      });
      const forms = Array.isArray(res.data) ? res.data : (res.data?.forms || res.data?.data || []);
      const target = (courseCode || '').trim().toUpperCase();
      const ids = new Set<string>();
      for (const f of forms) {
        if (!Array.isArray(f.courses)) continue;
        const has = f.courses.some((c: any) =>
          ((typeof c === 'string' ? c : c.courseCode) || '').trim().toUpperCase() === target
        );
        if (has && f.studentId) ids.add((f.studentId._id || f.studentId).toString());
      }
      return Array.from(ids);
    } catch {
      toast.error('Failed to fetch students for course');
      return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTest.courseCode || !newTest.scheduleDate || !newTest.startTime || !newTest.endTime) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (isClassRep && newTest.testType === 'cbt') {
      toast.error('Only exam officers can create CBT tests');
      return;
    }
    try {
      const studentIds = await getStudentIdsForCourse(newTest.courseCode || '');
      const payload: Partial<TestData> = {
        ...newTest,
        students: studentIds,
        faculty: user?.faculty,
        level: user?.level,
        courseOfStudy: user?.courseOfStudy,
        semester: getCurrentSemester(newTest.scheduleDate),
        academicYear: getCurrentAcademicYear(newTest.scheduleDate),
      };
      if (editingTest?._id) {
        await testService.updateTest(editingTest._id, payload);
        toast.success('Test updated successfully');
      } else {
        await testService.createTest(payload);
        toast.success('Test created successfully');
      }
      setShowForm(false);
      setEditingTest(null);
      setNewTest(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['my-tests'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save test');
    }
  };

  const handleEdit = (test: Test) => {
    setEditingTest(test);
    setNewTest({
      courseCode: test.courseCode,
      courseTitle: test.courseTitle,
      testType: test.testType,
      scheduleDate: test.scheduleDate,
      startTime: test.startTime,
      endTime: test.endTime,
      venue: test.venue,
      invigilators: test.invigilators,
      instructions: test.instructions,
      students: test.students,
    });
    setShowForm(true);
  };

  const handleDelete = async (testId: string) => {
    if (!confirm('Are you sure you want to delete this test?')) return;
    try {
      await testService.deleteTest(testId);
      toast.success('Test deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['my-tests'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete test');
    }
  };

  const handlePublish = async (testId: string) => {
    try {
      await testService.publishTest(testId);
      toast.success('Test published successfully');
      queryClient.invalidateQueries({ queryKey: ['my-tests'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to publish test');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">CBT Test</h1>
          <p className="text-sm text-slate-500">
            {isExamOfficer ? 'Manage CBT tests and written tests' : isClassRep ? 'Manage class tests' : 'Your tests and CBT assessments'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="all">All Types</option>
            <option value="written">Written</option>
            <option value="cbt">CBT</option>
            <option value="practical">Practical</option>
            <option value="oral">Oral</option>
          </select>
          <input
            type="text"
            placeholder="Year e.g. 2025"
            value={academicYearFilter}
            onChange={e => setAcademicYearFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm w-36"
          />
          <button
            onClick={() => { setTypeFilter('all'); setAcademicYearFilter(''); }}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
        {(isExamOfficer || isClassRep) && (
          <button
            onClick={() => { setEditingTest(null); setNewTest(EMPTY_FORM); setShowForm(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            <Plus size={18} /> Add Test
          </button>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">{editingTest ? 'Edit Test' : 'Create New Test'}</h2>
              <button onClick={() => { setShowForm(false); setEditingTest(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Course Code *</label>
                <input
                  type="text" value={newTest.courseCode}
                  onChange={e => handleCourseCodeChange(e.target.value)}
                  list="courses"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="e.g., CS101"
                />
                <datalist id="courses">{courseOptions.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Test Type *</label>
                <select
                  value={newTest.testType}
                  onChange={e => set('testType', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  disabled={isClassRep}
                >
                  <option value="written">Written Test</option>
                  {isExamOfficer && <option value="cbt">CBT Test</option>}
                  {isExamOfficer && <option value="practical">Practical</option>}
                  {isExamOfficer && <option value="oral">Oral</option>}
                </select>
                {isClassRep && <p className="mt-1 text-xs text-slate-500">Class reps can only create written tests</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Course Title</label>
                <input
                  type="text" value={newTest.courseTitle}
                  onChange={e => set('courseTitle', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Auto-filled from course code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Schedule Date *</label>
                <input
                  type="date" value={newTest.scheduleDate}
                  onChange={e => set('scheduleDate', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Start Time *</label>
                  <input type="time" value={newTest.startTime} onChange={e => set('startTime', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">End Time *</label>
                  <input type="time" value={newTest.endTime} onChange={e => set('endTime', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                </div>
              </div>
              {newTest.testType === 'written' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Venue *</label>
                  <input
                    type="text" value={newTest.venue}
                    onChange={e => set('venue', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="e.g., Lecture Hall A"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
                  {editingTest ? 'Update Test' : 'Create Test'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingTest(null); }} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700">Loading tests...</div>
      )}

      {!isLoading && filteredTests.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-700">
          <AlertCircle className="mx-auto mb-2 text-slate-400" size={24} />
          No tests available yet
        </div>
      )}

      {!isLoading && filteredTests.length > 0 && (
        <div className="grid gap-4">
          {filteredTests.map(test => (
            <article key={test._id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-500">{test.courseCode}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wider ${test.testType === 'cbt' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {test.testType === 'cbt' ? '🖥️ CBT' : '📝 Test'}
                    </span>
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">{test.courseTitle}</h2>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                  {test.status?.replace('_', ' ')}
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-slate-500"><Calendar size={14} /> Date</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {test.scheduleDate ? format(parseISO(test.scheduleDate), 'PPP') : 'TBA'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-slate-500"><Clock size={14} /> Time</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{test.startTime} — {test.endTime}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-slate-500"><MapPin size={14} /> {test.testType === 'cbt' ? 'Platform' : 'Venue'}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {test.testType === 'cbt' ? 'CBT Centre' : (test.venue || 'TBA')}
                  </p>
                </div>
              </div>
              {test.instructions && (
                <div className="mt-4 rounded-lg bg-blue-50 p-3">
                  <p className="text-xs font-medium text-blue-900">{test.instructions}</p>
                </div>
              )}
           
              {(isExamOfficer || isClassRep) && (
                <div className="mt-4 flex gap-2">
                  <button onClick={() => handleEdit(test)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
                    <Edit2 size={14} /> Edit
                  </button>
                  {test.status === 'draft' && (
                    <button onClick={() => handlePublish(test._id)} className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-200">
                      Publish
                    </button>
                  )}
                  <button onClick={() => handleDelete(test._id)} className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}