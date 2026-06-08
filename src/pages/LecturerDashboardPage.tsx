import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Clock, MapPin, Users, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Exam } from '../types';
import { examService } from '../utils/examService';

export default function LecturerDashboardPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'assigned'>('all');

  const { data: allExams = [], isLoading, isError } = useQuery<Exam[]>({
    queryKey: ['published-lecturer-exams', user?._id],
    queryFn: async () => {
      const res = await examService.getPublishedExams();
      return Array.isArray(res.data) ? res.data : res.data?.exams || res.data?.data || [];
    },
    enabled: !!user && user.role === 'lecturer',
    staleTime: 1000 * 60 * 5,
  });

  const searchTerm = searchQuery.trim().toLowerCase();
  const filteredExams = useMemo(() => {
    return allExams.filter(exam => {
      if (exam.status !== 'published') return false;
      const code = (exam.courseCode || '').toLowerCase();
      const title = (exam.courseTitle || '').toLowerCase();
      const matchesSearch = !searchTerm || code.includes(searchTerm) || title.includes(searchTerm);
      if (!matchesSearch) return false;

      if (viewMode === 'assigned') {
        return exam.invigilators?.some(inv => inv === user?.fullName || inv === user?._id);
      }

      return true;
    });
  }, [allExams, searchTerm, viewMode, user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-blue-100 text-blue-700';
      case 'scheduled': return 'bg-amber-100 text-amber-700';
      case 'ongoing': return 'bg-red-100 text-red-700';
      case 'completed': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const ExamCard = ({ exam }: { exam: Exam }) => (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{exam.courseCode}</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">{exam.courseTitle}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider ${getStatusColor(exam.status)}`}>
          {exam.status.replace('_', ' ')}
        </span>
      </div>

      <div className="space-y-2">
        {/* Date & Time */}
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Clock size={16} className="text-slate-400 flex-shrink-0" />
          <div>
            <span className="font-medium">
              {exam.scheduleDate ? format(parseISO(exam.scheduleDate), 'PPP') : 'TBA'}
            </span>
            <span className="text-slate-600 ml-2">
              {exam.startTime} — {exam.endTime}
            </span>
          </div>
        </div>

        {/* Venue */}
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <MapPin size={16} className="text-slate-400 flex-shrink-0" />
          <span className="font-medium">{exam.venue || exam.location || 'TBA'}</span>
        </div>

        {/* Student Population */}
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Users size={16} className="text-slate-400 flex-shrink-0" />
          <span className="font-medium">
            {exam.studentPopulation ? `${exam.studentPopulation} students expected` : 'Student count TBA'}
          </span>
        </div>

        {/* Exam Type */}
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Type:</span>
          <span className="font-medium capitalize">{exam.examType}</span>
        </div>

        {/* Instructions */}
        {exam.instructions && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
            <p className="font-semibold text-blue-700 mb-1">Instructions:</p>
            <p>{exam.instructions}</p>
          </div>
        )}
      </div>

      {/* Meta info */}
      <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] text-slate-500">
        <p>Faculty: <span className="font-medium text-slate-700">{exam.faculty}</span></p>
        <p>Level: <span className="font-medium text-slate-700">{exam.level}</span> • {exam.courseOfStudy}</p>
      </div>
    </article>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invigilator Exam List</h1>
          <p className="text-sm text-slate-600">Browse published exams and filter to your assigned exams.</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            type="search"
            className="input w-full md:w-72"
            placeholder="Search by course code or title"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="input w-full md:w-64"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'all' | 'assigned')}
          >
            <option value="all">All published exams</option>
            <option value="assigned">Assigned exams</option>
          </select>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <p>Failed to load your exams. Please try again later.</p>
        </div>
      )}

      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700 text-center">
          Loading your exams...
        </div>
      )}

      {!isLoading && !isError && (
        filteredExams.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-slate-700 text-center">
            <Users size={48} className="mx-auto text-slate-400 mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              {viewMode === 'assigned' ? 'No assigned published exams found' : 'No published exams found'}
            </h2>
            <p className="text-slate-600">
              {viewMode === 'assigned'
                ? 'Try switching to All published exams or update your assigned invigilator list.'
                : 'Try refining your search.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredExams.map(exam => (
              <ExamCard key={exam._id} exam={exam} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
