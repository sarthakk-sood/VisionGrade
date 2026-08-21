import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Card   from '../components/common/Card';
import Input  from '../components/common/Input';
import { authApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';

export default function SignupPage() {
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);
  const [name,       setName]       = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [department, setDepartment] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name || !email || !password) {
      setError('Name, email and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.register({ name, email, password, department });

      if (data.token) {
        localStorage.setItem('vg_token', data.token);
      }
      if (data.teacher) {
        localStorage.setItem('vg_user', JSON.stringify(data.teacher));
        setUser({
          name: data.teacher.name,
          email: data.teacher.email,
          role: 'Faculty Evaluator',
          department: data.teacher.department || '',
          institution: data.teacher.institution || 'Thapar Institute of Engineering & Technology',
        });
      }

      navigate('/dashboard');
    } catch (err) {
      setError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <Card className="w-full p-8 sm:p-10">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-600">VisionGrade</p>
              <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
            </div>
          </div>

          <form onSubmit={handleRegister} className="mt-8 space-y-5">
            <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
            <Input label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            <Input label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} disabled={loading} placeholder="e.g. Computer Science" />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={loading} />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-50 p-3"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <p className="text-xs text-rose-600">{error}</p>
              </motion.div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            >
              {loading ? 'Creating account…' : 'Register'}
            </Button>

            <p className="text-center text-sm text-slate-500">
              Already have an account?{' '}
              <a href="/login" className="text-blue-600 hover:text-blue-600 transition-colors font-medium">
                Sign in
              </a>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
