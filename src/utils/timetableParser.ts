/**
 * Timetable Parser - Converts timetable data from various formats
 * to the exam creation format expected by the backend
 */

import { Exam } from "../types";

export interface TimetableSlot {
  day: string;
  time: string;
  courses: CourseEntry[];
}

export interface CourseEntry {
  code: string;
  students?: number;
  batches?: string;
}

export interface ParsedExam {
  title: string;
  courseCode: string;
  courseTitle: string;
  examType: 'cbt' | 'written';
  duration: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  totalMarks?: number;
  semester: string;
  academicYear: string;
}

/**
 * Parse course code to extract code and student count
 * e.g., "GNS312(10256)" → { code: "GNS312", students: 10256 }
 */
export function parseCourseCode(input: string): CourseEntry {
  const match = input.match(/([A-Z0-9]+)\s*\(?(\d+)?\)?/);
  return {
    code: match?.[1] || input,
    students: match?.[2] ? parseInt(match[2]) : undefined,
  };
}

/**
 * Parse time range to start and end times
 * e.g., "11am-12pm" → { startTime: "11:00", endTime: "12:00" }
 */
export function parseTimeRange(timeStr: string): { startTime: string; endTime: string } {
  const normalized = timeStr.toLowerCase().replace(/\s+/g, '').replace(/[.]/g, '');
  const timeRegex = /(\d{1,2})(?::(\d{2}))?(am|pm)?[\s-]*(\d{1,2})(?::(\d{2}))?(am|pm)?/i;
  const match = normalized.match(timeRegex);

  if (!match) {
    return { startTime: '09:00', endTime: '10:00' };
  }

  const convertTo24h = (hour: number, meridiem: string | undefined, nextMeridiem?: string): number => {
    // If meridiem is not specified, check nextMeridiem
    const period = meridiem?.toLowerCase() || nextMeridiem?.toLowerCase() || 'am';
    let h = hour;
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return h;
  };

  const startHour = convertTo24h(parseInt(match[1]), match[3], match[6]);
  const startMin = match[2] ? parseInt(match[2]) : 0;
  const endHour = convertTo24h(parseInt(match[4]), match[6]);
  const endMin = match[5] ? parseInt(match[5]) : 0;

  return {
    startTime: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
    endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
  };
}

/**
 * Parse date string to ISO format
 * e.g., "Monday, 20th April, 2026" → "2026-04-20"
 */
export function parseDateString(dateStr: string): string {
  // Remove ordinal suffixes (st, nd, rd, th)
  const normalized = dateStr.replace(/(\d+)(st|nd|rd|th)/i, '$1');

  // Try various date formats
  const formats = [
    /(\d{1,2})\s+([a-z]+)\s+(\d{4})/i, // "20 April 2026"
    /([a-z]+)\s+(\d{1,2})\s+(\d{4})/i, // "April 20 2026"
  ];

  for (const format of formats) {
    const match = normalized.match(format);
    if (match) {
      const months: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      };

      let day: number, month: number, year: number;

      if (isNaN(parseInt(match[1]))) {
        // "April 20 2026" format
        month = months[match[1].toLowerCase()];
        day = parseInt(match[2]);
        year = parseInt(match[3]);
      } else {
        // "20 April 2026" format
        day = parseInt(match[1]);
        month = months[match[2].toLowerCase()];
        year = parseInt(match[3]);
      }

      const date = new Date(year, month - 1, day);
      return date.toISOString().split('T')[0];
    }
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Convert tabular CSV timetable to exam format
 * Expected format (from University of Ilorin):
 * Day,Date,11am-12:00pm,12-1:00pm,1-2:00pm,2-3:00pm,3-4:00pm,4-5:00pm
 * Monday DAY 1,20th April 2026,"GNS312/GNS114 (10256) BATCH 1: EDUCATION",...
 */
export function parseTabularCSV(csvContent: string, semester: string, academicYear: string): ParsedExam[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header to get time slots
  const headerCells = parseCSVLine(lines[0]);
  if (headerCells.length < 3) return [];

  const dayCol = headerCells[0];
  const dateCol = headerCells[1];
  const timeSlots = headerCells.slice(2); // Time slot columns

  const exams: ParsedExam[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells.length < 3) continue;

    const day = cells[0]?.trim() || '';
    const date = cells[1]?.trim() || '';
    const scheduleDate = parseDateString(date);

    // Process each time slot
    for (let timeIdx = 0; timeIdx < timeSlots.length; timeIdx++) {
      const timeSlot = timeSlots[timeIdx].trim();
      const courseCell = cells[2 + timeIdx]?.trim() || '';

      // Skip empty cells or special markers like "JUMAT"
      if (!courseCell || courseCell.toLowerCase() === 'jumat') continue;

      // Handle pipe-separated courses
      const courses = courseCell.split('|').map(c => c.trim()).filter(c => c);

      for (const course of courses) {
        const { startTime, endTime } = parseTimeRange(timeSlot);
        const duration = calculateDuration(startTime, endTime);

        // Extract course code and batch info
        const courseEntry = parseCourseCodeWithBatch(course);

        exams.push({
          title: courseEntry.code,
          courseCode: courseEntry.code,
          courseTitle: courseEntry.batchInfo || courseEntry.code,
          examType: 'cbt',
          duration,
          date: scheduleDate,
          startTime,
          endTime,
          location: 'CBT CENTRE',
          totalMarks: 100,
          semester,
          academicYear,
        });
      }
    }
  }

  return exams;
}

/**
 * Parse CSV line respecting quoted fields
 * e.g., "Day","Date","11am-12:00pm" → ["Day", "Date", "11am-12:00pm"]
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Parse course code with batch information
 * e.g., "GNS312/GNS114 (10256) BATCH 1: EDUCATION, ARTS, SOCIAL SCI."
 * → { code: "GNS312/GNS114", students: 10256, batchInfo: "BATCH 1: EDUCATION, ARTS, SOCIAL SCI." }
 */
export function parseCourseCodeWithBatch(input: string): { code: string; students?: number; batchInfo?: string } {
  // Extract course code (before any parenthesis or special chars)
  const codeMatch = input.match(/^([A-Z0-9\/-]+)/);
  const code = codeMatch?.[1]?.trim() || input;

  // Extract student count
  const studentMatch = input.match(/\((\d+)\)/);
  const students = studentMatch ? parseInt(studentMatch[1]) : undefined;

  // Extract batch info (after the parenthesis with student count)
  const batchMatch = input.match(/BATCH\s+\d+[^|]*/i);
  const batchInfo = batchMatch ? batchMatch[0].trim() : undefined;

  return { code, students, batchInfo };
}

/**
 * Convert CSV timetable to exam format
 * Expected CSV format:
 * Day,Time,CourseCode,CourseTitle,StudentCount
 */
export function parseCSV(csvContent: string, semester: string, academicYear: string): ParsedExam[] {
  const lines = csvContent.trim().split('\n');
  
  // Detect if it's tabular format by checking headers
  const firstLine = lines[0];
  const headerCells = parseCSVLine(firstLine);
  
  // If header has time-like columns (contains 'am' or 'pm' or 'hr'), it's tabular format
  const isTabular = headerCells.some((cell, idx) => 
    idx > 1 && (cell.includes('am') || cell.includes('pm') || cell.includes('hr'))
  );
  
  if (isTabular) {
    return parseTabularCSV(csvContent, semester, academicYear);
  }

  // Otherwise, parse as simple format
  const exams: ParsedExam[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length < 4) continue;

    const [day, time, courseCode, courseTitle, studentCount] = parts;
    const { startTime, endTime } = parseTimeRange(time);
    const scheduleDate = parseDateString(day);
    const duration = calculateDuration(startTime, endTime);

    exams.push({
      title: courseTitle || courseCode,
      courseCode,
      courseTitle: courseTitle || courseCode,
      examType: 'cbt',
      duration,
      date: scheduleDate,
      startTime,
      endTime,
      location: 'CBT CENTRE',
      totalMarks: 100,
      semester,
      academicYear,
    });
  }

  return exams;
}

/**
 * Calculate duration in minutes between two times
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  return Math.max(end - start, 60);
}

/**
 * Parse JSON timetable data
 */
export function parseJSON(jsonData: any, semester: string, academicYear: string): ParsedExam[] {
  const exams: ParsedExam[] = [];

  if (!Array.isArray(jsonData)) {
    jsonData = [jsonData];
  }

  for (const entry of jsonData) {
    if (entry.slots && Array.isArray(entry.slots)) {
      const scheduleDate = parseDateString(entry.day);

      for (const slot of entry.slots) {
        const { startTime, endTime } = parseTimeRange(slot.time);
        const duration = calculateDuration(startTime, endTime);

        if (slot.courses && Array.isArray(slot.courses)) {
          for (const course of slot.courses) {
            const courseEntry = typeof course === 'string' ? parseCourseCode(course) : course;

            exams.push({
              title: courseEntry.code,
              courseCode: courseEntry.code,
              courseTitle: courseEntry.code,
              examType: 'cbt',
              duration,
              date: scheduleDate,
              startTime,
              endTime,
              location: 'CBT CENTRE',
              totalMarks: 100,
              semester,
              academicYear,
            });
          }
        }
      }
    }
  }

  return exams;
}

/**
 * Generic parse function - detects format and parses accordingly
 */
export function parseTimetable(
  data: string | any,
  format: 'json' | 'csv' | 'auto',
  semester: string,
  academicYear: string
): ParsedExam[] {
  if (format === 'json' || (format === 'auto' && typeof data !== 'string')) {
    const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
    return parseJSON(jsonData, semester, academicYear);
  }

  if (format === 'csv' || (format === 'auto' && data.includes(','))) {
    return parseCSV(data as string, semester, academicYear);
  }

  // Default to JSON parsing
  try {
    const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
    return parseJSON(jsonData, semester, academicYear);
  } catch {
    return parseCSV(data as string, semester, academicYear);
  }
}


/**
 * Convert a ParsedExam entry to the Exam shape expected by the backend
 */
export function convertToExamData(
  entry: ParsedExam,
  overrides?: Partial<ParsedExam> & { [key: string]: any }
): Partial<Exam> {
  return {
    courseCode: entry.courseCode,
    courseTitle: entry.courseTitle || entry.courseCode,
    examType: overrides?.examType || entry.examType || 'cbt',
    duration: entry.duration,
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    location: overrides?.location || entry.location || 'CBT CENTRE',
    totalMarks: entry.totalMarks ?? 100,
    academicYear: entry.academicYear,
    title: entry.title || entry.courseCode,
  };
}

/**
 * Example timetable data for testing
 */
export const EXAMPLE_TIMETABLE = {
  json: [
    {
      day: "Monday, 20th April, 2026",
      slots: [
        {
          time: "11am-12pm",
          courses: ["GNS312(10256)", "GNS312(10256)"],
        },
        {
          time: "12pm-1pm",
          courses: ["GET210(1200)", "ACC204(900)"],
        },
      ],
    },
    {
      day: "Tuesday, 21st April, 2026",
      slots: [
        {
          time: "11am-12pm",
          courses: ["EDU316(2321)", "ISS202(341)"],
        },
      ],
    },
  ],
  csv: `Day,Time,CourseCode,CourseTitle,StudentCount
Monday, 20th April 2026,11am-12pm,GNS312,General Studies,10256
Monday, 20th April 2026,12pm-1pm,GET210,Educational Technology,1200
Tuesday, 21st April 2026,11am-12pm,EDU316,Educational Systems,2321`,
};
