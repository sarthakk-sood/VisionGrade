import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle, Mail, Building, Key, LogOut, Check, X, AlertCircle } from 'lucide-react';
import Navbar        from '../components/layout/Navbar';
import Sidebar       from '../components/layout/Sidebar';
import PageContainer from '../components/layout/PageContainer';
import Card          from '../components/common/Card';
import Button        from '../components/common/Button';
import { useAppStore } from '../store/useAppStore';
import { authApi } from '../services/api';
import { PAGE_BG } from '../utils/theme';

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const logout = useAppStore((s) => s.logout);
  const initials = user.name.split(' ').map((n) => n[0]).join('').slice(0, 2);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: user.name || '', department: user.department || '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const startEditing = () => {
    setForm({ name: user.name || '', department: user.department || '' });
    setProfileError('');
    setProfileSuccess('');
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!form.name.trim()) {
      setProfileError('Name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    setProfileError('');
    try {
      const data = await authApi.updateProfile({ name: form.name.trim(), department: form.department.trim() });
      const updated = { ...user, name: data.teacher.name, department: data.teacher.department };
      setUser(updated);
      const stored = JSON.parse(localStorage.getItem('vg_user') || '{}');
      localStorage.setItem('vg_user', JSON.stringify({ ...stored, ...data.teacher }));
      setIsEditing(false);
      setProfileSuccess('Profile updated.');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err) {
      setProfileError(err?.response?.data?.error || err.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const startChangingPassword = () => {
    setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setPasswordSuccess('');
    setIsChangingPassword(true);
  };

  const handleChangePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) {
      setPasswordError('Both current and new password are required.');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setSavingPassword(true);
    setPasswordError('');
    try {
      await authApi.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setIsChangingPassword(false);
      setPasswordSuccess('Password updated successfully.');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err) {
      setPasswordError(err?.response?.data?.error || err.message || 'Could not change password.');
    } finally {
      setSavingPassword(false);
    }
  };

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
                    <span className="flex items-center gap-1.5"><Building className="h-4 w-4" /> {user.department || 'No department set'}</span>
                  </div>
                  <div className="mt-4">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-600">
                      {user.role || 'Faculty Evaluator'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Account Details ── */}
            <Card>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Account</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">Personal Information</h3>
                </div>
                {profileSuccess && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> {profileSuccess}
                  </span>
                )}
              </div>

              {profileError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                  <p className="text-xs text-rose-600">{profileError}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Full Name</label>
                    <input
                      type="text"
                      readOnly={!isEditing}
                      value={isEditing ? form.name : user.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
                        isEditing
                          ? 'border-blue-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-200'
                          : 'border-slate-200 bg-slate-50 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Email Address</label>
                    <input type="text" readOnly value={user.email || 'faculty@visiongrade.ai'} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Department</label>
                    <input
                      type="text"
                      readOnly={!isEditing}
                      value={isEditing ? form.department : (user.department || '')}
                      placeholder="e.g. Computer Science & Engineering"
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                      className={`w-full rounded-xl border px-4 py-2.5 text-sm ${
                        isEditing
                          ? 'border-blue-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-200'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Institution</label>
                    <input type="text" readOnly value={user.institution || 'Not set'} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  {isEditing ? (
                    <>
                      <Button size="sm" onClick={handleSaveProfile} loading={savingProfile} icon={<Check className="h-4 w-4" />}>
                        Save Changes
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)} disabled={savingProfile} icon={<X className="h-4 w-4" />}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" size="sm" icon={<UserCircle className="h-4 w-4" />} onClick={startEditing}>
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* ── Security ── */}
            <Card>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Security</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">Password & Authentication</h3>
                </div>
                {passwordSuccess && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <Check className="h-3.5 w-3.5" /> {passwordSuccess}
                  </span>
                )}
              </div>

              {passwordError && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                  <p className="text-xs text-rose-600">{passwordError}</p>
                </div>
              )}

              {isChangingPassword ? (
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Current Password</label>
                    <input
                      type="password"
                      value={pwForm.currentPassword}
                      onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-200"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">New Password</label>
                      <input
                        type="password"
                        value={pwForm.newPassword}
                        onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Confirm New Password</label>
                      <input
                        type="password"
                        value={pwForm.confirmPassword}
                        onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-200"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={handleChangePassword} loading={savingPassword} icon={<Check className="h-4 w-4" />}>
                      Update Password
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setIsChangingPassword(false)} disabled={savingPassword} icon={<X className="h-4 w-4" />}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                      <Key className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Password</p>
                      <p className="text-xs text-slate-500">Keep your account secure with a strong password.</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={startChangingPassword}>Change Password</Button>
                </div>
              )}
            </Card>

            {/* ── Danger Zone ── */}
            <Card variant="danger" className="border-rose-400/20 bg-rose-500/[0.02]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-rose-400">Sign Out</h3>
                  <p className="mt-1 text-xs text-slate-500">Securely log out of your VisionGrade account.</p>
                </div>
                <Button
                  variant="danger"
                  icon={<LogOut className="h-4 w-4" />}
                  onClick={() => { logout(); navigate('/login'); }}
                >
                  Sign Out
                </Button>
              </div>
            </Card>

          </div>
        </div>
      </PageContainer>
    </div>
  );
}
