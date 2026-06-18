import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Card   from '../components/common/Card';
import Input  from '../components/common/Input';
import { authApi } from '../services/api';
import { useAppStore } from '../store/useAppStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await authApi.login(email, password);

      if (data.token) {
        localStorage.setItem('vg_token', data.token);
      }
      if (data.teacher) {
        localStorage.setItem('vg_user', JSON.stringify(data.teacher));
        setUser({
          name: data.teacher.name,
          email: data.teacher.email,
          role: 'Faculty Evaluator',
          institution: data.teacher.institution || 'Thapar Institute of Engineering & Technology',
        });
      }

      navigate('/dashboard');
    } catch (err) {
      setError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Login failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100" />
      <motion.div className="absolute left-10 top-10 h-56 w-56 rounded-full bg-blue-100 blur-3xl" animate={{ y: [0, 12, 0] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div className="absolute bottom-8 right-10 h-72 w-72 rounded-full bg-blue-50 blur-3xl" animate={{ y: [0, -16, 0] }} transition={{ duration: 10, repeat: Infinity }} />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <Card className="w-full p-8 sm:p-10">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-600">VisionGrade</p>
              <h1 className="text-2xl font-bold text-slate-900">Faculty Sign In</h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-500">
            Access the AI-assisted academic evaluation workspace with secure password login.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <Input
              label="Email address"
              type="email"
              placeholder="faculty@visiongrade.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />

            {/* Error banner */}
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

            <div className="flex items-center justify-between text-sm text-slate-500">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 bg-slate-50" />
                Remember me
              </label>
              <button type="button" className="text-blue-600 transition hover:text-blue-600">
                Forgot password?
              </button>
            </div>

            <div className="mt-8 space-y-4">
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                icon={loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ShieldCheck className="h-4 w-4" />
                }
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
              <Button to="/" variant="secondary" className="w-full" disabled={loading}>
                Back to Home
              </Button>
            </div>

            <p className="mt-6 text-center text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <a href="/register" className="text-blue-600 hover:text-blue-600 transition-colors font-medium">
                Register here
              </a>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
