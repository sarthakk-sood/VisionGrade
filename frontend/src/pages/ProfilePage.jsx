import { motion } from 'framer-motion';
import { UserCircle, Mail, Building, Key, LogOut } from 'lucide-react';
import Navbar        from '../components/layout/Navbar';
import Sidebar       from '../components/layout/Sidebar';
import PageContainer from '../components/layout/PageContainer';
import Card          from '../components/common/Card';
import Button        from '../components/common/Button';
import { useAppStore } from '../store/useAppStore';

const BG = 'bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_22%),linear-gradient(180deg,#020617_0%,#071226_55%,#0f172a_100%)]';

export default function ProfilePage() {
  const user = useAppStore((s) => s.user);
  const initials = user.name.split(' ').map((n) => n[0]).join('').slice(0, 2);

  return (
    <div className={`min-h-screen ${BG}`}>
      <Navbar />
      <PageContainer subtitle="SETTINGS" title="My Profile">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0 space-y-6 max-w-3xl">
            
            {/* ── Profile Header ── */}
            <Card>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 text-3xl font-black text-white shadow-xl shadow-blue-500/20">
                  {initials}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">{user.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                    <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {user.email || 'faculty@visiongrade.ai'}</span>
                    <span className="flex items-center gap-1.5"><Building className="h-4 w-4" /> {user.department || 'Computer Science'}</span>
                  </div>
                  <div className="mt-4">
                    <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-300">
                      {user.role || 'System Admin'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Account Details ── */}
            <Card>
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Account</p>
                <h3 className="mt-1 text-lg font-bold text-white">Personal Information</h3>
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Full Name</label>
                    <input type="text" readOnly value={user.name} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Email Address</label>
                    <input type="text" readOnly value={user.email || 'faculty@visiongrade.ai'} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-slate-400" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Department</label>
                    <input type="text" readOnly value={user.department || 'Computer Science & Engineering'} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-slate-400" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Employee ID</label>
                    <input type="text" readOnly value="FAC-2026-042" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-slate-400" />
                  </div>
                </div>
                <div className="pt-2">
                  <Button variant="secondary" size="sm">Edit Profile</Button>
                </div>
              </div>
            </Card>

            {/* ── Security ── */}
            <Card>
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">Security</p>
                <h3 className="mt-1 text-lg font-bold text-white">Password & Authentication</h3>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-slate-400">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Password</p>
                    <p className="text-xs text-slate-500">Last changed 3 months ago</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm">Change Password</Button>
              </div>
            </Card>

            {/* ── Danger Zone ── */}
            <Card variant="danger" className="border-rose-400/20 bg-rose-500/[0.02]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-rose-400">Sign Out</h3>
                  <p className="mt-1 text-xs text-slate-400">Securely log out of your VisionGrade account.</p>
                </div>
                <Button to="/login" variant="danger" icon={<LogOut className="h-4 w-4" />}>Sign Out</Button>
              </div>
            </Card>

          </div>
        </div>
      </PageContainer>
    </div>
  );
}
