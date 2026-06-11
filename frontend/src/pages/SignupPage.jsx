import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Card   from '../components/common/Card';
import Input  from '../components/common/Input';
import { authApi } from '../services/api';

export default function SignupPage() {
  const navigate = useNavigate();
  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authApi.register({ name, email, password });
      navigate('/verify-otp', { state: { email } });
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_25%),linear-gradient(180deg,#020617_0%,#071226_55%,#0f172a_100%)]" />
      <motion.div className="absolute left-10 top-10 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" animate={{ y: [0, 12, 0] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div className="absolute bottom-8 right-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" animate={{ y: [0, -16, 0] }} transition={{ duration: 10, repeat: Infinity }} />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <Card className="w-full p-8 sm:p-10">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300/80">VisionGrade</p>
              <h1 className="text-2xl font-bold text-white">Faculty Sign Up</h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-400">
            Create an account to start evaluating answer sheets with AI assistance.
          </p>

          <form onSubmit={handleSignup} className="mt-8 space-y-5">
            <Input
              label="Full Name"
              type="text"
              placeholder="Dr. John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
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
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />

            {/* Error banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <p className="text-xs text-rose-300">{error}</p>
              </motion.div>
            )}

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
                {loading ? 'Creating account…' : 'Sign Up'}
              </Button>
              <Button to="/login" variant="secondary" className="w-full" disabled={loading}>
                Sign in instead
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
