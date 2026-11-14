import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, ShieldCheck, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  {
    label: 'Verified Student (Owner)',
    name: 'Aarav Sharma · CSE 3rd Yr',
    studentId: '22103011',
    password: 'pecdemo123',
    badge: 'Verified',
  },
  {
    label: 'Verified Student (Buyer)',
    name: 'Diya Verma · ECE 2nd Yr',
    studentId: '22104028',
    password: 'pecdemo123',
    badge: 'Verified',
  },
  {
    label: 'Unverified Student',
    name: 'Kabir Mehta · PIE 1st Yr',
    studentId: '24109099',
    password: 'pecdemo123',
    badge: 'Pending',
  },
  {
    label: 'Shop Owner (Verka Booth)',
    name: 'Verka Booth Manager · PEC Market',
    studentId: 'SHOP-VERKA',
    password: 'pecshop123',
    badge: 'Shop Owner',
  },
  {
    label: 'Shop Owner (Nescafe)',
    name: 'Nescafe Corner Manager · LTC',
    studentId: 'SHOP-NESCAFE',
    password: 'pecshop123',
    badge: 'Shop Owner',
  },
  {
    label: 'Campus Administrator',
    name: 'PEC Moderator',
    studentId: 'ADMIN-PEC',
    password: 'pecadmin123',
    badge: 'Admin',
  },
];

export function LoginPage() {
  const { loginWithStudentId, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await loginWithStudentId(studentId, password, rememberMe);
      toast.success(`Welcome back, ${user.fullName}`);
      navigate(user.role === 'shop_owner' ? '/app/shop-dashboard' : '/app');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoId: string, demoPass: string) => {
    setStudentId(demoId);
    setPassword(demoPass);
    setError(null);
    setSubmitting(true);
    try {
      const user = await loginWithStudentId(demoId, demoPass, true);
      toast.success(`Signed in as ${user.fullName} (${user.studentId})`);
      navigate(user.role === 'shop_owner' ? '/app/shop-dashboard' : '/app');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Demo login failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const user = await loginWithGoogle();
      toast.success(`Signed in as ${user.fullName}`);
      navigate('/app');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Google Sign-In failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <header className="border-b border-zinc-200 bg-white px-4 sm:px-8 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="font-display text-xl font-bold tracking-tight text-zinc-900"
        >
          PingME
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/explore" className="text-zinc-600 hover:text-zinc-900">
            Browse Marketplace
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/register">Create Account</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-10 sm:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Login Card */}
        <div className="lg:col-span-6 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
          <p className="text-xs font-medium text-teal-700">
            PEC Student Portal
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-zinc-900">
            Sign in to PingME
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Use your PEC Student Identification Number and PingME password.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="studentId"
                className="block text-xs font-medium text-zinc-700 mb-1.5"
              >
                Student Identification Number
              </label>
              <Input
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. 22103011"
                required
                className="font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-zinc-700"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs font-medium text-teal-700 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your PingME password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-600"
              />
              Remember me on this device
            </label>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs text-zinc-400">or</span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={submitting}
          >
            Continue with Google (@pec.edu.in)
          </Button>

          <p className="mt-6 text-center text-xs text-zinc-600">
            New to PingME Campus Exchange?{' '}
            <Link
              to="/register"
              className="font-semibold text-teal-700 hover:underline"
            >
              Create Student Account
            </Link>
          </p>
        </div>

        {/* Demo Access Panel for Hackathon Judges */}
        <div className="lg:col-span-6 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-2 text-teal-700 text-xs font-semibold">
            <KeyRound className="h-4 w-4" />
            <span>Demo Access Credentials (Hackathon Evaluation)</span>
          </div>
          <h2 className="mt-1.5 font-display text-lg font-bold text-zinc-900">
            Quick Sign-In for Judges
          </h2>
          <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
            Test multi-student QR handovers, buyer/owner approval flows,
            unverified account restrictions, and admin moderation using these
            pre-seeded accounts.
          </p>

          <div className="mt-5 space-y-3">
            {DEMO_ACCOUNTS.map((acc) => (
              <div
                key={acc.studentId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-[#FAFAFA] p-3.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-900">
                      {acc.label}
                    </p>
                    <span
                      className={`text-[11px] font-medium ${
                        acc.badge === 'Verified'
                          ? 'text-teal-700'
                          : acc.badge === 'Admin'
                            ? 'text-zinc-900'
                            : 'text-amber-700'
                      }`}
                    >
                      · {acc.badge}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{acc.name}</p>
                  <p className="font-mono text-[11px] text-zinc-500 mt-1">
                    ID: {acc.studentId} · Pass: {acc.password}
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => handleDemoLogin(acc.studentId, acc.password)}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Sign In
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
            <ShieldCheck className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
            <p>
              Note: PingME uses an independent PEC student verification model for
              this prototype rather than official campus SSO credentials.
            </p>
          </div>
        </div>
      </main>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Recovery</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-zinc-600 space-y-3">
            <p>
              To reset your PingME password, contact PEC Campus Support at{' '}
              <span className="font-mono text-zinc-900">
                pingme-support@pec.edu.in
              </span>{' '}
              from your registered <span className="font-mono">@pec.edu.in</span>{' '}
              mailbox, or update your password anytime from{' '}
              <strong>My Profile</strong> once signed in.
            </p>
            <p className="text-xs text-zinc-500">
              For hackathon testing, use any demo student account on the right
              panel.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
