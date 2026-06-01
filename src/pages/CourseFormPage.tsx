import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Check, X, Download, Upload, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { courseFormService, CourseFormData, Course } from '../utils/courseFormService';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export default function CourseFormPage() {
  const { user, isLevelAdviser } = useAuth();
  const [courseForms, setCourseForms] = useState<CourseFormData[]>([]);
  const [viewMode, setViewMode] = useState<'department' | 'student'>('department');
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingForm, setEditingForm] = useState<CourseFormData | null>(null);
  const [formData, setFormData] = useState({
    faculty: user?.faculty || '',
    courseOfStudy: user?.courseOfStudy || '',
    level: user?.level || '',
    academicYear: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
    semester: 'First',
  });
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');

  const courseCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    courseForms.forEach((form) => {
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
  }, [courseForms, courseList]);

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
    if (isLevelAdviser) {
      loadCourseForms();
    }
  }, [isLevelAdviser]);

  const addCourse = () => {
    if (!newCourseCode.trim() || !newCourseTitle.trim()) {
      toast.error('Please fill in both course code and title');
      return;
    }
    
    // Check for duplicates
    if (courseList.some(c => c.courseCode.toUpperCase() === newCourseCode.toUpperCase())) {
      toast.error('This course code already exists');
      return;
    }

    setCourseList([...courseList, { courseCode: newCourseCode.toUpperCase(), courseTitle: newCourseTitle }]);
    setNewCourseCode('');
    setNewCourseTitle('');
  };

  const removeCourse = (index: number) => {
    setCourseList(courseList.filter((_, i) => i !== index));
  };

  const loadCourseForms = async () => {
    try {
      setIsLoading(true);
      const res = await courseFormService.getAllCourseForms({
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
      }
      
      // Note: Backend already filters approved forms for class reps
      setCourseForms(forms);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load course forms');
      setCourseForms([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!user?.faculty || !user?.level) {
      toast.error('Your profile is incomplete. Please contact an administrator.');
      return;
    }

    if (courseList.length === 0) {
      toast.error('Please add at least one course');
      return;
    }

    try {
      const data = {
        faculty: user.faculty,
        courseOfStudy: user.courseOfStudy,
        level: user.level,
        courses: courseList,
        academicYear: formData.academicYear,
        semester: formData.semester,
      };

      if (editingForm) {
        await courseFormService.updateCourseForm(editingForm._id!, data);
        toast.success('Course form updated');
      } else {
        await courseFormService.createCourseForm(data);
        toast.success('Course form created');
      }

      resetForm();
      await loadCourseForms();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save course form');
    }
  };

  const handleSubmitForm = async (id: string) => {
    try {
      await courseFormService.submitCourseForm(id);
      toast.success('Course form submitted!');
      await loadCourseForms();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit form');
    }
  };

  const handleDeleteForm = async (id: string) => {
    if (!confirm('Delete this course form?')) return;
    try {
      await courseFormService.deleteCourseForm(id);
      toast.success('Course form deleted successfully');
      await loadCourseForms();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete form');
    }
  };

  const handleEdit = (form: CourseFormData) => {
    setEditingForm(form);
    setFormData({
      faculty: form.faculty || '',
      courseOfStudy: form.courseOfStudy || '',
      level: form.level || '',
      academicYear: form.academicYear,
      semester: form.semester,
    });
    // Note: courses should already have code and title from backend
    setCourseList(Array.isArray(form.courses) ? form.courses : []);
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingForm(null);
    setFormData({
      faculty: user?.faculty || '',
      courseOfStudy: user?.courseOfStudy || '',
      level: user?.level || '',
      academicYear: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
      semester: 'First',
    });
    setCourseList([]);
    setNewCourseCode('');
    setNewCourseTitle('');
  };

  const departmentForms = courseForms.filter((form) => !form.studentId);
  const studentForms = courseForms.filter((form) => !!form.studentId);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      draft: { color: 'bg-slate-100 text-slate-700', label: 'Draft' },
      submitted: { color: 'bg-blue-100 text-blue-700', label: 'Submitted' },
      approved: { color: 'bg-green-100 text-green-700', label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-700', label: 'Rejected' },
    };
    const badge = badges[status] || badges.draft;
    return badge;
  };

  if (!isLevelAdviser) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={32} className="mx-auto text-slate-400 mb-3" />
        <p className="text-slate-600">You don't have permission to access this page</p>
      </div>
    );
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Course Forms</h1>
          <p className="text-slate-600 mt-1">
            {isLevelAdviser ? 'Create and manage course forms for your level' : 'View course forms for your level'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLevelAdviser && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              <Plus size={18} />
              New Course Form
            </button>
          )}
          <div>
            <label className="label text-sm font-medium text-slate-700">View</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'department' | 'student')}
              className="input w-full sm:w-auto"
            >
              <option value="department">Department course forms</option>
              <option value="student">Student-specific forms</option>
            </select>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              {editingForm ? 'Edit Course Form' : 'Create Course Form'}
            </h2>
            
            {/* Info Box - Show user's level details */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-700">
                <span className="font-semibold">Faculty:</span> {formData.faculty}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                <span className="font-semibold">Course of Study:</span> {formData.courseOfStudy}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                <span className="font-semibold">Level:</span> {formData.level}
              </p>
            </div>

            <div className="space-y-4">
              {/* Academic Year & Semester */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-sm font-medium">Academic Year</label>
                  <input
                    type="text"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label text-sm font-medium">Semester</label>
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    className="input"
                  >
                    <option value="First">First</option>
                    <option value="Second">Second</option>
                  </select>
                </div>
              </div>

              {/* Add Course Section */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Add Courses for {formData.level} Level</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="label text-sm font-medium">Course Code</label>
                    <input
                      type="text"
                      value={newCourseCode}
                      onChange={(e) => updateCourseCode(e.target.value)}
                      list="course-code-suggestions"
                      className="input"
                      placeholder="e.g., EDT 401"
                    />
                    <datalist id="course-code-suggestions">
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
                      onChange={(e) => setNewCourseTitle(e.target.value)}
                      className="input"
                      placeholder="e.g., Advanced Algorithms"
                    />
                  </div>
                </div>
                <button
                  onClick={addCourse}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                >
                  <Plus size={16} className="inline mr-2" />
                  Add Course
                </button>
              </div>

              {/* Courses List */}
              {courseList.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">
                    Selected Courses ({courseList.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {courseList.map((course, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{course.courseCode}</p>
                          <p className="text-sm text-slate-600">{course.courseTitle}</p>
                        </div>
                        <button
                          onClick={() => removeCourse(idx)}
                          className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded transition"
                          title="Remove course"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 mt-6 border-t pt-4">
              <button
                onClick={resetForm}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrUpdate}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-slate-400"
                disabled={courseList.length === 0}
              >
                {editingForm ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Course Forms List */}
      <div className="space-y-4">
        {(viewMode === 'department' ? departmentForms : studentForms).map((form) => {
          const badge = getStatusBadge(form.status);
          return (
            <div
              key={form._id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800">{form.faculty} - {form.courseOfStudy}</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Level {form.level} | {form.semester} Semester {form.academicYear}
                  </p>
                  {form.student?.fullName && (
                    <p className="text-sm text-slate-500 mt-1">Student: {form.student.fullName}</p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                  {badge.label}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Courses ({form.courses.length}):</p>
                <div className="space-y-2">
                  {form.courses.map((course: any, idx: number) => (
                    <div key={idx} className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="font-medium text-slate-800 text-sm">{typeof course === 'string' ? course : course.courseCode}</p>
                      {typeof course === 'object' && course.courseTitle && (
                        <p className="text-xs text-slate-600">{course.courseTitle}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-200">
                {isLevelAdviser && (
                  <>
                    <button
                      onClick={() => handleEdit(form)}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                    {form.status === 'draft' && (
                      <button
                        onClick={() => handleSubmitForm(form._id!)}
                        className="flex items-center gap-1 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition"
                      >
                        <Check size={14} />
                        Submit
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteForm(form._id!)}
                      className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition ml-auto"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(viewMode === 'department' ? departmentForms : studentForms).length === 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
          <AlertCircle size={40} className="mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">
            {viewMode === 'department' ? 'No department course forms yet' : 'No student-specific course forms yet'}
          </h3>
          <p className="text-slate-600">
            {viewMode === 'department'
              ? 'Create a department course form or switch to student-specific view.'
              : 'Student-specific forms will appear here once students have added extra courses.'}
          </p>
        </div>
      )}
    </div>
  );
}
