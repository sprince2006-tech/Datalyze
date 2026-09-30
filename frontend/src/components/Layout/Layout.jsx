import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Upload, Database, BarChart2, FileText, Settings,
  LogOut, Menu, X,
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

function SidebarContent({ user, onNavigate, onClose }) {
  const initials =
    user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <Logo size={32} theme="dark" />
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-white p-1"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-4 py-2.5 text-[13px] no-underline border-l-2 ${
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
          onClick={() => { onNavigate?.(); onClose?.(); }}
          title="Logout"
        >
          <LogOut size={14} />
        </button>
      </div>
    </>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer whenever the route changes
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Prevent body scroll while drawer is open
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  // Close on Escape
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 flex-col bg-gray-800 fixed top-0 left-0 h-screen z-30">
        <SidebarContent user={user} onNavigate={handleLogout} />
      </aside>

      {/* ── Mobile drawer ───────────────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <aside className="fixed top-0 left-0 h-screen w-64 max-w-[80vw] bg-gray-800 flex flex-col z-50 md:hidden">
            <SidebarContent
              user={user}
              onNavigate={handleLogout}
              onClose={() => setDrawerOpen(false)}
            />
          </aside>
        </>
      )}

      {/* ── Main content ────────────────────────────────────────── */}
      <div className="flex-1 md:ml-56 flex flex-col min-w-0">
        <header className="bg-gray-900 text-gray-400 h-10 md:h-8 px-3 md:px-4 flex items-center gap-3 md:gap-4 text-xs shrink-0">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden text-gray-300 hover:text-white p-1 -ml-1"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          <span className="text-gray-200">DataLyze</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            Hello, <strong className="text-gray-200">{user?.name}</strong>
          </span>
          <a href="/" className="ml-auto text-gray-500 no-underline">
            ← <span className="hidden sm:inline">Public tool</span>
          </a>
        </header>

        <main className="flex-1 p-4 md:p-5 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}