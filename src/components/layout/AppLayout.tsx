import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, ClipboardList, Bell,
  Users, LogOut, Menu, X, ChevronRight, GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/timetable', icon: CalendarDays, label: 'Timetable' },
  { to: '/events', icon: ClipboardList, label: 'Tests & Exams' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
];

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin',
  level_adviser: 'Level Adviser',
  class_rep: 'Class Rep',
  student: 'Student',
};

const roleBadgeClass: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  level_adviser: 'bg-emerald-100 text-emerald-700',
  class_rep: 'bg-primary-100 text-primary-700',
  student: 'bg-slate-100 text-slate-600',
};

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const canManageUsers = user?.role === 'super_admin' || user?.role === 'level_adviser';
  const items = canManageUsers
    ? [...navItems, { to: '/users', icon: Users, label: 'Users' }]
    : navItems;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
            <GraduationCap size={18} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-slate-800 text-[15px] leading-tight">UniSchedule</div>
            <div className="text-[11px] text-slate-400 leading-tight">Timetable System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-500'} />
                <span>{label}</span>
                {isActive && <ChevronRight size={14} className="ml-auto text-primary-400" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User profile */}
      <div className="px-3 py-3 border-t border-slate-100">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {user?.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">{user?.fullName}</div>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${roleBadgeClass[user?.role || 'student']}`}>
              {roleLabel[user?.role || 'student']}
            </span>
          </div>
          <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-slate-100 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full bg-white shadow-modal animate-slide-in">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <GraduationCap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-slate-800">UniSchedule</span>
          </div>
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
            {user?.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}