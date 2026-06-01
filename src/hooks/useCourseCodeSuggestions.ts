import { useMemo } from 'react';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { courseFormService } from '../utils/courseFormService';

export interface CourseCodeSuggestion {
  courseCode: string;
  courseTitle: string;
}

const parseCourseForms = (data: any): CourseCodeSuggestion[] => {
  const forms = Array.isArray(data)
    ? data
    : Array.isArray(data?.forms)
      ? data.forms
      : Array.isArray(data?.data)
        ? data.data
        : [];

  const map = new Map<string, string>();
  forms.forEach((form: any) => {
    if (!Array.isArray(form.courses)) return;
    form.courses.forEach((course: any) => {
      const code = (typeof course === 'string' ? course : course.courseCode || '').toString().trim().toUpperCase();
      const title = typeof course === 'string' ? '' : (course.courseTitle || '').toString().trim();
      if (!code) return;
      if (!map.has(code) || (!map.get(code) && title)) {
        map.set(code, title);
      }
    });
  });

  return Array.from(map.entries())
    .map(([courseCode, courseTitle]) => ({ courseCode, courseTitle }))
    .sort((a, b) => a.courseCode.localeCompare(b.courseCode));
};

export function useCourseCodeSuggestions(): UseQueryResult<CourseCodeSuggestion[], Error> & {
  courseCodeMap: Map<string, string>;
  suggestions: CourseCodeSuggestion[];
} {
  const { user } = useAuth();

  const query = useQuery<CourseCodeSuggestion[], Error>({
    queryKey: ['course-code-suggestions', user?.role, user?._id, user?.faculty, user?.courseOfStudy, user?.level],
    queryFn: async () => {
      const res = await courseFormService.getAllCourseForms({
        faculty: user?.faculty,
        courseOfStudy: user?.courseOfStudy,
        level: user?.level,
      });
      const baseCourses = parseCourseForms(res.data);

      if (user?.role === 'student') {
        const studentRes = await courseFormService.getAllCourseForms({ studentId: user._id, status: 'approved' });
        const studentCourses = parseCourseForms(studentRes.data);
        const merged = new Map<string, CourseCodeSuggestion>();

        [...baseCourses, ...studentCourses].forEach((course) => {
          if (!merged.has(course.courseCode) || (!merged.get(course.courseCode)?.courseTitle && course.courseTitle)) {
            merged.set(course.courseCode, course);
          }
        });

        return Array.from(merged.values()).sort((a, b) => a.courseCode.localeCompare(b.courseCode));
      }

      return baseCourses;
    },
    enabled: Boolean(user),
    staleTime: 1000 * 60 * 5,
  });

  const data = query.data ?? [] as CourseCodeSuggestion[];
  const courseCodeMap = useMemo(
    () => new Map<string, string>(data.map((item) => [item.courseCode, item.courseTitle])),
    [data],
  );

  return {
    ...query,
    courseCodeMap,
    suggestions: data,
  };
}
