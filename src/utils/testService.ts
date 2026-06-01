import api from './api';

export interface TestData {
  _id?: string;
  courseCode: string;
  courseTitle: string;
  testType: 'cbt' | 'written' | 'practical' | 'oral';
  scheduleDate: string;
  startTime: string;
  endTime: string;
  venue?: string;
  location?: string;
  invigilators: string[];
  instructions?: string;
  faculty?: string;
  level?: string;
  courseOfStudy?: string;
  semester?: string;
  academicYear?: string;
  students: string[];
  status?: string;
}

export const testService = {
  createTest: async (data: Partial<TestData>) => api.post('/tests', data),

  getMyTests: async () => {
    const res = await api.get('/tests/my-tests');
    const raw = Array.isArray(res.data) ? res.data : (res.data?.tests || res.data?.data || []);
    const mapped = raw.map((t: any) => ({
      ...t,
      scheduleDate: t.scheduleDate || t.date || null,
      venue: t.venue || t.location || '',
    }));
    return { ...res, data: mapped } as any;
  },

  getTestsByType: async (testType: string, academicYear?: string) => {
    const params: any = {};
    if (academicYear) params.academicYear = academicYear;
    const res = await api.get(`/tests/type/${encodeURIComponent(testType)}`, { params });
    const raw = Array.isArray(res.data) ? res.data : (res.data?.tests || res.data?.data || []);
    const mapped = raw.map((t: any) => ({
      ...t,
      scheduleDate: t.scheduleDate || t.date || null,
      venue: t.venue || t.location || '',
    }));
    return { ...res, data: mapped } as any;
  },

  getTestById: async (id: string) => api.get(`/tests/${id}`),
  updateTest: async (id: string, data: Partial<TestData>) => api.put(`/tests/${id}`, data),
  deleteTest: async (id: string) => api.delete(`/tests/${id}`),
  publishTest: async (id: string) => api.post(`/tests/${id}/publish`, {}),
  addStudentsToTest: async (testId: string, studentIds: string[]) =>
    api.post(`/tests/${testId}/add-students`, { studentIds }),
  removeStudentsFromTest: async (testId: string, studentIds: string[]) =>
    api.post(`/tests/${testId}/remove-students`, { studentIds }),
};