import { motion } from 'framer-motion';
import { UserCircle, Mail, Building, Key, LogOut } from 'lucide-react';
import Navbar        from '../components/layout/Navbar';
import Sidebar       from '../components/layout/Sidebar';
import PageContainer from '../components/layout/PageContainer';
import Card          from '../components/common/Card';
import Button        from '../components/common/Button';
import { useAppStore } from '../store/useAppStore';
import { PAGE_BG } from '../utils/theme';


export default function ProfilePage() {
  const user = useAppStore((s) => s.user);
  const initials = user.name.split(' ').map((n) => n[0]).join('').slice(0, 2);

  return (
    <div className={PAGE_BG}>
      <Navbar />
      <PageContainer subtitle="SETTINGS" title="My Profile">
        <div className="flex flex-col gap-6 lg:flex-row">
          <Sidebar />

          <div className="flex-1 min-w-0 space-y-6 max-w-3xl">
            
            {/* ── Profile Header ── */}
            <Card>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 text-3xl font-black text-slate-900 shadow-xl shadow-blue-500/20">
                  {initials}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{user.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {user.email || 'faculty@visiongrade.ai'}</span>
                    <span className="flex items-center gap-1.5"><Building className="h-4 w-4" /> {user.department || 'Computer Science'}</span>
                  </div>
                  <div className="mt-4">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-600">
                      {user.role || 'System Admin'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Account Details ── */}
            <Card>
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Account</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">Personal Information</h3>
              </div>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Full Name</label>
                    <input type="text" readOnly value={user.name} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Email Address</label>
                    <input type="text" readOnly value={user.email || 'faculty@visiongrade.ai'} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Department</label>
                    <input type="text" readOnly value={user.department || 'Computer Science & Engineering'} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Employee ID</label>
                    <input type="text" readOnly value="FAC-2026-042" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500" />
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
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Security</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">Password & Authentication</h3>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Password</p>
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
                  <p className="mt-1 text-xs text-slate-500">Securely log out of your VisionGrade account.</p>
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
