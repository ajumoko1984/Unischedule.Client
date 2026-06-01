import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2, Check, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { courseFormService, CourseFormData, Course } from '../utils/courseFormService';
import { useAuth } from '../context/AuthContext';

const defaultAcademicYear = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

export default function StudentCourseFormEditPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user, isLevelAdviser, isClassRep } = useAuth();
  const [student, setStudent] = useState<{ _id: string; fullName?: string; email?: string; level?: string; courseOfStudy?: string; faculty?: string } | null>(null);
  const [courseForms, setCourseForms] = useState<CourseFormData[]>([]);
  const [departmentForms, setDepartmentForms] = useState<CourseFormData[]>([]);
  const [baseCourseCodes, setBaseCourseCodes] = useState<Set<string>>(new Set());
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedForm, setSelectedForm] = useState<CourseFormData | null>(null);
  const [formData, setFormData] = useState({
    faculty: user?.faculty || '',
    courseOfStudy: user?.courseOfStudy || '',
    level: user?.level || '',
    academicYear: defaultAcademicYear,
    semester: 'First',
  });
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');

  const courseCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    [...departmentForms, ...courseForms].forEach((form) => {
      if (Array.isArray(form.courses)) {
        form.courses.forEach((course) => {
          const code = typeof course === 'string' ? course : course.courseCode;
          const title = typeof course === 'string' ? '' : course.courseTitle;
          if (code) {
            map.set(code.toUpperCase(), title || map.get(code.toUpperCase()) || '');
          }
        });
      }
    });
    courseList.forEach((course) => {
      if (course.courseCode) {
        map.set(course.courseCode.toUpperCase(), course.courseTitle || map.get(course.courseCode.toUpperCase()) || '');
      }
    });
    return map;
  }, [courseForms, departmentForms, courseList]);

  const courseSuggestions = useMemo(
    () => Array.from(courseCodeMap.entries())
      .map(([courseCode, courseTitle]) => ({ courseCode, courseTitle }))
      .sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
    [courseCodeMap],
  );

  const updateCourseCode = (value: string) => {
    const code = value.toUpperCase();
    setNewCourseCode(code);
    const matchedTitle = courseCodeMap.get(code.trim());
    if (matchedTitle) {
      setNewCourseTitle(matchedTitle);
    }
  };

  useEffect(() => {
    if (!studentId || !user) return;
    loadStudentFormData();
  }, [studentId, user]);

  const parseFormsResponse = (data: any): CourseFormData[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.forms)) return data.forms;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const loadStudentFormData = async () => {
    setIsLoading(true);
    try {
      let studentInfo: any = null;
      try {
        const res = await api.get(`/users/${studentId}`);
        const result = res.data?.data || res.data;
        if (result?._id) {
          studentInfo = result;
          setStudent(result);
        }
      } catch {
        setStudent(null);
      }

      const formsRes = await courseFormService.getAllCourseForms({ studentId });
      const studentForms = parseFormsResponse(formsRes.data);
      setCourseForms(studentForms);

      const faculty = studentInfo?.faculty || user?.faculty || formData.faculty;
      const courseOfStudy = studentInfo?.courseOfStudy || user?.courseOfStudy || formData.courseOfStudy;
      const level = studentInfo?.level || user?.level || formData.level;

      const deptRes = await courseFormService.getAllCourseForms({ faculty, courseOfStudy, level });
      const deptForms = parseFormsResponse(deptRes.data);
      setDepartmentForms(deptForms);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load student course forms');
      setCourseForms([]);
      setDepartmentForms([]);
    } finally {
      setIsLoading(false);
    }
  };

  const openEditForm = (form: CourseFormData) => {
    const matchingDepartmentForm = departmentForms.find(
      (deptForm) => deptForm.academicYear === form.academicYear && deptForm.semester === form.semester,
    );

    setSelectedForm(form);
    setFormData({
      faculty: form.faculty,
      courseOfStudy: form.courseOfStudy,
      level: form.level,
      academicYear: form.academicYear,
      semester: form.semester,
    });
    setCourseList(Array.isArray(form.courses) ? form.courses : []);
    setBaseCourseCodes(
      new Set(
        Array.isArray(matchingDepartmentForm?.courses)
          ? matchingDepartmentForm.courses.map((course) => course.courseCode.toUpperCase())
          : [],
      ),
    );
    setShowForm(true);
  };

  const openNewForm = (baseForm?: CourseFormData) => {
    const selectedBaseForm = baseForm || departmentForms.find(
      (deptForm) => deptForm.academicYear === formData.academicYear && deptForm.semester === formData.semester,
    );
    const baseCourses = Array.isArray(selectedBaseForm?.courses) ? selectedBaseForm.courses : [];

    setSelectedForm(null);
    setFormData({
      faculty: student?.faculty || user?.faculty || '',
      courseOfStudy: student?.courseOfStudy || user?.courseOfStudy || '',
      level: student?.level || user?.level || '',
      academicYear: selectedBaseForm?.academicYear || defaultAcademicYear,
      semester: selectedBaseForm?.semester || 'First',
    });
    setCourseList(baseCourses);
    setBaseCourseCodes(new Set(baseCourses.map((course) => course.courseCode.toUpperCase())));
    setNewCourseCode('');
    setNewCourseTitle('');
    setShowForm(true);
  };

  const addCourse = () => {
    if (!newCourseCode.trim() || !newCourseTitle.trim()) {
      toast.error('Please fill in both course code and title');
      return;
    }
    if (courseList.some(c => c.courseCode.toUpperCase() === newCourseCode.toUpperCase())) {
      toast.error('This course code already exists');
      return;
    }
    setCourseList([...courseList, { courseCode: newCourseCode.toUpperCase(), courseTitle: newCourseTitle }]);
    setNewCourseCode('');
    setNewCourseTitle('');
  };

  const removeCourse = (index: number) => {
    setCourseList(courseList.filter((_, idx) => idx !== index));
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedForm(null);
    setCourseList([]);
    setBaseCourseCodes(new Set());
    setNewCourseCode('');
    setNewCourseTitle('');
    setFormData({
      faculty: user?.faculty || '',
      courseOfStudy: user?.courseOfStudy || '',
      level: user?.level || '',
      academicYear: defaultAcademicYear,
      semester: 'First',
    });
  };

  const handleCreateOrUpdate = async () => {
    if (!studentId) {
      toast.error('Student is not selected');
      return;
    }
    if (courseList.length === 0) {
      toast.error('Please add at least one course');
      return;
    }
    try {
      const data: Partial<CourseFormData> = {
        studentId,
        faculty: formData.faculty,
        courseOfStudy: formData.courseOfStudy,
        level: formData.level,
        academicYear: formData.academicYear,
        semester: formData.semester,
        courses: courseList,
      };
      if (selectedForm?._id) {
        await courseFormService.updateCourseForm(selectedForm._id, data);
        toast.success('Student course form updated');
      } else {
        await courseFormService.createCourseForm(data);
        toast.success('Student course form created');
      }
      resetForm();
      await loadStudentFormData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save form');
    }
  };

  const handleSubmitForm = async (id: string) => {
    try {
      await courseFormService.submitCourseForm(id);
      toast.success('Course form submitted');
      await loadStudentFormData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit form');
    }
  };

  const handleDeleteForm = async (id: string) => {
    if (!confirm('Delete this course form?')) return;
    try {
      await courseFormService.deleteCourseForm(id);
      toast.success('Course form deleted');
      await loadStudentFormData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete form');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      draft: { color: 'bg-slate-100 text-slate-700', label: 'Draft' },
      submitted: { color: 'bg-blue-100 text-blue-700', label: 'Submitted' },
      approved: { color: 'bg-green-100 text-green-700', label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-700', label: 'Rejected' },
    };
    return badges[status] || badges.draft;
  };

  if (!isLevelAdviser && !isClassRep) {
    return (
      <div className="text-center py-16">
        <AlertCircle size={36} className="mx-auto text-slate-400 mb-4" />
        <p className="text-slate-600">You do not have access to edit student course forms.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-slate-600">Loading student course forms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-3xl font-bold text-slate-900 mt-4">Student Course Form</h1>
          <p className="text-slate-600 mt-1">
            Manage course registration on behalf of {student?.fullName || 'this student'}.
          </p>
        </div>
      
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-3">Student</p>
          <p className="text-lg font-semibold text-slate-900">{student?.fullName || 'Student'}</p>
          {student?.email && <p className="text-sm text-slate-500 mt-1">{student.email}</p>}
          <div className="mt-4 text-sm text-slate-600 space-y-1">
            <p><span className="font-semibold">Level:</span> {student?.level || formData.level || 'N/A'}</p>
            <p><span className="font-semibold">Course of study:</span> {student?.courseOfStudy || formData.courseOfStudy || 'N/A'}</p>
            <p><span className="font-semibold">Student ID:</span> {studentId}</p>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-3">Help</p>
          <p className="text-sm text-slate-700">
            Use this page to add or update a student&apos;s course form for overload, carry-over, or other special cases.
          </p>
         
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="relative w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-sm font-medium text-slate-500">{selectedForm ? 'Edit' : 'Create'} Course Form</p>
                <h2 className="text-2xl font-semibold text-slate-900">{student?.fullName || 'Student'}</h2>
              </div>
              <button onClick={resetForm} className="p-2 rounded-full text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label text-sm font-medium">Academic Year</label>
                  <input
                    type="text"
                    value={formData.academicYear}
                    onChange={e => setFormData({ ...formData, academicYear: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label text-sm font-medium">Semester</label>
                  <select
                    value={formData.semester}
                    onChange={e => setFormData({ ...formData, semester: e.target.value })}
                    className="input"
                  >
                    <option value="First">First</option>
                    <option value="Second">Second</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Add Course</h3>
                <div className="grid gap-3 sm:grid-cols-2 mb-3">
                  <div>
                    <label className="label text-sm font-medium">Course Code</label>
                    <input
                      type="text"
                      value={newCourseCode}
                      onChange={e => updateCourseCode(e.target.value)}
                      list="student-course-code-suggestions"
                      className="input"
                      placeholder="EDT 401"
                    />
                    <datalist id="student-course-code-suggestions">
                      {courseSuggestions.map((course) => (
                        <option key={course.courseCode} value={course.courseCode}>
                          {course.courseTitle}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="label text-sm font-medium">Course Title</label>
                    <input
                      type="text"
                      value={newCourseTitle}
                      onChange={e => setNewCourseTitle(e.target.value)}
                      className="input"
                      placeholder="Advanced Algorithms"
                    />
                  </div>
                </div>
                <button onClick={addCourse} className="btn-primary w-full">
                  <Plus size={16} /> Add Course
                </button>
              </div>

              {courseList.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Selected Courses ({courseList.length})</h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {courseList.map((course, idx) => {
                      const isBaseCourse = baseCourseCodes.has(course.courseCode.toUpperCase());
                      return (
                        <div key={idx} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div>
                            <p className="font-medium text-slate-900">{course.courseCode}</p>
                            <p className="text-sm text-slate-600">{course.courseTitle}</p>
                            {isBaseCourse && (
                              <p className="text-xs text-slate-500 mt-1">Base department course (cannot remove)</p>
                            )}
                          </div>
                          {!isBaseCourse ? (
                            <button onClick={() => removeCourse(idx)} className="text-red-600 hover:text-red-700">
                              <Trash2 size={16} />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={resetForm} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button onClick={handleCreateOrUpdate} className="btn-primary w-full sm:w-auto" disabled={courseList.length === 0}>
                {selectedForm ? 'Update Form' : 'Create Form'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {departmentForms.length > 0 && (
          <div className="space-y-3">
            <button
              onClick={() => setDepartmentOpen(!departmentOpen)}
              className="flex w-full items-center justify-between rounded-3xl border border-slate-200 bg-white px-5 py-4 text-left text-slate-800 shadow-sm hover:bg-slate-50 transition"
            >
              <div>
                <p className="text-sm text-slate-500">Normal Department Course Forms</p>
                <p className="text-lg font-semibold">{departmentForms.length} base form{departmentForms.length !== 1 ? 's' : ''}</p>
                <p className="text-sm text-slate-500 mt-1">These are the base forms for the student&apos;s level and department.</p>
              </div>
              <span className="text-sm text-primary-600">{departmentOpen ? 'Hide' : 'Show'}</span>
            </button>

            {departmentOpen && (
              <div className="space-y-4">
                {departmentForms.map((form) => {
                  const badge = getStatusBadge(form.status);
                  return (
                    <div key={form._id || `${form.academicYear}-${form.semester}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm text-slate-500">{form.semester} Semester • {form.academicYear}</p>
                          <h3 className="text-xl font-semibold text-slate-900 mt-1">{form.faculty} • {form.courseOfStudy}</h3>
                          <p className="text-sm text-slate-500 mt-1">Level {form.level}</p>
                        </div>
                        <div className="flex flex-col gap-2 sm:items-end">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badge.color}`}>
                            {badge.label}
                          </span>
                          <button
                            onClick={() => openNewForm(form)}
                            className="btn-primary inline-flex items-center gap-2"
                          >
                            <Plus size={14} /> Add student-specific courses
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {Array.isArray(form.courses) && form.courses.map((course: any, idx: number) => (
                          <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="font-medium text-slate-900">{course.courseCode}</p>
                            {course.courseTitle && <p className="text-xs text-slate-600 mt-1">{course.courseTitle}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

   
      </div>
    </div>
  );
}
