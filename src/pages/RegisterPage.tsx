import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Gift, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';

const registerFormSchema = z
  .object({
    fullName: z.string().min(2, 'Full name is required'),
    studentId: z
      .string()
      .min(4, 'Enter your PEC Student ID (e.g. 23103045)'),
    institutionalEmail: z.string().email('Enter a valid email address'),
    department: z.string().min(2, 'Select your department'),
    academicYear: z.string().min(2, 'Select your academic year'),
    hostelBlock: z.string().optional(),
    referralCode: z.string().max(40).optional(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerFormSchema>;

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Aerospace Engineering',
  'Metallurgical & Materials Engineering',
  'Production & Industrial Engineering',
];

const YEARS = [
  '1st Year (Sem 1-2)',
  '2nd Year (Sem 3-4)',
  '3rd Year (Sem 5-6)',
  '4th Year (Sem 7-8)',
  'M.Tech / PhD',
];

export function RegisterPage() {
  const { registerStudent } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRef = searchParams.get('ref') || '';
  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      department: DEPARTMENTS[0],
      academicYear: YEARS[1],
      hostelBlock: 'Himalaya Hostel',
      referralCode: initialRef,
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    try {
      const user = await registerStudent({
        fullName: values.fullName,
        studentId: values.studentId,
        institutionalEmail: values.institutionalEmail,
        department: values.department,
        academicYear: values.academicYear,
        hostelBlock: values.hostelBlock,
        referralCode: values.referralCode?.trim() || undefined,
        password: values.password,
      });

      toast.success(
        user.verificationStatus === 'verified'
          ? 'Account created and verified via PEC credentials!'
          : 'Account created (Pending Admin Verification).'
      );
      navigate('/app');
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Unable to complete registration.'
      );
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
            Marketplace
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
          <p className="text-xs font-medium text-teal-700">
            Student Onboarding · PEC Chandigarh
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-zinc-900">
            Create your PingME Account
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Accounts with a valid <span className="font-mono">@pec.edu.in</span>{' '}
            email or PEC batch roll number (e.g. <span className="font-mono">23103045</span>)
            are verified automatically; others enter Moderator Review.
          </p>

          {serverError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Full Name
                </label>
                <Input
                  {...register('fullName')}
                  placeholder="e.g. Ananya Verma"
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  PEC Student Identification Number
                </label>
                <Input
                  {...register('studentId')}
                  placeholder="e.g. 23103045"
                  className="font-mono"
                />
                {errors.studentId && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.studentId.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Institutional Email Address
                </label>
                <Input
                  type="email"
                  {...register('institutionalEmail')}
                  placeholder="name@pec.edu.in"
                />
                {errors.institutionalEmail && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.institutionalEmail.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Hostel / Campus Block
                </label>
                <Input
                  {...register('hostelBlock')}
                  placeholder="e.g. Himalaya Hostel"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Department
                </label>
                <select
                  {...register('department')}
                  className="flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Academic Year / Semester
                </label>
                <select
                  {...register('academicYear')}
                  className="flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    {...register('password')}
                    placeholder="Minimum 6 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700"
                  >
                    {showPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Confirm Password
                </label>
                <Input
                  type={showPass ? 'text' : 'password'}
                  {...register('confirmPassword')}
                  placeholder="Re-enter password"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 mb-1.5">
                <Gift className="h-3.5 w-3.5 text-teal-700" />
                Peer Referral Code (Optional)
              </label>
              <Input
                {...register('referralCode')}
                placeholder="e.g. PEC-22103011"
                className="font-mono uppercase"
              />
              {initialRef && (
                <p className="mt-1 text-[11px] text-teal-700">
                  Referral code pre-filled from invite link.
                </p>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
              <ShieldCheck className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
              <span>
                Your password is salted and hashed before storage. Your Student
                ID is masked on public product pages.
              </span>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Account...' : 'Create PingME Account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-zinc-600">
            Already registered?{' '}
            <Link
              to="/login"
              className="font-semibold text-teal-700 hover:underline"
            >
              Sign in with Student ID
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
