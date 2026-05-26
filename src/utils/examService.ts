import api from './api';
import { Exam } from '../types';

export const examService = {
  // Exam Officer - Create & Manage Exams
  createExam: async (data: Partial<Exam>) => api.post('/exams', data),
  
  // Normalize backend fields so frontend can rely on `scheduleDate` and `venue`
  getMyExams: async () => {
    const res = await api.get('/exams/my-exams');
    const raw = Array.isArray(res.data) ? res.data : (res.data?.exams || res.data?.data || []);
    const mapped = raw.map((e: any) => ({
      ...e,
      scheduleDate: e.scheduleDate || e.date || null,
      venue: e.venue || e.location || '',
    }));
    return { ...res, data: mapped } as any;
  },
  
  getExamById: async (id: string) => 
    api.get(`/exams/${id}`),
  
  updateExam: async (id: string, data: Partial<Exam>) => 
    api.put(`/exams/${id}`, data),
  
  deleteExam: async (id: string) => 
    api.delete(`/exams/${id}`),
  
  publishExam: async (id: string) => 
    api.post(`/exams/${id}/publish`, {}),
  
  addStudentsToExam: async (examId: string, studentIds: string[]) => 
    api.post(`/exams/${examId}/add-students`, { studentIds }),
  
  removeStudentsFromExam: async (examId: string, studentIds: string[]) => 
    api.post(`/exams/${examId}/remove-students`, { studentIds }),
  
  // Bulk import exams
  bulkCreateExams: async (exams: Partial<Exam>[], semester?: string, academicYear?: string) =>
    api.post('/exams/bulk/json', { 
      timetableData: exams,
      semester: semester || 'First',
      academicYear: academicYear || '2025/2026'
    }).then(r => r.data),
  
  // Student - View Timetable by Course
  getExamsByCourse: async (courseCode: string) => 
    api.get(`/exams/course?courseCode=${courseCode}`),
};

