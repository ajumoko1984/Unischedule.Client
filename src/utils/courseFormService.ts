import api from './api';

const normalizeCourseCode = (value: any) =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';

const extractStudentId = (studentId: any) => {
  if (!studentId) return null;
  if (typeof studentId === 'string') return studentId;
  return studentId._id || studentId?.id || null;
};

const parseCourseFormsResponse = (data: any) => {
  return Array.isArray(data)
    ? data
    : Array.isArray(data?.forms)
      ? data.forms
      : Array.isArray(data?.data)
        ? data.data
        : [];
};

const buildStudentCounts = (forms: any[], courseCodes: string[]) => {
  const normalizedCodes = new Set(courseCodes.map(code => normalizeCourseCode(code)).filter(Boolean));
  const counts = new Map<string, Set<string>>();

  for (const form of forms) {
    const studentId = extractStudentId(form.studentId);
    if (!studentId || !Array.isArray(form.courses)) continue;

    const uniqueId = studentId.toString();
    for (const course of form.courses) {
      const code = normalizeCourseCode(typeof course === 'string' ? course : course.courseCode);
      if (!code || !normalizedCodes.has(code)) continue;

      if (!counts.has(code)) counts.set(code, new Set());
      counts.get(code)?.add(uniqueId);
    }
  }

  const result: Record<string, number> = {};
  normalizedCodes.forEach((code) => {
    result[code] = counts.get(code)?.size || 0;
  });
  return result;
};

export interface Course {
  courseCode: string;
  courseTitle: string;
}

export interface CourseFormData {
  _id?: string;
  studentId?: string;
  student?: { _id: string; fullName: string; email?: string };
  faculty: string;
  courseOfStudy: string;
  level: string;
  academicYear: string;
  semester: string;
  courses: Course[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  createdAt?: string;
  updatedAt?: string;
}

export const courseFormService = {
  // Student endpoints - view only
  getMyCourseforms: async (filters?: { faculty?: string; courseOfStudy?: string; level?: string; academicYear?: string; semester?: string; status?: string }) =>
    api.get('/course-forms', { params: filters }),

  getApprovedCourseForm: async () =>
    api.get('/course-forms/my-approved'),

  getCourseFormById: async (id: string) =>
    api.get(`/course-forms/${id}`),

  getCourseFormsByStudent: async (studentId: string) =>
    api.get('/course-forms', { params: { studentId } }),

  getApprovedCourseForms: async (filters?: { studentId?: string; faculty?: string; courseOfStudy?: string; level?: string; academicYear?: string; semester?: string }) =>
    api.get('/course-forms', { params: { ...filters, status: 'approved' } }),

  getStudentsByCourse: async (courseCode: string, filters?: { faculty?: string; courseOfStudy?: string; level?: string }) => {
    const normalizedCode = normalizeCourseCode(courseCode);
    if (!normalizedCode) {
      return Promise.resolve({ data: { count: 0, students: [] } } as any);
    }
    return api.get(`/course-forms/course/${encodeURIComponent(normalizedCode)}/students`, { params: filters });
  },

  countStudentsByCourseCodes: async (courseCodes: string[], filters?: { faculty?: string; courseOfStudy?: string; level?: string }) => {
    if (!courseCodes?.length) return {} as Record<string, number>;

    const promises = courseCodes.map(async (code) => {
      const normalizedCode = normalizeCourseCode(code);
      if (!normalizedCode) return { code: normalizedCode, count: 0 };

      try {
        const res = await api.get(`/course-forms/course/${encodeURIComponent(normalizedCode)}/students`, { params: filters });
        const data = res.data;
        const count = typeof data?.count === 'number' ? data.count : Array.isArray(data) ? data.length : 0;
        return { code: normalizedCode, count };
      } catch (error: any) {
        if (error.response?.status === 404) {
          return { code: normalizedCode, count: 0 };
        }
        throw error;
      }
    });

    const results = await Promise.allSettled(promises);
    return courseCodes.reduce((acc, code, index) => {
      const normalizedCode = normalizeCourseCode(code);
      const result = results[index];
      if (result.status === 'fulfilled') {
        acc[normalizedCode] = result.value.count;
      } else {
        acc[normalizedCode] = 0;
      }
      return acc;
    }, {} as Record<string, number>);
  },

  countStudentsByCourseCode: async (courseCode: string, filters?: { faculty?: string; courseOfStudy?: string; level?: string }) => {
    if (!courseCode?.trim()) return 0;
    const normalizedCode = normalizeCourseCode(courseCode);
    try {
      const res = await api.get(`/course-forms/course/${encodeURIComponent(normalizedCode)}/students`, { params: filters });
      const data = res.data;
      if (typeof data?.count === 'number') return data.count;
      return Array.isArray(data) ? data.length : 0;
    } catch (error: any) {
      if (error.response?.status === 404) return 0;
      throw error;
    }
  },

  // Level Adviser & Class Rep endpoints - manage forms
  createCourseForm: async (data: Partial<CourseFormData>) =>
    api.post('/course-forms', data),

  updateCourseForm: async (id: string, data: Partial<CourseFormData>) =>
    api.put(`/course-forms/${id}`, data),

  submitCourseForm: async (id: string) =>
    api.post(`/course-forms/${id}/submit`, {}),

  getAllCourseForms: async (filters?: { studentId?: string; faculty?: string; courseOfStudy?: string; level?: string; academicYear?: string; semester?: string; status?: string }) =>
    api.get('/course-forms', { params: filters }),

  // Admin endpoints - approve/reject
  approveCourseForm: async (id: string) =>
    api.post(`/course-forms/${id}/approve`, {}),

  rejectCourseForm: async (id: string, reason?: string) =>
    api.post(`/course-forms/${id}/reject`, { reason }),

  // Delete endpoint
  deleteCourseForm: async (id: string) =>
    api.delete(`/course-forms/${id}`),
};
