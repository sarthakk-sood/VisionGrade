import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Bell, Menu, ChevronDown, UserCircle, LogOut, CheckCircle2, Download, BookOpen, Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { buildActivityTimeline } from '../../utils/sessionHelpers';

const READ_NOTIFS_KEY = 'vg_read_notifications';

const NOTIF_ICON = {
  evaluation: CheckCircle2,
  export:     Download,
  session:    Plus,
  blueprint:  BookOpen,
};

const loadReadIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_NOTIFS_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

const navItems = [
  { label: 'Home',           to: '/'                    },
  { label: 'Dashboard',      to: '/dashboard'           },
  { label: 'Sessions',       to: '/sessions'            },
  { label: 'Generate Paper', to: '/module1/exam-details' },
  { label: 'Evaluate',       to: '/module2/upload'      },
];

export default function Navbar() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const examSessions = useAppStore((s) => s.examSessions);
  const loadSessionsFromBackend = useAppStore((s) => s.loadSessionsFromBackend);
  const initials = (user?.name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2);
  const roleLabel = (user?.role || 'Faculty').split(' ')[0].toUpperCase();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [readIds, setReadIds] = useState(loadReadIds);

  useEffect(() => {
    if (!examSessions.length) loadSessionsFromBackend();
  }, [examSessions.length, loadSessionsFromBackend]);

  const notifications = buildActivityTimeline(examSessions).slice(0, 6);
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const markAllRead = () => {
    const next = new Set([...readIds, ...notifications.map((n) => n.id)]);
    setReadIds(next);
    localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify([...next]));
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <motion.header
      className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl shadow-sm"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0,   opacity: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">

        <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="hidden sm:block">
            <span className="text-sm font-black tracking-tight text-slate-900">VISIONGRADE</span>
            <p className="-mt-0.5 text-[9px] uppercase tracking-[0.3em] text-slate-500">AI Academic Platform</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 px-1 py-1 lg:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                isNotifOpen
                  ? 'border-blue-200 bg-blue-50 text-blue-600'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {isNotifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-bold text-slate-900">Notifications</p>
                    <button
                      onClick={markAllRead}
                      disabled={unreadCount === 0}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-80 space-y-1 overflow-y-auto p-2">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-xs font-medium text-slate-600">No notifications</p>
                        <p className="mt-1 text-[10px] text-slate-500">Activity from your sessions will appear here.</p>
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const Icon = NOTIF_ICON[n.type] || Plus;
                        const isRead = readIds.has(n.id);
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              setReadIds((prev) => {
                                const next = new Set([...prev, n.id]);
                                localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify([...next]));
                                return next;
                              });
                              setIsNotifOpen(false);
                              navigate('/dashboard');
                            }}
                            className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 ${isRead ? 'opacity-60' : ''}`}
                          >
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-xs font-semibold text-slate-900">{n.title}</span>
                                {!isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] text-slate-500">{n.detail}</span>
                              <span className="mt-0.5 block text-[9px] text-slate-400">{n.time}</span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t border-slate-100 p-2">
                    <button
                      onClick={() => { setIsNotifOpen(false); navigate('/dashboard'); }}
                      className="w-full rounded-xl py-2 text-center text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    >
                      View All Activity
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-[10px] font-black text-white">
                {initials}
              </span>
              <span className="hidden text-xs font-medium text-slate-700 sm:block">{(user?.name || 'User').split(' ').slice(0, 2).join(' ')}</span>
              <ChevronDown className={`h-3 w-3 text-slate-500 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
                >
                  <div className="mb-2 border-b border-slate-100 px-3 py-2">
                    <p className="text-sm font-bold text-slate-900">{user?.name || 'Faculty User'}</p>
                    <p className="text-[10px] text-slate-500">{user?.email || 'faculty@visiongrade.ai'}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">{roleLabel}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Link
                      to="/profile"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <UserCircle className="h-4 w-4" />
                      My Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setIsProfileOpen(false);
                        navigate('/login');
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden">
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
