import api from './api';
import { AcademicCalendarEvent } from '../types';

export const academicCalendarService = {
  // Get all published academic calendar events
  getPublishedEvents: async (academicYear?: string): Promise<AcademicCalendarEvent[]> => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academicYear', academicYear);
    const res = await api.get(`/academic-calendar/published?${params.toString()}`);
    const data = (res.data as any);
    return Array.isArray(data) ? data : data?.data || [];
  },

  // Get all academic calendar events (admin only)
  getAllEvents: async (academicYear?: string): Promise<AcademicCalendarEvent[]> => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academicYear', academicYear);
    const res = await api.get(`/academic-calendar?${params.toString()}`);
    const data = (res.data as any);
    return Array.isArray(data) ? data : data?.data || [];
  },

  // Create academic calendar event (super admin only)
  createEvent: async (data: Partial<AcademicCalendarEvent>) => {
    return api.post<AcademicCalendarEvent>('/academic-calendar', data);
  },

  // Update academic calendar event (super admin only)
  updateEvent: async (id: string, data: Partial<AcademicCalendarEvent>) => {
    return api.put<AcademicCalendarEvent>(`/academic-calendar/${id}`, data);
  },

  // Delete academic calendar event (super admin only)
  deleteEvent: async (id: string) => {
    return api.delete(`/academic-calendar/${id}`);
  },

  // Publish academic calendar event (make it visible to all users)
  publishEvent: async (id: string) => {
    return api.post(`/academic-calendar/${id}/publish`, {});
  },

  // Unpublish academic calendar event
  unpublishEvent: async (id: string) => {
    return api.post(`/academic-calendar/${id}/unpublish`, {});
  },
};
