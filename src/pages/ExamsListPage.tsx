import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { examService } from '../utils/examService';
import { Exam } from '../types';
import { useAuth } from '../context/AuthContext';

export default function ExamsListPage() {
  const { user } = useAuth();

  const { data: exams = [], isLoading, isError } = useQuery<Exam[]>({
    queryKey: ['my-exams', user?.role, user?._id],
    queryFn: async () => {
      const res = await examService.getMyExams();
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      return raw as Exam[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Exam Timetable</h1>
          <p className="text-sm text-slate-500">View your upcoming exams and schedule details.</p>
        </div>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700">Loading exams...</div>
      )}

      {isError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          Failed to load exams. Please try again later.
        </div>
      )}

      {!isLoading && exams.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
          No exams were found for your account.
        </div>
      )}

      <div className="grid gap-4">
        {exams.map(exam => (
          <article key={exam._id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{exam.courseCode}</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{exam.courseTitle}</h2>
                <p className="mt-2 text-sm text-slate-600">{exam.title}</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                {exam.status.replace('_', ' ')}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Date</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {exam.scheduleDate ? format(parseISO(exam.scheduleDate), 'PPP') : 'TBA'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Time</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {exam.startTime} — {exam.endTime}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Venue</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{exam.venue || exam.location || 'TBA'}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
