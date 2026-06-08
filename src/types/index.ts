export type UserRole = 'super_admin' | 'level_adviser' | 'class_rep' | 'student' | 'exam_officer' | 'lecturer';

export interface User {
  _id: string;
  fullName: string;
  email: string;
  role: UserRole;
  faculty: string;
  level?: string;
  courseOfStudy?: string;
  matricNumber?: string;
  phone?: string;
  isActive?: boolean;
  createdAt?: string;
}

export type ExamType = 'cbt' | 'written' | 'practical' | 'oral';
export type ExamStatus = 'draft' | 'published' | 'scheduled' | 'ongoing' | 'completed';
export type TestType = 'cbt' | 'written' | 'practical' | 'oral';
export type TestStatus = 'draft' | 'published' | 'scheduled' | 'ongoing' | 'completed';

export interface Exam {
  _id: string;
  title: string;
  courseCode: string;
  courseTitle: string;
  examType: ExamType;
  duration: number; // in minutes
  totalMarks: number;
  date?: string; // ISO date
  scheduleDate?: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  location?: string; // Auto-set to "CBT CENTRE" for CBT exams
  venue?: string;
  invigilators: string[]; // Lecturers invigilating
  instructions?: string;
  faculty: string;
  level: string;
  courseOfStudy: string;
  semester: Semester;
  academicYear: string;
  studentPopulation?: number;
  students: string[]; // Student IDs registered for exam
  status: ExamStatus;
  createdBy: { _id: string; fullName: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface Test {
  _id: string;
  courseCode: string;
  courseTitle: string;
  testType: TestType; // 'cbt' | 'written'
  scheduleDate?: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  venue?: string;
  location?: string;
  invigilators: string[]; // Invigilators/proctors
  instructions?: string;
  faculty: string;
  level: string;
  courseOfStudy: string;
  semester: Semester;
  academicYear: string;
  students: string[]; // Student IDs registered for test
  status: TestStatus;
  createdBy: { _id: string; fullName: string };
  createdAt?: string;
  updatedAt?: string;
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
  department: string;
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
  department: string;
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

// Academic Calendar - University-wide events
export type AcademicEventType = 'semester_start' | 'semester_end' | 'exam_period_start' | 'exam_period_end' | 'public_holiday' | 'registration_period' | 'break' | 'other';

export interface AcademicCalendarEvent {
  _id: string;
  title: string;
  description?: string;
  type: AcademicEventType;
  startDate: string; // ISO date
  endDate: string; // ISO date
  semester?: Semester;
  academicYear: string;
  isPublished: boolean;
  color?: string; // For UI display
  createdBy: { _id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
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

// ── Study Planner ─────────────────────────────────────────────────────────────
export type StudyTaskStatus = 'pending' | 'in_progress' | 'completed' | 'missed';

export interface StudyTask {
  _id: string;
  courseCode: string;
  courseTitle: string;
  task: string;
  scheduledAt: string;
  durationMinutes: number;
  status: StudyTaskStatus;
  reminderSent: boolean;
  completedAt?: string;
  notes?: string;
}

export interface StudyPlan {
  _id: string;
  owner: string;
  level: string;
  courseOfStudy: string;
  tasks: StudyTask[];
  createdAt: string;
  updatedAt: string;
}

// ── Assignment Tracker ────────────────────────────────────────────────────────
export type AssignmentStatus   = 'pending' | 'in_progress' | 'completed' | 'overdue';
export type AssignmentPriority = 'low' | 'medium' | 'high';

export interface Assignment {
  _id: string;
  owner: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  description?: string;
  deadline: string;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  completedAt?: string;
  reminderSent: boolean;
  level: string;
  courseOfStudy: string;
  createdAt: string;
}

// ── Weekly Summary ────────────────────────────────────────────────────────────
export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  study: { total: number; completed: number; missed: number };
  assignments: { total: number; completed: number; overdue: number };
  courseProgress: { courseCode: string; courseTitle: string; percent: number; completed: number; total: number }[];
  message: string;
}