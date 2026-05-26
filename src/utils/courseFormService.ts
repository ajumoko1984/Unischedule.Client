import api from './api';

export interface Course {
  courseCode: string;
  courseTitle: string;
}

export interface CourseFormData {
  _id?: string;
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
