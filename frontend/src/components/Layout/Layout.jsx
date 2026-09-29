import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Upload, Database, BarChart2, FileText, Settings, LogOut,
} from 'lucide-react';
import Logo from '../Logo';

const NAV = [
  { to: '/dashboard',           label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/upload',    label: 'Upload',    icon: Upload },
  { to: '/dashboard/datasets',  label: 'Datasets',  icon: Database },
  { to: '/dashboard/visualize', label: 'Visualize', icon: BarChart2 },
  { to: '/dashboard/reports',   label: 'Reports',   icon: FileText },
  { to: '/dashboard/settings',  label: 'Settings',  icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials =
    user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden md:flex w-56 flex-col bg-gray-800 fixed top-0 left-0 h-screen">
        <div className="p-4 border-b border-white/10">
          <Logo size={32} theme="dark" />
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2 text-[13px] no-underline border-l-2 ${
                  isActive
                    ? 'text-white border-brand bg-white/5'
                    : 'text-gray-400 border-transparent'
                }`
              }
            >
              <Icon size={15} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-[11px] font-bold text-white">
            {initials}
          </div>
          <div className="flex-1 truncate">
            <div className="text-xs text-white font-semibold truncate">{user?.name}</div>
            <div className="text-[10px] text-gray-400">{user?.role}</div>
          </div>
          <button
            className="text-gray-400 hover:text-white"
            onClick={() => { logout(); navigate('/'); }}
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      <div className="flex-1 md:ml-56 flex flex-col min-w-0">
        <header className="bg-gray-900 text-gray-400 h-8 px-4 flex items-center gap-4 text-xs">
          <span className="text-gray-200">DataLyze</span>
          <span>·</span>
          <span>Hello, <strong className="text-gray-200">{user?.name}</strong></span>
          <a href="/" className="ml-auto text-gray-500 no-underline">← Public tool</a>
        </header>
        <main className="flex-1 p-5 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}