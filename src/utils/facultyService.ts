import api from './api';

export interface Faculty {
  id: string;
  name: string;
}

export interface FacultyResponse {
  success: boolean;
  count: number;
  faculties: Faculty[];
}

export interface DepartmentsResponse {
  success: boolean;
  facultyId: string;
  count: number;
  departments: string[];
}

export const facultyService = {
  // Get all faculties
  getFaculties: async (): Promise<Faculty[]> => {
    try {
      const res = await api.get<FacultyResponse>('/auth/faculties');
      return res.data.faculties || [];
    } catch (err) {
      console.error('Failed to fetch faculties:', err);
      return [];
    }
  },

  // Get departments for a specific faculty
  getDepartments: async (facultyId: string): Promise<string[]> => {
    try {
      const res = await api.get<DepartmentsResponse>(`/auth/departments/${facultyId}`);
      return res.data.departments || [];
    } catch (err) {
      console.error(`Failed to fetch departments for ${facultyId}:`, err);
      return [];
    }
  },
};
