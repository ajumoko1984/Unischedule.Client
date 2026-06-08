import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { academicCalendarService } from '../utils/academicCalendarService';
import { AcademicCalendarEvent } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

const EVENT_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  semester_start: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900' },
  semester_end: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900' },
  exam_period_start: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900' },
  exam_period_end: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900' },
  public_holiday: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900' },
  registration_period: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900' },
  break: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900' },
  other: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900' },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  semester_start: 'Semester Start',
  semester_end: 'Semester End',
  exam_period_start: 'Exam Period Start',
  exam_period_end: 'Exam Period End',
  public_holiday: 'Public Holiday',
  registration_period: 'Registration Period',
  break: 'Break',
  other: 'Event',
};

export default function AcademicCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const currentYear = currentMonth.getFullYear();
  const academicYear = currentMonth.getMonth() >= 7 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;

  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ['academic-calendar', academicYear],
    queryFn: () => academicCalendarService.getPublishedEvents(academicYear),
    staleTime: 1000 * 60 * 10,
  });

  // Parse events and create a map for quick lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, AcademicCalendarEvent[]>();
    events.forEach(event => {
      const startDate = parseISO(event.startDate);
      const endDate = parseISO(event.endDate);
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(event);
      });
    });
    return map;
  }, [events]);

  // Get events for selected date
  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedDateEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) || [] : [];

  // Calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = monthStart.getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);
  const calendarDays = [...emptyDays, ...days];

  const goToPreviousMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const goToNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  const goToToday = () => setCurrentMonth(new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Academic Calendar</h1>
        <p className="text-sm text-slate-600">Important university dates and deadlines for {academicYear}</p>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <p>Failed to load academic calendar. Please try again later.</p>
        </div>
      )}

      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700 text-center">
          Loading academic calendar...
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-900">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={goToPreviousMonth}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={goToToday}
                  className="px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={goToNextMonth}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-semibold text-slate-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="aspect-square" />;
                
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isDayToday = isToday(day);

                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDate(isDayToday && selectedDate ? null : day)}
                    className={`aspect-square p-1 rounded-lg border-2 transition-all ${
                      isCurrentMonth ? 'bg-white' : 'bg-slate-50 opacity-50'
                    } ${
                      isDayToday ? 'border-primary-600 ring-2 ring-primary-200' : 'border-slate-200 hover:border-slate-300'
                    } ${
                      selectedDate && format(selectedDate, 'yyyy-MM-dd') === dateKey ? 'ring-2 ring-primary-400 bg-primary-50' : ''
                    }`}
                  >
                    <div className="text-xs font-medium text-slate-700 mb-0.5">{format(day, 'd')}</div>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 flex-wrap">
                        {dayEvents.slice(0, 2).map((_, i) => (
                          <div
                            key={i}
                            className="w-1 h-1 rounded-full"
                            style={{
                              backgroundColor: dayEvents[i].color || '#3b82f6',
                            }}
                          />
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[8px] text-slate-500">+{dayEvents.length - 2}</div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Events Sidebar */}
          <div className="space-y-4">
            {/* Legend */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900 mb-3 text-sm">Event Types</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: Object.values(EVENT_TYPE_COLORS[type])[0].includes('50') ? '#9ca3af' : '#3b82f6' }}
                    />
                    <span className="text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Date Events */}
            {selectedDate && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900 mb-3">
                  {format(selectedDate, 'MMMM d, yyyy')}
                </h3>
                {selectedDateEvents.length === 0 ? (
                  <p className="text-sm text-slate-500">No events scheduled</p>
                ) : (
                  <div className="space-y-3">
                    {selectedDateEvents.map(event => {
                      const colors = EVENT_TYPE_COLORS[event.type];
                      return (
                        <div
                          key={event._id}
                          className={`${colors.bg} border ${colors.border} rounded-lg p-3`}
                        >
                          <p className={`font-semibold text-sm ${colors.text} mb-1`}>
                            {event.title}
                          </p>
                          <p className={`text-xs ${colors.text} opacity-75 mb-1`}>
                            {EVENT_TYPE_LABELS[event.type]}
                          </p>
                          {event.description && (
                            <p className={`text-xs ${colors.text} opacity-75`}>
                              {event.description}
                            </p>
                          )}
                          {event.semester && (
                            <p className={`text-xs ${colors.text} opacity-75 mt-1`}>
                              {event.semester} Semester
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Upcoming Events */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Upcoming Events</h3>
              {events.filter(e => new Date(e.startDate) >= currentMonth).length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming events</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {events
                    .filter(e => new Date(e.startDate) >= currentMonth)
                    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                    .slice(0, 5)
                    .map(event => {
                      const colors = EVENT_TYPE_COLORS[event.type];
                      return (
                        <div
                          key={event._id}
                          className={`${colors.bg} border ${colors.border} rounded p-2 text-xs`}
                        >
                          <p className={`font-semibold ${colors.text} mb-0.5`}>{event.title}</p>
                          <p className={`${colors.text} opacity-75`}>
                            {format(parseISO(event.startDate), 'MMM d')}
                            {event.startDate !== event.endDate && ` - ${format(parseISO(event.endDate), 'MMM d')}`}
                          </p>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
