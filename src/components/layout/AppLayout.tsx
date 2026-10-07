// src/components/layout/AppLayout.tsx
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Scale,
  FileText,
  Clock,
  Printer,
  FileBox,
  Layers,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  User,
  Sun,
  Moon,
  Home,
  LogOut,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  getStoredUser,
  setStoredUser,
  getViewAsRole,
  setViewAsRole,
  signOutUser,
  SEEDED_TEST_USERS,
  UserProfile,
  Role,
} from '../../lib/auth';
import { RoleBanner } from '../common/RoleBanner';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { coreDb } from '../../lib/supabase';
import type { CoreNotification } from '../../lib/types';

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(getStoredUser());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<CoreNotification[]>([]);

  // Load unread notifications
  useEffect(() => {
    if (!currentUser) return;
    coreDb
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setNotifications(data as CoreNotification[]);
      });
  }, [currentUser]);

  // Keyboard shortcut Ctrl+K / Cmd+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSwitchUser = (user: UserProfile) => {
    setStoredUser(user);
    setCurrentUser(user);
    setUserMenuOpen(false);
  };

  const handleSignOut = () => {
    signOutUser();
    setUserMenuOpen(false);
    navigate('/login');
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const navItems = [
    { label: 'Today Docket', path: '/', icon: Home },
    { label: 'Court Calendar', path: '/calendar', icon: CalendarIcon },
    { label: 'Court Cases', path: '/cases', icon: Scale },
    { label: 'Daily Cause List', path: '/cause-list', icon: Printer },
    { label: 'Agreements', path: '/agreements', icon: FileText },
    { label: 'Renewals Docket', path: '/renewals', icon: RefreshCw },
    { label: 'Template Library', path: '/templates', icon: FileBox },
    { label: 'Deadlines', path: '/deadlines', icon: Clock },
    { label: 'Admin › Integrations', path: '/admin/integrations', icon: Settings },
  ];

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${isDarkMode ? 'dark' : ''}`}>
      {/* Super Admin Role Simulation Banner */}
      <RoleBanner currentUser={currentUser} onRoleChange={() => setCurrentUser({ ...getStoredUser()! })} />

      {/* Top Navbar */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between sticky top-0 z-40 shadow-2xs">
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-sm tracking-tight shadow-md shadow-indigo-600/20">
              LX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base tracking-tight">
                  Lextria Litigator
                </span>
                <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider border border-indigo-200 dark:border-indigo-800">
                  TEST
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">Court Cases &amp; Agreements Vault</p>
            </div>
          </div>
        </div>

        {/* Global Search Trigger Bar */}
        <div className="hidden md:flex items-center flex-1 max-w-sm mx-6">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-indigo-500" />
              <span>Search cases, CNR, agreements...</span>
            </div>
            <kbd className="text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded font-mono">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick eCourts External Link Button */}
          <a
            href="https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/cnr_index"
            target="_blank"
            rel="noopener noreferrer"
            title="Open official eCourts CNR Case Status"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 rounded-lg transition border border-slate-200/60 dark:border-slate-700/60"
          >
            <span>eCourts Portal</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 relative"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 z-50 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    Notifications ({notifications.length})
                  </span>
                  <span className="text-[10px] text-slate-400">core.notifications</span>
                </div>
                {notifications.length === 0 ? (
                  <p className="py-4 text-center text-slate-400">All caught up! No unread notices.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setNotificationsOpen(false);
                          if (n.link) navigate(n.link);
                        }}
                        className="p-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer transition"
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{n.title}</div>
                        {n.body && <div className="text-slate-500 text-[11px] line-clamp-2 mt-0.5">{n.body}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile / Quick Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                {currentUser?.display_name.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                  {currentUser?.display_name.split(' ')[0]}
                </div>
                <div className="text-[10px] text-slate-400 leading-none capitalize">
                  {currentUser?.role.toLowerCase().replace(/_/g, ' ')}
                </div>
              </div>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 z-50 text-xs">
                <div className="pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <div className="font-bold text-slate-900 dark:text-slate-100">{currentUser?.display_name}</div>
                  <div className="text-slate-400 text-[11px]">{currentUser?.email}</div>
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium uppercase mt-0.5">
                    {currentUser?.department} • {currentUser?.role}
                  </div>
                </div>

                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Switch Active Test User:
                </div>
                <div className="space-y-1 mb-2">
                  {SEEDED_TEST_USERS.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSwitchUser(u)}
                      className={`w-full text-left p-1.5 rounded-md text-xs transition flex items-center justify-between ${
                        currentUser?.id === u.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="truncate">{u.display_name}</span>
                      <span className="text-[9px] font-mono px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 rounded-md font-medium text-xs transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main App Grid: Sidebar + View Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col justify-between hidden lg:flex shrink-0">
          <div className="p-3 space-y-1 overflow-y-auto">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Dockets &amp; Workflows
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100'
                  }`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span>Schema: litigator</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">RLS ACTIVE</span>
            </div>
            <div>Lextria Research © 2026</div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-64 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between h-full z-10 shadow-2xl">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100">Menu</div>
                  <button onClick={() => setMobileMenuOpen(false)}>
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};
