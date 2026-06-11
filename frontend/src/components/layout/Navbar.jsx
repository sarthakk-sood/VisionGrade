import { useState, useRef, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Bell, Menu, ChevronDown, UserCircle, LogOut } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const navItems = [
  { label: 'Home',           to: '/'                    },
  { label: 'Dashboard',      to: '/dashboard'           },
  { label: 'Sessions',       to: '/sessions'            },
  { label: 'Generate Paper', to: '/module1/exam-details' },
  { label: 'Evaluate',       to: '/module2/upload'      },
];

export default function Navbar() {
  const user = useAppStore((s) => s.user);
  const initials = user?.name ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2) : '';

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <motion.header
      className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#020617]/75 backdrop-blur-2xl"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0,   opacity: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">

        {/* ── Logo ── */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-blue-400/25 bg-blue-500/15 text-blue-200 shadow-[0_0_28px_rgba(59,130,246,0.3)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="hidden sm:block">
            <span className="text-sm font-black tracking-tight text-white">VISIONGRADE</span>
            <p className="text-[9px] uppercase tracking-[0.3em] text-blue-400/70 -mt-0.5">AI Academic Platform</p>
          </div>
        </Link>

        {/* ── Nav ── */}
        <nav className="hidden items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.035] px-1 py-1 lg:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* ── Right ── */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {/* Notifications Dropdown */}
              <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                isNotifOpen 
                  ? 'border-blue-400/30 bg-blue-500/10 text-blue-300' 
                  : 'border-white/[0.07] bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-400 pulse-dot" />
            </button>

            <AnimatePresence>
              {isNotifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-72 rounded-2xl border border-white/[0.08] bg-[#071226]/95 shadow-2xl backdrop-blur-xl z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <p className="text-sm font-bold text-white">Notifications</p>
                    <button className="text-[10px] font-semibold text-blue-400 hover:text-blue-300">Mark all read</button>
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                    {[
                      { id: 1, title: 'OCR Processing Complete', desc: 'CS2026-021 answer sheet processed.', time: '2m ago', unread: true },
                      { id: 2, title: 'Session Evaluated', desc: 'DBMS Mid Semester is fully evaluated.', time: '1h ago', unread: true },
                      { id: 3, title: 'Question Paper Ready', desc: 'Physics Prelims paper exported to PDF.', time: '3h ago', unread: false },
                    ].map((notif) => (
                      <div 
                        key={notif.id} 
                        className={`cursor-pointer rounded-xl p-3 transition hover:bg-white/[0.06] ${notif.unread ? 'bg-blue-500/[0.04]' : 'bg-transparent'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-semibold ${notif.unread ? 'text-white' : 'text-slate-300'}`}>{notif.title}</p>
                          {notif.unread && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-400">{notif.desc}</p>
                        <p className="mt-1.5 text-[9px] font-semibold text-slate-500">{notif.time}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-white/[0.06] p-2">
                    <button className="w-full rounded-xl py-2 text-center text-xs font-semibold text-slate-400 transition hover:bg-white/[0.04] hover:text-white">
                      View All Activity
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 transition hover:bg-white/[0.08]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-400 text-[10px] font-black text-white">
                {initials}
              </span>
              <span className="hidden text-xs font-medium text-white sm:block">{user.name.split(' ').slice(0, 2).join(' ')}</span>
              <ChevronDown className={`h-3 w-3 text-slate-500 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/[0.08] bg-[#071226]/95 p-2 shadow-2xl backdrop-blur-xl z-50"
                >
                  <div className="px-3 py-2 border-b border-white/[0.06] mb-2">
                    <p className="text-sm font-bold text-white">{user.name}</p>
                    <p className="text-[10px] text-slate-400">{user.email || 'faculty@visiongrade.ai'}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-300">ADMIN</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Link
                      to="/profile"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <UserCircle className="h-4 w-4" />
                      My Profile
                    </Link>
                    <Link
                      to="/login"
                      onClick={() => {
                        setIsProfileOpen(false);
                        useAppStore.getState().logout();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
            </>
          ) : (
            <Link to="/login" className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-600">
              Sign In
            </Link>
          )}

          {/* Mobile menu */}
          <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-white lg:hidden">
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
