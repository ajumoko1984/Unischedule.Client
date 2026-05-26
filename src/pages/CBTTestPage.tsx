import { Navigate } from 'react-router-dom';

// This page is no longer used - exams are now managed via timetable system
export default function CBTTestPage() {
  return <Navigate to="/exam-timetable" replace />;
}
