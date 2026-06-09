import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Calendar, Clock, MapPin, AlertCircle, FileUp, Bell, X, Mail, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { smsService } from '../utils/smsService';
import { CourseCodeSuggestion, useCourseCodeSuggestions } from '../hooks/useCourseCodeSuggestions';
import { useAuth } from '../context/AuthContext';
import { courseFormService } from '../utils/courseFormService';
import { examService } from '../utils/examService';
import { userService } from '../utils/userService';
import { Exam, Semester } from '../types';
import { format } from 'date-fns';
import BulkImportModal from '../components/BulkImportModal';
import InvigilatorSelect from '../components/InvigilatorSelect';

const EXAM_TYPES = [
  { value: 'cbt', label: 'CBT', venue: 'CBT CENTRE' },
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const invLabel = (inv: string | { _id: string; fullName: string } | undefined) => {
    if (!inv) return '';
    return typeof inv === 'string' ? inv : inv.fullName || '';
  };

  const formatInvigilators = (arr?: Array<string | { _id: string; fullName: string }>) => {
    if (!arr || arr.length === 0) return 'None assigned';
    return arr
      .map(i => {
        if (!i) return null;
        if (typeof i === 'string') {
          // If it's a plain string that looks like an ID, return a placeholder
          return i.length === 24 ? `Lecturer (${i.substring(0, 8)})` : i;
        }
        // If it's an object, return the fullName
        return i.fullName || `Lecturer (${i._id?.substring(0, 8)})`;
      })
      .filter(Boolean)
      .join(', ');
  };

  const [exams, setExams] = useState<Exam[]>([]);
  const [examsQueue, setExamsQueue] = useState<Partial<Exam>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingAll, setIsCreatingAll] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationForm, setNotificationForm] = useState({ 
    examId: '', 
    courseCode: '', 
    subject: '', 
    message: '',
    sendEmail: true,
    sendSMS: false,
  });
  const [newExam, setNewExam] = useState<Partial<Exam>>({
    courseCode: '',
    courseTitle: '',
    examType: 'written',
    scheduleDate: '',
    startTime: '09:00',
    endTime: '11:00',
    venue: '',
    studentPopulation: undefined,
    invigilators: [''],
  });
  // course form summary removed — student population must be provided by exam officer
  const { suggestions, courseCodeMap } = useCourseCodeSuggestions() as { suggestions: CourseCodeSuggestion[]; courseCodeMap: Map<string, string> };
  const courseOptions = useMemo<string[]>(() => suggestions.map(item => item.courseCode), [suggestions]);
  const handleCourseCodeChange = (value: string) => {
    const code = value.toUpperCase();
    set('courseCode', code);
    const matchedTitle = courseCodeMap.get(code.trim());
    if (matchedTitle) set('courseTitle', matchedTitle);
  };

  const examCourseCodes = useMemo<string[]>(() =>
    Array.from(new Set(exams.map((exam) => (exam.courseCode || '').trim().toUpperCase()).filter(Boolean))),
    [exams]
  );

  const { data: examCourseCounts = {}, isFetching: examCountsLoading } = useQuery<Record<string, number>>({
    queryKey: ['exam-course-student-counts', examCourseCodes],
    queryFn: async () => {
      if (examCourseCodes.length === 0) return {};
      return courseFormService.countStudentsByCourseCodes(examCourseCodes);
    },
    enabled: examCourseCodes.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    loadExams();
  }, []);

  // NOTE: removed automatic course-form lookup — population is entered manually

  const loadExams = async () => {
    try {
      setIsLoading(true);
      const res = await examService.getMyExams();
      // Handle different response structures from API
      let examsData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      
      // Resolve invigilator IDs to lecturer objects
      examsData = await Promise.all(
        examsData.map(async (exam: Exam) => {
          if (!exam.invigilators || exam.invigilators.length === 0) {
            return exam;
          }
          
          const resolvedInvigilators = await Promise.all(
            exam.invigilators.map(async (inv) => {
              // If already an object with fullName, return as-is
              if (typeof inv === 'object' && inv.fullName) {
                return inv;
              }
              // If it's a string (ID), fetch the lecturer
              if (typeof inv === 'string') {
                const lecturer = await userService.getUserById(inv);
                return lecturer || inv; // Fallback to ID if fetch fails
              }
              return inv;
            })
          );
          
          return { ...exam, invigilators: resolvedInvigilators };
        })
      );
      
      setExams(examsData);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load exams');
    } finally {
      setIsLoading(false);
    }
  };

  // automatic student lookup removed

const handleSaveExam = async () => {
  if (!newExam.courseCode || !newExam.courseTitle || !newExam.venue || !newExam.scheduleDate || !newExam.startTime || !newExam.endTime) {
    toast.error('Please fill in all required fields: Course Code, Title, Venue, Date, and Times');
    return;
  }

  const population = newExam.studentPopulation !== undefined && newExam.studentPopulation !== null
    ? Number(newExam.studentPopulation)
    : undefined;
  if (population === undefined || Number.isNaN(population)) {
    toast.error('Please enter the student population for this exam');
    return;
  }

  const courseCode = newExam.courseCode.toUpperCase().trim();
  const examData: Partial<Exam> = {
    courseCode,
    courseTitle: newExam.courseTitle.trim(),
    examType: newExam.examType,
    venue: newExam.examType === 'cbt' ? 'CBT CENTRE' : newExam.venue,
    scheduleDate: newExam.scheduleDate,
    startTime: newExam.startTime,
    endTime: newExam.endTime,
    semester: getCurrentSemester(newExam.scheduleDate) as Semester,
    academicYear: getCurrentAcademicYear(newExam.scheduleDate),
    // placeholder - will be replaced by normalizedInvigilators below
    invigilators: [],
  };

  // population validated above; include in payload
  examData.studentPopulation = population;

  // Normalize invigilators: send array of user ids (strings). Try resolve names/objects to ids.
  const rawInvs = (newExam.invigilators || []) as Array<string | { _id: string; fullName: string }>;
  const normalizedInvigilators = await Promise.all(rawInvs.map(async (inv) => {
    if (!inv) return null;
    if (typeof inv === 'string') {
      const trimmed = inv.trim();
      if (trimmed === '') return null;
      // If the string looks like an id, try fetch by id
      const byId = await userService.getUserById(trimmed);
      if (byId) return byId._id;
      // fallback: search by name
      const found = await userService.searchUsers(trimmed, 'lecturer');
      if (found && found.length > 0) return found[0]._id;
      return trimmed; // last resort
    }
    // object-like entry
    return inv._id;
  }));

  examData.invigilators = normalizedInvigilators.filter(Boolean) as any;

  try {
    if (editingExam) {
      await examService.updateExam(editingExam._id!, examData as any);
      toast.success('Exam updated!');
      // No automatic notification or student lookup on update — exam officer should notify manually if needed
      await loadExams();
    } else {
      // Keep original invigilator objects (if any) for frontend notification purposes
      const frontendInvigilators = (rawInvs || []).filter(Boolean);
      const queued = { ...examData, _frontendInvigilators: frontendInvigilators } as any;
      setExamsQueue(prev => [...prev, queued]);
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
          // Prepare payload: map frontend invigilator objects to ids if present
          const payload: any = { ...exam };
          if ((exam as any)._frontendInvigilators) {
            payload.invigilators = (exam as any)._frontendInvigilators.map((inv: any) => (typeof inv === 'string' ? inv : inv._id));
            // remove helper property
            delete payload._frontendInvigilators;
          }

          await examService.createExam(payload as any);
          successCount++;

          // Notify invigilators by email (best-effort)
          try {
            const frontendInvs = (exam as any)._frontendInvigilators || (exam as any).invigilators || [];
            const recipientEmails: string[] = [];
            for (const inv of frontendInvs) {
              if (!inv) continue;
              if (typeof inv === 'object' && inv.email) recipientEmails.push(inv.email);
              else if (typeof inv === 'string') {
                const u = await userService.getUserById(inv);
                if (u && u.email) recipientEmails.push(u.email);
              }
            }

            if (recipientEmails.length > 0) {
              const subject = `Assigned as invigilator: ${exam.courseCode}`;
              const message = `You have been assigned as an invigilator for ${exam.courseCode} - ${exam.courseTitle} on ${exam.scheduleDate} at ${exam.startTime} in ${exam.venue || exam.location || ''}.`;
              await api.post('/notifications/announce', {
                subject,
                message,
                recipientEmails,
                isAutomatic: true,
              });
            }
          } catch (notifyErr: any) {
            console.warn('Invigilator notification failed', notifyErr);
          }
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

  // One-off migration: convert invigilator id strings to {_id, fullName} objects where possible
  const migrateInvigilators = async () => {
    if (!confirm('Run invigilator migration for ALL exams? This will attempt to resolve string ids to user objects.')) return;
    try {
      setIsCreatingAll(true);
      const res = await examService.getAllExams();
      const all = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      let success = 0;
      const failures: string[] = [];

      for (const ex of all) {
        try {
          const invs = ex.invigilators || [];
          const updated = [] as Array<string | { _id: string; fullName: string }>;
          for (const inv of invs) {
            if (!inv) continue;
            if (typeof inv === 'string') {
              const trimmed = inv.trim();
              if (!trimmed) continue;
              // try fetch user by id
              const u = await userService.getUserById(trimmed);
              if (u) updated.push(u._id);
              else {
                // fallback: search by name
                const found = await userService.searchUsers(trimmed, 'lecturer');
                if (found && found.length > 0) updated.push(found[0]._id);
                else updated.push(trimmed);
              }
            } else {
              updated.push(inv._id);
            }
          }

          // Only call update if there is a change (i.e., values are ids and different)
          const needsUpdate = updated.some(i => typeof i === 'string');
          if (needsUpdate) {
            await examService.updateExam(ex._id, { invigilators: updated } as any);
            success++;
          }
        } catch (e: any) {
          failures.push(`${ex._id}: ${e?.message || 'failed'}`);
        }
      }

      toast.success(`${success} exam(s) migrated` + (failures.length ? `, ${failures.length} failed` : ''));
      if (failures.length) console.error('Migration failures', failures);
      await loadExams();
    } catch (err: any) {
      toast.error('Migration failed');
      console.error(err);
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
      // Notify invigilators about the published exam (best-effort)
      try {
        const res = await examService.getExamById(id);
        const exam = res.data?.data || res.data;
        const invs = exam.invigilators || [];
        const recipientEmails: string[] = [];
        for (const inv of invs) {
          if (!inv) continue;
          if (typeof inv === 'object' && inv.email) recipientEmails.push(inv.email);
          else if (typeof inv === 'string') {
            const u = await userService.getUserById(inv);
            if (u && u.email) recipientEmails.push(u.email);
          }
        }
        if (recipientEmails.length > 0) {
          const subject = `Published: ${exam.courseCode} Exam Details`;
          const message = `The ${exam.courseCode} exam has been published. Date: ${exam.scheduleDate}, Time: ${exam.startTime} - ${exam.endTime}, Venue: ${exam.venue || exam.location || ''}.`;
          await api.post('/notifications/announce', { subject, message, recipientEmails, isAutomatic: true });
        }
      } catch (notifyErr: any) {
        console.warn('Publish notification failed', notifyErr);
      }
      // Refresh
      await loadExams();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to publish exam');
    }
  };

  const handleSendExamNotification = async () => {
    try {
      const { examId, courseCode, subject, message, sendEmail, sendSMS } = notificationForm;
      
      if (!subject.trim() || !message.trim()) {
        toast.error('Please provide a subject and message before sending.');
        return;
      }

      if (!sendEmail && !sendSMS) {
        toast.error('Select at least one notification method (Email or SMS).');
        return;
      }

      // Fetch exam details to get faculty, level, courseOfStudy, and student contact info
      const res = await examService.getExamById(examId);
      const exam = res.data?.data || res.data;

      // Send email notification
      if (sendEmail) {
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
      }

      // Send SMS notification
      if (sendSMS) {
        try {
          // Fetch student contact list for the course
          const studentList = exam.students || [];
          const recipientPhones: string[] = []; // TODO: Map student IDs to phone numbers from API
          
          if (recipientPhones.length > 0) {
            await smsService.sendSMS(
              recipientPhones,
              message,
              'exam_update',
              { examId, courseCode, faculty: exam.faculty }
            );
          } else {
            console.warn('No phone numbers available for SMS delivery');
          }
        } catch (smsErr: any) {
          console.error('SMS sending failed:', smsErr);
          toast.error('Notification sent via email, but SMS delivery failed. Check logs.');
          return;
        }
      }

      toast.success('Notification sent successfully!');
      setShowNotificationModal(false);
      setNotificationForm({ examId: '', courseCode: '', subject: '', message: '', sendEmail: true, sendSMS: false });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send notification');
    }
  };

  const prepareExamForForm = (exam: Partial<Exam> = {}) => ({
    ...exam,
    invigilators: exam.invigilators && exam.invigilators.length > 0 ? exam.invigilators : [''],
  });

  const clearForm = () => {
    setNewExam(prepareExamForForm({
      courseCode: '',
      courseTitle: '',
      examType: 'written',
      scheduleDate: '',
      startTime: '09:00',
      endTime: '11:00',
      venue: '',
    }));
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

  const updateInvigilator = (index: number, value: string | { _id: string; fullName: string; email?: string }) => {
    setNewExam((prev: any) => {
      const invigilators = [...(prev.invigilators || [''])];
      invigilators[index] = value;
      return { ...prev, invigilators };
    });
  };

  const addInvigilator = () => {
    setNewExam((prev: any) => ({ ...prev, invigilators: [...(prev.invigilators || ['']), ''] }));
  };

  const removeInvigilator = (index: number) => {
    setNewExam((prev: any) => {
      const invigilators = [...(prev.invigilators || [''])];
      if (invigilators.length === 1) {
        return { ...prev, invigilators: [''] };
      }
      invigilators.splice(index, 1);
      return { ...prev, invigilators };
    });
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
          {isAdmin && (
            <button
              onClick={migrateInvigilators}
              disabled={isCreatingAll}
              className="btn-ghost mr-2"
              title="Migrate invigilator ids to objects"
            >
              Migrate invigilators
            </button>
          )}
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
                  onChange={(e) => handleCourseCodeChange(e.target.value)}
                  list="exam-course-codes"
                />
                <datalist id="exam-course-codes">
                  {courseOptions.map((courseCode) => <option key={courseCode} value={courseCode} />)}
                </datalist>
                {/* course form summary removed — exam officer provides population manually */}
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

            <div>
              <label className="label text-sm font-medium">Student Population *</label>
              <input
                type="number"
                min="0"
                className="input"
                placeholder="Enter student population"
                value={newExam.studentPopulation ?? ''}
                onChange={(e) => set('studentPopulation', e.target.value === '' ? undefined : Number(e.target.value))}
              />
              <p className="text-xs text-slate-500 mt-1">Required: enter the expected number of students for this exam.</p>
            </div>

            <div>
              <label className="label text-sm font-medium">Exam Date *</label>
              <input
                type="date"
                className="input"
                value={newExam.scheduleDate ? newExam.scheduleDate.split('T')[0] : ''}
                onChange={(e) => set('scheduleDate', e.target.value)}
              />
            </div>

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

            <div>
              <label className="label text-sm font-medium">Invigilators</label>
              <div className="space-y-3">
                {(newExam.invigilators || ['']).map((inv, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <InvigilatorSelect
                        value={typeof inv === 'string' ? inv : (inv as any)?._id}
                        onChange={(val) => updateInvigilator(index, val)}
                        placeholder={`Invigilator ${index + 1}`}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => removeInvigilator(index)}
                        className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addInvigilator}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
                >
                  Add another invigilator
                </button>
                <p className="text-xs text-slate-500">Add one or more exam invigilators for this course.</p>
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
                    {typeof exam.studentPopulation === 'number' ? (
                      <p className="text-xs text-slate-500 mt-1">Population: {exam.studentPopulation}</p>
                    ) : null}
                    <p className="text-xs text-slate-500 mt-1">Invigilators: {formatInvigilators(exam.invigilators) || 'None'}</p>
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
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-semibold text-slate-800">{exam.courseCode}</h3>
                      <span className="text-sm text-slate-600">— {exam.courseTitle}</span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                        {exam.examType.toUpperCase()}
                      </span>
                      {/* <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-[0.16em]">
                        {examCourseCounts[exam.courseCode?.toUpperCase() || ''] ?? (examCountsLoading ? '...' : 0)} students
                      </span> */}
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
                    <p className="mt-3 text-sm text-slate-600">
                      <span className="font-semibold text-slate-700">Invigilators:</span> {formatInvigilators(exam.invigilators) || 'None assigned'}
                    </p>
                    {typeof exam.studentPopulation === 'number' ? (
                      <p className="mt-2 text-sm text-slate-600">
                        <span className="font-semibold text-slate-700">Population:</span> {exam.studentPopulation}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingExam(exam);
                        setNewExam(prepareExamForForm(exam));
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
                          sendEmail: true,
                          sendSMS: false,
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
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-semibold text-slate-800">{exam.courseCode}</h3>
                      <span className="text-sm text-slate-600">— {exam.courseTitle}</span>
                      <span className="px-2 py-1 bg-green-200 text-green-700 text-xs font-medium rounded">
                        {exam.examType.toUpperCase()}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        Published
                      </span>
                      <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-[0.16em]">
                        {examCourseCounts[exam.courseCode?.toUpperCase() || ''] ?? (examCountsLoading ? '...' : 0)} students
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
                    <p className="mt-3 text-sm text-slate-600">
                      <span className="font-semibold text-slate-700">Invigilators:</span> {formatInvigilators(exam.invigilators) || 'None assigned'}
                    </p>
                    {typeof exam.studentPopulation === 'number' ? (
                      <p className="mt-2 text-sm text-slate-600">
                        <span className="font-semibold text-slate-700">Population:</span> {exam.studentPopulation}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setEditingExam(exam);
                        setNewExam(prepareExamForForm(exam));
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
                          sendEmail: true,
                          sendSMS: false,
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
              {/* Notification Method Selection */}
              <div className="border-b border-slate-200 pb-4">
                <label className="label text-sm font-medium mb-3">Send via:</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={notificationForm.sendEmail}
                      onChange={(e) => setNotificationForm(f => ({ ...f, sendEmail: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <Mail size={18} className="text-blue-600" />
                    <span className="text-sm font-medium text-slate-700">Email</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={notificationForm.sendSMS}
                      onChange={(e) => setNotificationForm(f => ({ ...f, sendSMS: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <MessageSquare size={18} className="text-green-600" />
                    <span className="text-sm font-medium text-slate-700">SMS (Twilio)</span>
                  </label>
                </div>
              </div>

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
                {notificationForm.sendSMS && (
                  <p className="text-xs text-slate-500 mt-2">💡 SMS has character limits. Keep messages concise.</p>
                )}
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
