import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MailCheck, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/common/Button';
import Card   from '../components/common/Card';
import Input  from '../components/common/Input';
import { authApi } from '../services/api';

export default function OTPVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp,      setOtp]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate('/signup', { replace: true });
    }
  }, [email, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }

    setLoading(true);
    try {
      await authApi.verifyOTP(email, otp);
      navigate('/login');
    } catch (err) {
      setError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Verification failed. Please check your OTP and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    alert('Please go back to signup to generate a new OTP.');
  };

  if (!email) return null;

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_25%),linear-gradient(180deg,#020617_0%,#071226_55%,#0f172a_100%)]" />
      <motion.div className="absolute left-10 top-10 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" animate={{ y: [0, 12, 0] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div className="absolute bottom-8 right-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" animate={{ y: [0, -16, 0] }} transition={{ duration: 10, repeat: Infinity }} />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <Card className="w-full p-8 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/20 mb-6">
              <MailCheck className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
            <p className="text-sm leading-6 text-slate-400 mb-8">
              We sent a 6-digit verification code to <span className="font-semibold text-white">{email}</span>. Please enter it below.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-5">
            <div className="text-center">
              <Input
                label="Verification Code"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
                className="text-center tracking-widest text-lg font-mono"
              />
            </div>

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
                disabled={loading || otp.length !== 6}
                icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              >
                {loading ? 'Verifying…' : 'Verify Account'}
              </Button>
              
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Didn't receive the code?
                </button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
