import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import TimetablePage from './pages/TimetablePage';
import EventsPage from './pages/EventsPage';
import NotificationsPage from './pages/NotificationsPage';
import UsersPage from './pages/UsersPage';
import EditProfilePage from './pages/EditProfilePage';
import StudyPlannerPage from './pages/StudyPlannerPage';
import AssignmentTrackerPage from './pages/AssignmentTrackerPage';
import CalendarPage from './pages/CalendarPage';
import ExamManagementPage from './pages/ExamManagementPage';
import ExamsListPage from './pages/ExamsListPage';
import CBTTestPage from './pages/CBTTestPage';
import AdminCreateUserPage from './pages/AdminCreateUserPage';
import CourseFormPage from './pages/CourseFormPage';
import StudentCourseFormPage from './pages/StudentCourseFormPage';
import StudentCourseFormEditPage from './pages/StudentCourseFormEditPage';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// Accessible by super_admin, level_adviser, and class_rep
const ManageRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'super_admin' && user.role !== 'level_adviser' ) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Accessible by exam_officer only
const ExamOfficerRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'exam_officer' && user.role !== 'super_admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Accessible by exam_officer, super_admin, and class_rep (with different permissions)
const TestManagementRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'exam_officer' && user.role !== 'super_admin' && user.role !== 'class_rep' && user.role !== 'student') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

// Accessible by super_admin only
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'super_admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/register"       element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
        <Route path="/forgot-password"element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={user ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />} />
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"   element={<DashboardPage />} />
          <Route path="timetable"   element={<TimetablePage />} />
          <Route path="calendar"    element={<CalendarPage />} />
          <Route path="events"      element={<EventsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="edit-profile" element={<EditProfilePage />} />
          <Route path="study-planner"  element={<StudyPlannerPage />} />
          <Route path="assignments"    element={<AssignmentTrackerPage />} />
          <Route path="exam-timetable" element={<ExamsListPage />} />
          <Route path="exam-management" element={<ExamOfficerRoute><ExamManagementPage /></ExamOfficerRoute>} />
          <Route path="exams" element={<ExamOfficerRoute><ExamsListPage /></ExamOfficerRoute>} />
          <Route path="tests" element={<TestManagementRoute><CBTTestPage /></TestManagementRoute>} />
          <Route path="course-forms" element={<ManageRoute><CourseFormPage /></ManageRoute>} />
          <Route path="course-forms/student/:studentId" element={<ManageRoute><StudentCourseFormEditPage /></ManageRoute>} />
          <Route path="my-course-form" element={<ProtectedRoute><StudentCourseFormPage /></ProtectedRoute>} />
          <Route path="users" element={<ManageRoute><UsersPage /></ManageRoute>} />
          <Route path="admin/create-user" element={<AdminRoute><AdminCreateUserPage /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}