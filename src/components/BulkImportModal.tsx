import { useState } from 'react';
import { X, Upload, FileUp, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { examService } from '../utils/examService';
import { parseTabularCSV, parseTimetable, convertToExamData } from '../utils/timetableParser.ts';
import { Exam } from '../types';
import { format } from 'date-fns';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const [step, setStep] = useState<'input' | 'preview' | 'processing'>('input');
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('csv');
  const [timetableData, setTimetableData] = useState('');
  const [semester, setSemester] = useState('First');
  const [academicYear, setAcademicYear] = useState('2025/2026');
  const [parsedExams, setParsedExams] = useState<Partial<Exam>[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setTimetableData(content);
      if (file.name.endsWith('.csv')) setImportFormat('csv');
      else if (file.name.endsWith('.json')) setImportFormat('json');
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    try {
      if (!timetableData.trim()) {
        toast.error('Please enter or upload timetable data');
        return;
      }

      let entries: any[] = [];

      if (importFormat === 'csv') {
        // Use your tabular CSV parser which handles "PES308 {LR8}" format
        entries = parseTabularCSV(timetableData, semester, academicYear);
      } else {
        // JSON format
        const jsonData = JSON.parse(timetableData);
       entries = parseTimetable(
  Array.isArray(jsonData) ? jsonData : [jsonData],
  'auto',
  semester,
  academicYear
);


      }

      if (entries.length === 0) {
        toast.error('No exams could be parsed. Check your data format.');
        return;
      }


      // Deduplicate by course code — one exam per unique course code
      const seen = new Set<string>();
      const unique = entries.filter(entry => {
        const code = entry.courseCode?.toUpperCase().trim();
        if (!code || seen.has(code)) return false;
        seen.add(code);
        return true;
      });

      // Convert TimetableEntry → Exam shape for preview
      const exams = unique.map(entry => convertToExamData(entry, {
        examType: 'cbt',
        location: entry.location || 'CBT CENTRE',
      }));

      setParsedExams(exams);
      setStep('preview');
      toast.success(`Parsed ${exams.length} unique exams from ${entries.length} entries`);
    } catch (err: any) {
      toast.error('Failed to parse: ' + err.message);
    }
  };

  const handleImport = async () => {
    if (!parsedExams.length) return;
    setIsProcessing(true);
    setStep('processing');

    try {
      // Send as CSV bulk import
      // const csvLines = parsedExams.map(e =>
      //   `${e.courseCode}\t${e.courseCode}\tcbt\t${
      //     e.scheduleDate instanceof Date
      //       ? e.scheduleDate.toISOString().split('T')[0]
      //       : e.scheduleDate
      //   }\t${e.startTime} - ${e.endTime}\t${e.venue}`
      // );

      // Use the backend bulk endpoint directly with parsed exam data
      let successCount = 0;
      const errors: string[] = [];

      for (const exam of parsedExams) {
        try {
          await examService.createExam({
            ...exam,
            semester,
            academicYear,
          } as any);
          successCount++;
        } catch (err: any) {
          errors.push(`${exam.courseCode}: ${err.response?.data?.message || 'Failed'}`);
        }
      }

      setResults({ success: successCount, failed: errors.length, errors });

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} exams`);
        setTimeout(() => { onSuccess(); handleClose(); }, 2000);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to import exams');
      setResults({ success: 0, failed: parsedExams.length, errors: [err.message] });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setStep('input');
    setTimetableData('');
    setParsedExams([]);
    setResults(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-modal p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <FileUp size={20} className="text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Bulk Import Exams</h2>
              <p className="text-xs text-slate-400">Import multiple exams from timetable data</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {/* Step Indicators */}
        <div className="flex gap-2 mb-6">
          {(['input', 'preview', 'processing'] as const).map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                step === s ? 'bg-primary-600 text-white' :
                i < (['input', 'preview', 'processing'].indexOf(step)) ?
                'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {i + 1}
              </div>
              {i < 2 && <div className="w-6 h-0.5 mx-1 bg-slate-200" />}
            </div>
          ))}
        </div>

        {/* ── INPUT STEP ── */}
        {step === 'input' && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Data Format</label>
              <div className="grid grid-cols-2 gap-3">
                {(['csv', 'json'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setImportFormat(fmt)}
                    className={`p-3 border-2 rounded-lg transition ${
                      importFormat === fmt
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className="font-medium text-sm">{fmt.toUpperCase()}</p>
                    <p className="text-xs text-slate-500">
                      {fmt === 'csv' ? 'Tab-separated with {venue} codes' : 'Structured JSON format'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Semester</label>
                <select value={semester} onChange={e => setSemester(e.target.value)} className="input">
                  <option value="First">First</option>
                  <option value="Second">Second</option>
                </select>
              </div>
              <div>
                <label className="label">Academic Year</label>
                <input
                  value={academicYear}
                  onChange={e => setAcademicYear(e.target.value)}
                  className="input"
                  placeholder="e.g., 2025/2026"
                />
              </div>
            </div>

            <div>
              <label className="label">Upload File</label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-primary-300 transition">
                <input
                  type="file"
                  accept=".csv,.txt,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer block">
                  <Upload size={32} className="mx-auto mb-2 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700">Click to upload</p>
                  <p className="text-xs text-slate-500">or paste data below</p>
                </label>
              </div>
            </div>

            <div>
              <label className="label">Or Paste Data</label>
              <textarea
                value={timetableData}
                onChange={e => setTimetableData(e.target.value)}
                placeholder={importFormat === 'csv'
                  ? `Paste tab-separated CSV:\nEDU212-EDLT | PES308 {LR8} | ...  PES102 {APLR} | ...  cbt  2026-05-25  21:00 - 02:00  CBT CENTRE`
                  : 'Paste JSON timetable data...'
                }
                className="input font-mono text-xs h-48 resize-none"
              />
            </div>

            {importFormat === 'csv' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>CSV Format:</strong> Columns separated by <code>TAB</code>. Each row is a time slot.
                Courses separated by <code>|</code> with venue in <code>{'{ }'}</code>.
                Last 3 columns: <code>date</code>, <code>time</code>, <code>default venue</code>.
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={handleClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleParse} className="btn-primary flex-1">
                <FileUp size={14} /> Parse & Preview
              </button>
            </div>
          </div>
        )}

        {/* ── PREVIEW STEP ── */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-700">
                <strong>{parsedExams.length} exams</strong> will be created. Review below.
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b sticky top-0">
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Course Code</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Type</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Date</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Time</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Venue</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedExams.map((exam, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">{exam.courseCode}</td>
                      <td className="px-3 py-2">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          {exam.examType}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                     {exam.date
                          ? format(new Date(exam.date), 'MMM dd, yyyy')
                          : ''
                        }
                      </td>
                      <td className="px-3 py-2 text-slate-600">{exam.startTime} – {exam.endTime}</td>
                      <td className="px-3 py-2 text-slate-600">{exam.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('input')} className="btn-secondary flex-1">
                Back
              </button>
              <button onClick={handleImport} disabled={isProcessing} className="btn-primary flex-1">
                {isProcessing
                  ? <><Loader2 size={14} className="animate-spin" /> Importing...</>
                  : <>Import {parsedExams.length} Exams</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── RESULTS STEP ── */}
        {step === 'processing' && results && (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border-2 ${
              results.failed === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 size={20} className={results.failed === 0 ? 'text-emerald-600' : 'text-amber-600'} />
                <h3 className={`font-semibold ${results.failed === 0 ? 'text-emerald-900' : 'text-amber-900'}`}>
                  Import Complete
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-600">Successful</p>
                  <p className="text-2xl font-bold text-emerald-600">{results.success}</p>
                </div>
                <div>
                  <p className="text-slate-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                </div>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-sm font-semibold text-red-900 mb-2">Errors:</p>
                <ul className="space-y-1">
                  {results.errors.slice(0, 10).map((err, i) => (
                    <li key={i} className="text-xs text-red-700">• {err}</li>
                  ))}
                  {results.errors.length > 10 && (
                    <li className="text-xs text-red-600">...and {results.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}

            <button onClick={handleClose} className="btn-primary w-full">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}