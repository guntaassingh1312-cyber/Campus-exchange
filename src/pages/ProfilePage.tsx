import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Crown, Gift, ShieldAlert, ShieldCheck, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { QrCodeCard } from '../components/qr/QrCodeCard';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { formatDate } from '../lib/utils';

interface ProfileStatsResponse {
  rating: number;
  reviewCount: number;
  completedTransactionsCount: number;
  activeListingsCount: number;
  reviews: {
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
    reviewer: { fullName: string } | null;
  }[];
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [academicYear, setAcademicYear] = useState(user?.academicYear || '');
  const [hostelBlock, setHostelBlock] = useState(user?.hostelBlock || '');
  const [bio, setBio] = useState(user?.bio || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [stats, setStats] = useState<ProfileStatsResponse | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setDepartment(user.department);
    setAcademicYear(user.academicYear);
    setHostelBlock(user.hostelBlock || '');
    setBio(user.bio || '');

    apiFetch<ProfileStatsResponse>(`/api/users/${user.id}/public`)
      .then(setStats)
      .catch(() => {});
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          department,
          academicYear,
          hostelBlock,
          bio,
        }),
      });
      await refreshUser();
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success('Password updated securely.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Password update failed.'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-900">
          My Student Profile & Trust Score
        </h1>
        <p className="text-sm text-zinc-600 mt-0.5">
          Manage your PEC identity details, security credentials, and PingME QR
          badge.
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Verification</p>
          <p
            className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${
              user.verificationStatus === 'verified'
                ? 'text-teal-700'
                : 'text-amber-700'
            }`}
          >
            {user.verificationStatus === 'verified' ? (
              <>
                <ShieldCheck className="h-4 w-4" />
                Verified PEC
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                Pending Review
              </>
            )}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Seller Rating</p>
          <p className="mt-1 inline-flex items-center gap-1 text-lg font-bold text-zinc-900 tabular-nums">
            <Star className="h-4 w-4 text-amber-500 fill-current" />
            {stats?.rating ?? '5.0'}{' '}
            <span className="text-xs font-normal text-zinc-500">
              ({stats?.reviewCount ?? 0})
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Active Listings</p>
          <p className="mt-1 text-lg font-bold text-zinc-900 tabular-nums">
            {stats?.activeListingsCount ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Completed Exchanges</p>
          <p className="mt-1 text-lg font-bold text-zinc-900 tabular-nums">
            {stats?.completedTransactionsCount ?? 0}
          </p>
        </div>
      </div>

      {/* Membership & Referral Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5 text-amber-600" />
              PingME Membership
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {user.isPremium ? 'Premium Member (Active)' : 'Standard Free Plan'}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {user.isPremium
                ? 'Full seller analytics & priority support enabled.'
                : 'Unlock listing views, conversion trends & priority support.'}
            </p>
          </div>
          <Button asChild size="sm" variant={user.isPremium ? 'outline' : 'default'}>
            <Link to="/app/premium-analytics">
              {user.isPremium ? 'Open Analytics' : 'Upgrade'}
            </Link>
          </Button>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 flex items-center gap-1.5">
              <Gift className="h-3.5 w-3.5 text-teal-700" />
              Your PEC Referral Code
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-zinc-900 truncate">
              {user.referralCode || `PEC-${user.studentId}`}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Earn commission on verified peer transactions.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                const code = user.referralCode || `PEC-${user.studentId}`;
                try {
                  await navigator.clipboard.writeText(code);
                  toast.success(`Referral code ${code} copied.`);
                } catch {
                  toast.info(code);
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/referrals">Rewards</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Forms */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-zinc-900">
              Student Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-zinc-500 bg-zinc-50 rounded-lg p-3">
              <div>
                <span>Student ID (Publicly Masked): </span>
                <span className="font-mono font-semibold text-zinc-900">
                  {user.studentId} ({user.maskedStudentId})
                </span>
              </div>
              <div>
                <span>Email: </span>
                <span className="font-mono text-zinc-900">
                  {user.institutionalEmail}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Full Name
                </label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Hostel / Campus Block
                </label>
                <Input
                  value={hostelBlock}
                  onChange={(e) => setHostelBlock(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Department
                </label>
                <Input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Academic Year
                </label>
                <Input
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Short Campus Bio
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              />
            </div>

            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          </form>

          <form
            onSubmit={handlePasswordChange}
            className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-zinc-900">
              Update Password
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Current Password
                </label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  New Password (min 6 chars)
                </label>
                <Input
                  type="password"
                  minLength={6}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={savingPassword}
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </div>

        {/* Right QR & Reviews */}
        <div className="lg:col-span-5 space-y-6">
          <QrCodeCard
            value={`PINGME:PROFILE:${user.studentId}`}
            title={user.fullName}
            subtitle={`${user.department} · ${user.verificationStatus === 'verified' ? 'Verified Student' : 'Unverified'}`}
            codeLabel={user.maskedStudentId}
            size={190}
          />

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-3">
              Student Reviews ({stats?.reviews.length ?? 0})
            </h2>
            {!stats || stats.reviews.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Complete a campus exchange to receive student ratings.
              </p>
            ) : (
              <div className="space-y-3 divide-y divide-zinc-100">
                {stats.reviews.map((rv) => (
                  <div key={rv.id} className="pt-3 first:pt-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-900">
                        {rv.reviewer?.fullName || 'PEC Student'}
                      </span>
                      <span className="font-mono text-amber-600">
                        {rv.rating}.0 ★
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-1">{rv.comment}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {formatDate(rv.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
