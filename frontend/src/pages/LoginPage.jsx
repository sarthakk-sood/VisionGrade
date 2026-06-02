import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles } from 'lucide-react';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';

export default function LoginPage() {
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
              <h1 className="text-2xl font-bold text-white">Faculty Sign In</h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-400">
            Access the AI-assisted academic evaluation workspace with secure password login.
          </p>

          <div className="mt-8 space-y-5">
            <Input label="Email address" type="email" placeholder="faculty@visiongrade.edu" />
            <Input label="Password" type="password" placeholder="Enter your password" />
          </div>

          <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 rounded border-white/20 bg-white/5" />
              Remember me
            </label>
            <button type="button" className="text-blue-300 transition hover:text-blue-200">Forgot password?</button>
          </div>

          <div className="mt-8 space-y-4">
            <Button to="/dashboard" className="w-full" icon={<ShieldCheck className="h-4 w-4" />}>Sign In</Button>
            <Button to="/" variant="secondary" className="w-full">Back to Home</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
