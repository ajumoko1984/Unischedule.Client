import api from './api';

export interface SMSNotification {
  recipientPhones: string[];
  message: string;
  type: 'exam_reminder' | 'venue_change' | 'test_reminder' | 'assignment_deadline' | 'study_session';
  examId?: string;
  courseCode?: string;
  additionalData?: Record<string, any>;
}

export interface NotificationPayload {
  subject?: string;
  message: string;
  type: 'exam_update' | 'exam_reminder' | 'venue_change' | 'test_reminder' | 'assignment_deadline' | 'study_session';
  courseCode?: string;
  examId?: string;
  faculty?: string;
  level?: string;
  courseOfStudy?: string;
  sendEmail?: boolean;
  sendSMS?: boolean;
  recipientPhones?: string[];
}

export const smsService = {
  // Send SMS to individual students for exam reminder
  sendExamReminder: async (examId: string, recipientPhones: string[], examDetails: {
    courseCode: string;
    courseTitle: string;
    date: string;
    startTime: string;
    venue: string;
  }) => {
    const message = `${examDetails.courseCode} ${examDetails.courseTitle} exam reminder: ${examDetails.date} at ${examDetails.startTime} in ${examDetails.venue}`;
    return api.post('/notifications/sms/send', {
      recipientPhones,
      message,
      type: 'exam_reminder',
      examId,
      courseCode: examDetails.courseCode,
    } as SMSNotification);
  },

  // Send SMS for venue change
  sendVenueChangeNotification: async (examId: string, recipientPhones: string[], details: {
    courseCode: string;
    newVenue: string;
    oldVenue: string;
  }) => {
    const message = `${details.courseCode} exam venue changed from ${details.oldVenue} to ${details.newVenue}`;
    return api.post('/notifications/sms/send', {
      recipientPhones,
      message,
      type: 'venue_change',
      examId,
      courseCode: details.courseCode,
    } as SMSNotification);
  },

  // Send SMS for test reminder
  sendTestReminder: async (recipientPhones: string[], testDetails: {
    courseCode: string;
    courseTitle: string;
    date: string;
    startTime: string;
  }) => {
    const message = `${testDetails.courseCode} test reminder: ${testDetails.date} at ${testDetails.startTime}`;
    return api.post('/notifications/sms/send', {
      recipientPhones,
      message,
      type: 'test_reminder',
      courseCode: testDetails.courseCode,
    } as SMSNotification);
  },

  // Send SMS for assignment deadline
  sendAssignmentDeadlineReminder: async (recipientPhones: string[], assignmentDetails: {
    courseCode: string;
    deadline: string;
  }) => {
    const message = `${assignmentDetails.courseCode} assignment deadline: ${assignmentDetails.deadline}`;
    return api.post('/notifications/sms/send', {
      recipientPhones,
      message,
      type: 'assignment_deadline',
      courseCode: assignmentDetails.courseCode,
    } as SMSNotification);
  },

  // Send SMS for study session reminder
  sendStudySessionReminder: async (recipientPhones: string[], sessionDetails: {
    topic: string;
    date: string;
    startTime: string;
    location: string;
  }) => {
    const message = `Study session reminder: ${sessionDetails.topic} on ${sessionDetails.date} at ${sessionDetails.startTime} in ${sessionDetails.location}`;
    return api.post('/notifications/sms/send', {
      recipientPhones,
      message,
      type: 'study_session',
    } as SMSNotification);
  },

  // Send SMS to lecturer about assigned exam
  sendLecturerAssignmentNotification: async (recipientPhone: string, examDetails: {
    courseCode: string;
    courseTitle: string;
    date: string;
    startTime: string;
    venue: string;
    studentPopulation: number;
  }) => {
    const message = `You are assigned as invigilator for ${examDetails.courseCode}: ${examDetails.date} at ${examDetails.startTime} in ${examDetails.venue} (${examDetails.studentPopulation} students)`;
    return api.post('/notifications/sms/send', {
      recipientPhones: [recipientPhone],
      message,
      type: 'exam_reminder',
      courseCode: examDetails.courseCode,
    } as SMSNotification);
  },

  // Generic SMS send
  sendSMS: async (recipientPhones: string[], message: string, type: string, additionalData?: Record<string, any>) => {
    return api.post('/notifications/sms/send', {
      recipientPhones,
      message,
      type,
      ...additionalData,
    } as SMSNotification);
  },
};
