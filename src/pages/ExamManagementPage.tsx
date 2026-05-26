import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Calendar, Clock, MapPin, AlertCircle, FileUp, Bell, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { examService } from '../utils/examService';
import { Exam, Semester } from '../types';
import { format } from 'date-fns';
import BulkImportModal from '../components/BulkImportModal';

const EXAM_TYPES = [
  { value: 'cbt', label: 'CBT Test', venue: 'CBT CENTRE' },
  { value: 'written', label: 'Written Exam', venue: 'Custom' },
  { value: 'practical', label: 'Practical Exam', venue: 'Custom' },
  { value: 'oral', label: 'Oral Exam', venue: 'Custom' },
];

const SEMESTERS = ['First', 'Second'];

const getCurrentAcademicYear = (dateString?: string) => {
  const date = dateString ? new Date(dateString) : new Date();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

const getCurrentSemester = (dateString?: string): Semester => {
  const date = dateString ? new Date(dateString) : new Date();
  const month = date.getMonth() + 1;
  return (month >= 8 || month <= 1) ? 'First' : 'Second';
};

export default function ExamManagementPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examsQueue, setExamsQueue] = useState<Partial<Exam>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingAll, setIsCreatingAll] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationForm, setNotificationForm] = useState({ examId: '', courseCode: '', subject: '', message: '' });
  const [newExam, setNewExam] = useState<Partial<Exam>>({
    courseCode: '',
    courseTitle: '',
    examType: 'written',
    scheduleDate: '',
    startTime: '09:00',
    endTime: '11:00',
    venue: '',
  });

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      setIsLoading(true);
      const res = await examService.getMyExams();
      // Handle different response structures from API
      const examsData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setExams(examsData);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load exams');
    } finally {
      setIsLoading(false);
    }
  };

const handleSaveExam = async () => {
  if (!newExam.courseCode || !newExam.courseTitle || !newExam.venue || !newExam.scheduleDate || !newExam.startTime || !newExam.endTime) {
    toast.error('Please fill in all required fields: Course Code, Title, Venue, Date, and Times');
    return;
  }

  const examData = {
    courseCode: newExam.courseCode.toUpperCase().trim(),
    courseTitle: newExam.courseTitle.trim(),
    examType: newExam.examType,
    venue: newExam.examType === 'cbt' ? 'CBT CENTRE' : newExam.venue,
    scheduleDate: newExam.scheduleDate,
    startTime: newExam.startTime,
    endTime: newExam.endTime,
    semester: getCurrentSemester(newExam.scheduleDate) as Semester,
    academicYear: getCurrentAcademicYear(newExam.scheduleDate),
  };

  try {
    if (editingExam) {
      await examService.updateExam(editingExam._id!, examData as any);
      toast.success('Exam updated!');
      // If this exam is already published, notify students about the update
      if (editingExam.status === 'published') {
        try {
          await api.post('/notifications/course', {
            subject: `Exam updated: ${examData.courseCode}`,
            message: `There has been an update to the ${examData.courseCode} exam. Please check your timetable for the latest date, time and venue.`,
            courseCode: examData.courseCode,
            type: 'exam_update',
            examId: editingExam._id,
            faculty: editingExam.faculty,
            level: editingExam.level,
            courseOfStudy: editingExam.courseOfStudy,
          });
          toast.success('Students notified about the update.');
        } catch (err: any) {
          // don't block on notification failures
          console.error('Failed to notify students:', err);
        }
      }
      await loadExams();
    } else {
      setExamsQueue(prev => [...prev, examData as Partial<Exam>]);
      toast.success('Exam added to queue. Once created, use the bell icon to notify students.');
    }
    resetForm();
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Failed to save exam');
  }
};

  const handleCreateAllExams = async () => {
    if (examsQueue.length === 0) return;

    try {
      setIsCreatingAll(true);
      let successCount = 0;
      const errors: string[] = [];

      for (const exam of examsQueue) {
        try {
          await examService.createExam(exam as any);
          successCount++;
        } catch (err: any) {
          errors.push(`${exam.courseCode}: ${err.response?.data?.message || 'Failed to create'}`);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} exam${successCount > 1 ? 's' : ''} created!`);
        setExamsQueue([]);
        await loadExams();
      }

      if (errors.length > 0) {
        toast.error(`${errors.length} exam${errors.length > 1 ? 's' : ''} failed. Check logs.`);
        errors.forEach(e => console.error(e));
      }
    } catch (err: any) {
      toast.error('Failed to create exams');
    } finally {
      setIsCreatingAll(false);
    }
  };

  const removeFromQueue = (index: number) => {
    setExamsQueue(examsQueue.filter((_, i) => i !== index));
    toast.success('Exam removed from queue');
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm('Delete this exam?')) return;
    try {
      await examService.deleteExam(id);
      toast.success('Exam deleted');
      await loadExams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete exam');
    }
  };

  const handlePublishExam = async (id: string) => {
    try {
      await examService.publishExam(id);
      toast.success('Exam published! Now visible to students.');
      // Fetch exam details to include course code in the announcement
      try {
        const res = await examService.getExamById(id);
        const exam = res.data?.data || res.data;
        await api.post('/notifications/course', {
          subject: `Exam published: ${exam.courseCode}`,
          message: `The exam for ${exam.courseCode} has been published. Check your timetable for date, time and venue details.`,
          courseCode: exam.courseCode,
          type: 'exam_update',
          examId: id,
          faculty: exam.faculty,
          level: exam.level,
          courseOfStudy: exam.courseOfStudy,
        });
        toast.success('Students notified about the published exam.');
      } catch (err: any) {
        console.error('Failed to auto-notify on publish:', err);
      }
      await loadExams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to publish exam');
    }
  };

  const handleSendExamNotification = async () => {
    try {
      const { examId, courseCode, subject, message } = notificationForm;
      if (!subject.trim() || !message.trim()) {
        toast.error('Please provide a subject and message before sending.');
        return;
      }
      // Fetch exam details to get faculty, level, courseOfStudy
      const res = await examService.getExamById(examId);
      const exam = res.data?.data || res.data;
      await api.post('/notifications/course', {
        subject,
        message,
        courseCode,
        type: 'exam_update',
        examId,
        faculty: exam.faculty,
        level: exam.level,
        courseOfStudy: exam.courseOfStudy,
      });
      toast.success('Notification sent to students taking this course');
      setShowNotificationModal(false);
      setNotificationForm({ examId: '', courseCode: '', subject: '', message: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send notification');
    }
  };

  const clearForm = () => {
    setNewExam({
      courseCode: '',
      courseTitle: '',
      examType: 'written',
      scheduleDate: '',
      startTime: '09:00',
      endTime: '11:00',
      venue: '',
    });
    setEditingExam(null);
  };

  const resetForm = () => {
    setShowForm(false);
    clearForm();
  };

  const set = (field: string, value: any) => {
    if (field === 'examType' && value === 'cbt') {
      setNewExam((s: any) => ({ ...s, [field]: value, venue: 'CBT CENTRE' }));
    } else {
      setNewExam((s: any) => ({ ...s, [field]: value }));
    }
  };

  const draftExams = exams.filter(e => e.status === 'draft');
  const publishedExams = exams.filter(e => e.status !== 'draft');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-slate-600">Loading exams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Exam Management</h1>
          <p className="text-slate-600 mt-1">Create and manage exam timetables for students</p>
        </div>
        <div className="flex gap-2">
    
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary gap-2">
            <Plus size={18} /> New Exam
          </button>
        </div>
      </div>

      {/* Bulk Import Modal */}
      <BulkImportModal 
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onSuccess={loadExams}
      />

      {/* Create/Edit Exam Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold mb-4">{editingExam ? 'Edit Exam' : 'Create New Exam'}</h2>
          <div className="space-y-4">
            
            {/* Course Code & Title */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-sm font-medium">Course Code *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., EDT401"
                  value={newExam.courseCode || ''}
                  onChange={(e) => set('courseCode', e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="label text-sm font-medium">Course Title *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Advanced Educational Technology"
                  value={newExam.courseTitle || ''}
                  onChange={(e) => set('courseTitle', e.target.value)}
                />
              </div>
            </div>

            {/* Exam Type & Venue */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-sm font-medium">Exam Type *</label>
                <select
                  className="input"
                  value={newExam.examType || 'written'}
                  onChange={(e) => set('examType', e.target.value)}
                >
                  {EXAM_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label text-sm font-medium">
                  Venue / Location *
                  {newExam.examType === 'cbt' && <span className="text-xs text-slate-500 ml-2">(Auto: CBT CENTRE)</span>}
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={newExam.examType === 'cbt' ? 'CBT CENTRE' : 'e.g., Lecture Hall A'}
                  value={newExam.venue || ''}
                  disabled={newExam.examType === 'cbt'}
                  onChange={(e) => set('venue', e.target.value)}
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="label text-sm font-medium">Exam Date *</label>
              <input
                type="date"
                className="input"
                value={newExam.scheduleDate ? newExam.scheduleDate.split('T')[0] : ''}
                onChange={(e) => set('scheduleDate', e.target.value)}
              />
            </div>

            {/* Start & End Times */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-sm font-medium">Start Time *</label>
                <input
                  type="time"
                  className="input"
                  value={newExam.startTime || ''}
                  onChange={(e) => set('startTime', e.target.value)}
                />
              </div>
              <div>
                <label className="label text-sm font-medium">End Time *</label>
                <input
                  type="time"
                  className="input"
                  value={newExam.endTime || ''}
                  onChange={(e) => set('endTime', e.target.value)}
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSaveExam}
                className="btn-primary flex-1 gap-2"
              >
                <Plus size={16} /> {editingExam ? 'Save Exam' : 'Add to Batch'}
              </button>
              <button
                onClick={resetForm}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exam Queue */}
      {examsQueue.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Exam Batch</h2>
              <p className="text-sm text-slate-500">Add multiple exams and create them together.</p>
            </div>
            <button
              onClick={handleCreateAllExams}
              disabled={isCreatingAll}
              className="btn-primary"
            >
              {isCreatingAll ? 'Creating...' : `Create ${examsQueue.length} Exam${examsQueue.length > 1 ? 's' : ''}`}
            </button>
          </div>
          <div className="space-y-3">
            {examsQueue.map((exam, idx) => (
              <div key={`${exam.courseCode}-${idx}`} className="border border-slate-200 rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-800">{exam.courseCode}</p>
                    <p className="text-sm text-slate-600">{exam.courseTitle}</p>
                    <p className="text-xs text-slate-500 mt-1">{exam.scheduleDate} • {exam.startTime} - {exam.endTime}</p>
                  </div>
                  <button
                    onClick={() => removeFromQueue(idx)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draft Exams */}
      {draftExams.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-800">Draft Exams</h2>
          <div className="space-y-3">
            {draftExams.map(exam => (
              <div key={exam._id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-slate-800">{exam.courseCode}</h3>
                      <span className="text-sm text-slate-600">— {exam.courseTitle}</span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                        {exam.examType.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} /> {exam.scheduleDate ? format(new Date(exam.scheduleDate), 'MMM dd, yyyy') : 'N/A'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} /> {exam.startTime} - {exam.endTime}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin size={14} /> {exam.venue}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingExam(exam);
                        setNewExam(exam);
                        setShowForm(true);
                      }}
                      className="px-3 py-2 text-sm bg-primary-100 text-primary-600 rounded-lg hover:bg-primary-200"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setNotificationForm({
                          examId: exam._id!,
                          courseCode: exam.courseCode,
                          subject: `Update: ${exam.courseCode} Exam Details`,
                          message: `Please note that there has been an update to the ${exam.courseCode} exam. Review the new date, time, or venue and contact your level adviser if necessary.`,
                        });
                        setShowNotificationModal(true);
                      }}
                      className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                    >
                      <Bell size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteExam(exam._id)}
                      className="px-3 py-2 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      onClick={() => handlePublishExam(exam._id)}
                      className="px-4 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium"
                    >
                      Publish
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Published Exams */}
      {publishedExams.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-800">Published Exams</h2>
          <div className="space-y-3">
            {publishedExams.map(exam => (
              <div key={exam._id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-slate-800">{exam.courseCode}</h3>
                      <span className="text-sm text-slate-600">— {exam.courseTitle}</span>
                      <span className="px-2 py-1 bg-green-200 text-green-700 text-xs font-medium rounded">
                        {exam.examType.toUpperCase()}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        Published
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} /> {exam.scheduleDate ? format(new Date(exam.scheduleDate), 'MMM dd, yyyy') : 'N/A'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} /> {exam.startTime} - {exam.endTime}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin size={14} /> {exam.venue}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setEditingExam(exam);
                        setNewExam(exam);
                        setShowForm(true);
                      }}
                      className="px-3 py-2 text-sm bg-primary-100 text-primary-600 rounded-lg hover:bg-primary-200"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setNotificationForm({
                          examId: exam._id!,
                          courseCode: exam.courseCode,
                          subject: `Update: ${exam.courseCode} Exam Details`,
                          message: `Please note that the ${exam.courseCode} exam has been updated. Review the new schedule and venue.`,
                        });
                        setShowNotificationModal(true);
                      }}
                      className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                    >
                      <Bell size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteExam(exam._id)}
                      className="px-3 py-2 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowNotificationModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-modal p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Notify {notificationForm.courseCode}</h2>
              <button onClick={() => setShowNotificationModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label text-sm font-medium">Subject</label>
                <input
                  className="input w-full"
                  value={notificationForm.subject}
                  onChange={(e) => setNotificationForm(f => ({ ...f, subject: e.target.value }))}
                />
              </div>
              <div>
                <label className="label text-sm font-medium">Message</label>
                <textarea
                  className="input w-full min-h-[140px] resize-none"
                  value={notificationForm.message}
                  onChange={(e) => setNotificationForm(f => ({ ...f, message: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  onClick={() => setShowNotificationModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendExamNotification}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg"
                >
                  Send Notification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {exams.length === 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
          <AlertCircle size={40} className="mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No exams created yet</h3>
          <p className="text-slate-600 mb-6">Create your first exam to get started with the timetable</p>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="btn-primary gap-2 mx-auto"
          >
            <Plus size={18} /> Create Exam
          </button>
        </div>
      )}
    </div>
  );
}
