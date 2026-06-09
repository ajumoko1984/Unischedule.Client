import api from './api';

export interface UserSummary {
  _id: string;
  fullName: string;
  email?: string;
  role?: string;
}

export const userService = {
  // Search lecturers by name
  searchLecturers: async (search = '', limit = 20): Promise<UserSummary[]> => {
    try {
      const params: Record<string, any> = { limit };
      if (search) params.search = search;
      const res = await api.get('/search/lecturers', { params });
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) return data;
      return [];
    } catch (err) {
      console.error('userService.searchLecturers failed', err);
      return [];
    }
  },
  
  // Search users by query and optional role filter
  searchUsers: async (query = '', role?: string): Promise<UserSummary[]> => {
    try {
      // Use optimized lecturer search endpoint when available
      if (role === 'lecturer') {
        return userService.searchLecturers(query);
      }
      
      const params: Record<string, any> = {};
      if (query) params.q = query;
      if (role) params.role = role;
      const res = await api.get('/users', { params });
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) return data;
      return [];
    } catch (err) {
      console.error('userService.searchUsers failed', err);
      return [];
    }
  },
  // Get single user by id
  getUserById: async (id: string): Promise<UserSummary | null> => {
    try {
      const res = await api.get(`/users/${id}`);
      const data = res.data?.data || res.data;
      if (!data) return null;
      // If API returns an object with data wrapper or the user object directly
      return Array.isArray(data) ? data[0] || null : data;
    } catch (err) {
      console.error('userService.getUserById failed', err);
      return null;
    }
  },
};
