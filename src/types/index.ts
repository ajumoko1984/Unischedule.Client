export type UserRole = 'super_admin' | 'level_adviser' | 'class_rep' | 'student';

export interface User {
  _id: string;
  fullName: string;
  email: string;
  role: UserRole;
  faculty: string;
  level: string;
  courseOfStudy: string;
  matricNumber?: string;
  isActive?: boolean;
  createdAt?: string;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export type SlotType = 'lecture' | 'lab' | 'test' | 'exam' | 'seminar' | 'other';
export type Semester = 'First' | 'Second';

export interface VenueHistory {
  venue: string;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

export interface TimetableSlot {
  _id: string;
  courseCode: string;
  courseTitle: string;
  lecturer: string;
  venue: string;
  venueHistory: VenueHistory[];
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  type: SlotType;
  color?: string;
}

export interface Timetable {
  _id: string;
  title: string;
  faculty: string;
  level: string;
  courseOfStudy: string;
  semester: Semester;
  academicYear: string;
  slots: TimetableSlot[];
  createdBy: { _id: string; fullName: string; role: UserRole };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EventCategory = 'test' | 'exam' | 'assignment' | 'project' | 'other';
export type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface CalendarEvent {
  _id: string;
  title: string;
  courseCode: string;
  courseTitle: string;
  category: EventCategory;
  date: string;
  startTime: string;
  endTime?: string;
  venue: string;
  description?: string;
  faculty: string;
  level: string;
  courseOfStudy: string;
  semester: string;
  academicYear: string;
  status: EventStatus;
  emailSent: boolean;
  emailSentAt?: string;
  reminderSent: boolean;
  createdBy: { _id: string; fullName: string; role: UserRole };
  createdAt: string;
}

export type NotificationType = 'venue_change' | 'new_event' | 'reminder' | 'announcement' | 'cancellation';

export interface Notification {
  _id: string;
  type: NotificationType;
  subject: string;
  message: string;
  recipientCount: number;
  sentBy: { _id: string; fullName: string; role: UserRole };
  isAutomatic: boolean;
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'partial';
  createdAt: string;
}

export interface DashboardStats {
  totalStudents: number;
  upcomingTests: number;
  upcomingExams: number;
  recentNotifications: Notification[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}
