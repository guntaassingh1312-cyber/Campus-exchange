import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  Plus,
  Save,
  ShieldAlert,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  apiFetch,
  type AccountRestrictionItem,
  type AdminMonetizationResponse,
  type CategoryItem,
  type ModerationLogItem,
  type PlatformSettings,
  type Product,
  type ShopReviewItem,
  type UserProfile,
} from '../lib/api';
import { formatDate, formatDateTime, formatINR } from '../lib/utils';

interface AdminOverview {
  users: UserProfile[];
  products: Product[];
  transactions: {
    id: string;
    transactionCode: string;
    transactionType: string;
    transactionStatus: string;
    totalAmount: number;
    createdAt: string;
  }[];
  qrScanLogs: {
    id: string;
    scanAction: string;
    status: string;
    details: string;
    createdAt: string;
  }[];
  reports: {
    id: string;
    reason: string;
    status: string;
    productId: string | null;
    createdAt: string;
  }[];
  categories: CategoryItem[];
  stats: {
    totalUsers: number;
    verifiedUsers: number;
    pendingUsers: number;
    totalProducts: number;
    totalTransactions: number;
    totalQrScans: number;
    openReports: number;
  };
}

interface AdminEateriesModeration {
  restrictions: AccountRestrictionItem[];
  shopReviews: ShopReviewItem[];
  moderationLogs: ModerationLogItem[];
}

export function AdminDashboardPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [eateryMod, setEateryMod] = useState<AdminEateriesModeration | null>(null);
  const [monetization, setMonetization] =
    useState<AdminMonetizationResponse | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<
    Partial<PlatformSettings>
  >({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const [res, eatRes, monRes] = await Promise.all([
        apiFetch<AdminOverview>('/api/admin/overview'),
        apiFetch<AdminEateriesModeration>('/api/admin/eateries'),
        apiFetch<AdminMonetizationResponse>('/api/admin/monetization'),
      ]);
      setData(res);
      setEateryMod(eatRes);
      setMonetization(monRes);
      setSettingsDraft(monRes.settings);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Admin access denied or failed.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  const verifyUser = async (
    userId: string,
    status: 'verified' | 'pending' | 'rejected'
  ) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success(`Student status updated to ${status}.`);
      await loadAdmin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed.');
    }
  };

  const removeProduct = async (productId: string) => {
    try {
      await apiFetch(`/api/products/${productId}`, { method: 'DELETE' });
      toast.success('Inappropriate listing removed.');
      await loadAdmin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await apiFetch('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: newCatName.trim(),
          description: newCatDesc.trim(),
          subcategories: ['General'],
        }),
      });
      setNewCatName('');
      setNewCatDesc('');
      toast.success('Category added.');
      await loadAdmin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to add category.');
    }
  };

  const deleteCategory = async (catId: number) => {
    try {
      await apiFetch(`/api/categories/${catId}`, { method: 'DELETE' });
      toast.success('Category deleted.');
      await loadAdmin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const updateReport = async (
    reportId: string,
    status: 'resolved' | 'dismissed'
  ) => {
    try {
      await apiFetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success(`Report ${status}.`);
      await loadAdmin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Report update failed.');
    }
  };

  const handleRestrictionAction = async (
    restrictionId: string,
    action:
      | 'approve_restriction'
      | 'dismiss_restriction'
      | 'approve_appeal'
      | 'reject_appeal'
  ) => {
    try {
      await apiFetch(`/api/admin/restrictions/${restrictionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, expiryDays: 7 }),
      });
      toast.success('Moderation action applied and logged.');
      await loadAdmin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const handleModerateReview = async (
    reviewId: string,
    moderationStatus: 'visible' | 'flagged' | 'hidden',
    reason: string
  ) => {
    try {
      await apiFetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PATCH',
        body: JSON.stringify({ moderationStatus, reason }),
      });
      toast.success(`Review marked ${moderationStatus}.`);
      await loadAdmin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Review update failed.');
    }
  };

  const handleSaveMonetizationSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiFetch('/api/admin/monetization/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          boostBasicPrice: Number(settingsDraft.boostBasicPrice),
          boostBasicHours: Number(settingsDraft.boostBasicHours),
          boostStandardPrice: Number(settingsDraft.boostStandardPrice),
          boostStandardHours: Number(settingsDraft.boostStandardHours),
          boostPremiumPrice: Number(settingsDraft.boostPremiumPrice),
          boostPremiumHours: Number(settingsDraft.boostPremiumHours),
          premiumPrice: Number(settingsDraft.premiumPrice),
          premiumDurationDays: Number(settingsDraft.premiumDurationDays),
          referralCommissionPct: Number(settingsDraft.referralCommissionPct),
          referralMinOrderAmount: Number(settingsDraft.referralMinOrderAmount),
          referralDisputeWindowHours: Number(
            settingsDraft.referralDisputeWindowHours
          ),
        }),
      });
      toast.success('Platform pricing & referral rules updated.');
      await loadAdmin();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save settings.'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleWithdrawalUpdate = async (
    id: string,
    status: 'approved' | 'paid' | 'rejected'
  ) => {
    try {
      await apiFetch(`/api/admin/monetization/withdrawals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success(`Withdrawal marked ${status}.`);
      await loadAdmin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handlePromotionStatus = async (
    id: string,
    promotionStatus: 'active' | 'suspended' | 'cancelled' | 'expired'
  ) => {
    try {
      await apiFetch(`/api/admin/monetization/promotions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ promotionStatus }),
      });
      toast.success(`Promotion marked ${promotionStatus}.`);
      await loadAdmin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleReferralStatus = async (
    id: string,
    rewardStatus: 'pending' | 'credited' | 'rejected' | 'reversed'
  ) => {
    try {
      await apiFetch(`/api/admin/monetization/referrals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          rewardStatus,
          adminNote: `Reviewed by admin (${rewardStatus})`,
        }),
      });
      toast.success(`Referral commission marked ${rewardStatus}.`);
      await loadAdmin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleUserSuspensionToggle = async (
    userId: string,
    payload: { referralSuspended?: boolean; boostSuspended?: boolean }
  ) => {
    try {
      await apiFetch(`/api/admin/monetization/users/${userId}/suspend`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      toast.success('User monetization privilege updated.');
      await loadAdmin();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading Admin Console...</p>;
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Unable to load Admin Dashboard. Ensure you are signed in as an
        authorized PEC moderator.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-teal-700" />
        <h1 className="font-display text-2xl font-bold text-zinc-900">
          Admin & Campus Moderation Console
        </h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Users', value: data.stats.totalUsers },
          { label: 'Verified Students', value: data.stats.verifiedUsers },
          { label: 'Pending Review', value: data.stats.pendingUsers },
          { label: 'Active Listings', value: data.stats.totalProducts },
          { label: 'Transactions', value: data.stats.totalTransactions },
          { label: 'QR Scans Logged', value: data.stats.totalQrScans },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-200 bg-white p-4"
          >
            <p className="text-xs text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-xl font-bold text-zinc-900 tabular-nums">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="users">Students ({data.users.length})</TabsTrigger>
          <TabsTrigger value="products">
            Listings ({data.products.length})
          </TabsTrigger>
          <TabsTrigger value="categories">
            Categories ({data.categories.length})
          </TabsTrigger>
          <TabsTrigger value="reports">
            Reports ({data.reports.length})
          </TabsTrigger>
          <TabsTrigger value="eateries">
            Eateries Moderation ({eateryMod?.restrictions.length || 0})
          </TabsTrigger>
          <TabsTrigger value="monetization">
            Monetization &amp; Referrals
          </TabsTrigger>
          <TabsTrigger value="qr">
            QR Telemetry ({data.qrScanLogs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student ID</th>
                  <th className="px-4 py-3 font-semibold">Full Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-mono text-zinc-900">
                      {u.studentId}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {u.fullName}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {u.institutionalEmail}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{u.department}</td>
                    <td className="px-4 py-3 font-semibold capitalize">
                      <span
                        className={
                          u.verificationStatus === 'verified'
                            ? 'text-teal-700'
                            : u.verificationStatus === 'rejected'
                              ? 'text-red-600'
                              : 'text-amber-700'
                        }
                      >
                        {u.verificationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {u.verificationStatus !== 'verified' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => verifyUser(u.id, 'verified')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-teal-700" />
                            Verify
                          </Button>
                        )}
                        {u.verificationStatus !== 'rejected' &&
                          u.role !== 'admin' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => verifyUser(u.id, 'rejected')}
                            >
                              <XCircle className="h-3.5 w-3.5 text-red-600" />
                              Reject
                            </Button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="products">
          <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Code</th>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono">{p.productCode}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {p.title}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{p.category}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {p.sellingPrice
                        ? formatINR(p.sellingPrice)
                        : `${formatINR(p.rentalPriceDaily)}/d`}
                    </td>
                    <td className="px-4 py-3">{p.availabilityStatus}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => removeProduct(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <form
            onSubmit={createCategory}
            className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col sm:flex-row gap-3"
          >
            <Input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New category name"
              required
            />
            <Input
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              placeholder="Short description"
            />
            <Button type="submit">
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </form>

          <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
            {data.categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-zinc-900">{cat.name}</p>
                  <p className="text-xs text-zinc-500">{cat.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => deleteCategory(cat.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
            {data.reports.length === 0 ? (
              <p className="p-8 text-center text-sm text-zinc-500">
                No user or listing reports submitted.
              </p>
            ) : (
              data.reports.map((rep) => (
                <div
                  key={rep.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 text-xs"
                >
                  <div>
                    <p className="font-semibold text-zinc-900">{rep.reason}</p>
                    <p className="text-zinc-500 mt-0.5 tabular-nums">
                      Status: {rep.status} · {formatDateTime(rep.createdAt)}
                    </p>
                  </div>
                  {rep.status === 'open' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateReport(rep.id, 'resolved')}
                      >
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateReport(rep.id, 'dismissed')}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="qr">
          <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.qrScanLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 font-mono tabular-nums whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">{log.scanAction}</td>
                    <td className="px-4 py-3 font-semibold">{log.status}</td>
                    <td className="px-4 py-3 text-zinc-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="eateries" className="space-y-6">
          {/* Flagged Accounts & Appeals */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-zinc-900">
                Flagged Accounts, Restrictions &amp; Appeals
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Review shop-submitted flags (requires 2+ documented incidents)
                before enforcing temporary takeaway restrictions, or resolve
                student appeals.
              </p>
            </div>

            {!eateryMod || eateryMod.restrictions.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">
                No eatery account flags or restriction records yet.
              </p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {eateryMod.restrictions.map((r) => (
                  <div
                    key={r.id}
                    className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-900 text-sm">
                          {r.student?.fullName || 'Student'}
                        </span>
                        <span className="font-mono text-zinc-500">
                          {r.student?.maskedStudentId}
                        </span>
                        <span className="text-zinc-400">·</span>
                        <span className="font-medium text-zinc-700">
                          {r.shopName}
                        </span>
                        <span
                          className={`font-semibold capitalize ${
                            r.restrictionStatus === 'active'
                              ? 'text-red-600'
                              : r.restrictionStatus === 'pending_review'
                                ? 'text-amber-700'
                                : 'text-zinc-500'
                          }`}
                        >
                          · {r.restrictionStatus.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-zinc-700">
                        <strong>Reason:</strong> {r.reason}
                      </p>
                      <p className="font-mono text-[11px] text-zinc-500">
                        Evidence: {r.evidenceReference} · Flagged{' '}
                        {formatDateTime(r.createdAt)}
                        {r.expiresAt &&
                          ` · Expires ${formatDate(r.expiresAt)}`}
                      </p>
                      {r.appealStatus !== 'none' && (
                        <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-zinc-800">
                          <strong>Appeal ({r.appealStatus}):</strong>{' '}
                          {r.appealNote}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      {r.restrictionStatus === 'pending_review' && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              handleRestrictionAction(r.id, 'approve_restriction')
                            }
                          >
                            Approve Restriction (7d)
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleRestrictionAction(r.id, 'dismiss_restriction')
                            }
                          >
                            Dismiss Flag
                          </Button>
                        </>
                      )}
                      {r.appealStatus === 'submitted' && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              handleRestrictionAction(r.id, 'approve_appeal')
                            }
                          >
                            Approve Appeal (Restore)
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() =>
                              handleRestrictionAction(r.id, 'reject_appeal')
                            }
                          >
                            Reject Appeal
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shop Reviews Moderation */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
            <h2 className="font-display text-base font-bold text-zinc-900">
              Shop Reviews Moderation ({eateryMod?.shopReviews.length || 0})
            </h2>
            <div className="divide-y divide-zinc-100">
              {(eateryMod?.shopReviews || []).map((rv) => (
                <div
                  key={rv.id}
                  className="py-3 flex flex-wrap items-start justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900">
                        {rv.shopName}
                      </span>
                      <span className="text-zinc-500">
                        by {rv.student?.fullName || 'Student'}
                      </span>
                      <span className="inline-flex items-center gap-0.5 font-mono font-semibold text-amber-600">
                        {rv.rating}
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                      </span>
                      <span className="font-semibold capitalize text-zinc-500">
                        · {rv.moderationStatus}
                      </span>
                    </div>
                    <p className="text-zinc-600">{rv.comment || '(No comment)'}</p>
                  </div>

                  <div className="flex gap-1.5">
                    {rv.moderationStatus !== 'visible' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleModerateReview(
                            rv.id,
                            'visible',
                            'Verified compliant by admin'
                          )
                        }
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Restore
                      </Button>
                    )}
                    {rv.moderationStatus !== 'flagged' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleModerateReview(
                            rv.id,
                            'flagged',
                            'Flagged for tone/relevance verification'
                          )
                        }
                      >
                        <Flag className="h-3.5 w-3.5" />
                        Flag
                      </Button>
                    )}
                    {rv.moderationStatus !== 'hidden' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() =>
                          handleModerateReview(
                            rv.id,
                            'hidden',
                            'Removed abusive or irrelevant review by admin'
                          )
                        }
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        Hide Abusive
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Logs */}
          <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
            <div className="px-5 py-3.5 border-b border-zinc-100">
              <h2 className="font-display text-base font-bold text-zinc-900">
                Eateries Moderation Audit Trail (
                {eateryMod?.moderationLogs.length || 0})
              </h2>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Details / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(eateryMod?.moderationLogs || []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-zinc-500"
                    >
                      No moderation events logged yet.
                    </td>
                  </tr>
                ) : (
                  (eateryMod?.moderationLogs || []).map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 font-mono tabular-nums whitespace-nowrap">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {log.actor?.fullName || 'Moderator'}
                      </td>
                      <td className="px-4 py-3 font-mono text-teal-700">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{log.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="monetization" className="space-y-6">
          {monetization && (
            <>
              {/* Revenue & Program Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  {
                    label: 'Total Revenue',
                    value: formatINR(monetization.metrics.totalMonetizationRevenue),
                  },
                  {
                    label: 'Boost Revenue',
                    value: formatINR(monetization.metrics.boostRevenue),
                  },
                  {
                    label: 'Premium Revenue',
                    value: formatINR(monetization.metrics.premiumRevenue),
                  },
                  {
                    label: 'Active Boosts',
                    value: monetization.metrics.activePromotionsCount,
                  },
                  {
                    label: 'Premium Users',
                    value: monetization.metrics.activeSubscribersCount,
                  },
                  {
                    label: 'Referral Liability',
                    value: formatINR(
                      monetization.metrics.referralCommissionLiability
                    ),
                  },
                  {
                    label: 'Pending Payouts',
                    value: monetization.metrics.pendingWithdrawalsCount,
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl border border-zinc-200 bg-white p-3.5"
                  >
                    <p className="text-[11px] text-zinc-500">{m.label}</p>
                    <p className="mt-1 text-lg font-bold text-zinc-900 tabular-nums">
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Configurable Pricing & Referral Settings */}
              <form
                onSubmit={handleSaveMonetizationSettings}
                className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-base font-bold text-zinc-900">
                      Pricing &amp; Referral Programme Configuration
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Changes take effect immediately across Boost packages,
                      Premium Membership checkout, and Referral commissions.
                    </p>
                  </div>
                  <Button type="submit" size="sm" disabled={savingSettings}>
                    <Save className="h-3.5 w-3.5" />
                    {savingSettings ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Basic Boost (₹)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={settingsDraft.boostBasicPrice ?? 20}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          boostBasicPrice: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Basic Hours
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={settingsDraft.boostBasicHours ?? 72}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          boostBasicHours: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Standard Boost (₹)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={settingsDraft.boostStandardPrice ?? 35}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          boostStandardPrice: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Standard Hours
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={settingsDraft.boostStandardHours ?? 168}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          boostStandardHours: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Premium Boost (₹)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={settingsDraft.boostPremiumPrice ?? 50}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          boostPremiumPrice: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Premium Hours
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={settingsDraft.boostPremiumHours ?? 336}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          boostPremiumHours: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Membership Price (₹)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={settingsDraft.premiumPrice ?? 199}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          premiumPrice: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Membership Days
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={settingsDraft.premiumDurationDays ?? 30}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          premiumDurationDays: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Referral Rate (%)
                    </label>
                    <Input
                      type="number"
                      step="0.5"
                      min={0.5}
                      max={50}
                      value={settingsDraft.referralCommissionPct ?? 3}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          referralCommissionPct: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Min Order (₹)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={settingsDraft.referralMinOrderAmount ?? 200}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          referralMinOrderAmount: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 mb-1">
                      Hold Window (hrs)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={settingsDraft.referralDisputeWindowHours ?? 24}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          referralDisputeWindowHours: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
              </form>

              {/* Reward Withdrawals */}
              <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
                <div className="px-5 py-3.5 border-b border-zinc-100">
                  <h2 className="font-display text-base font-bold text-zinc-900">
                    Referral Reward Withdrawals ({monetization.withdrawals.length})
                  </h2>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Destination</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 tabular-nums">
                    {monetization.withdrawals.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-6 text-center text-zinc-500"
                        >
                          No withdrawal requests submitted yet.
                        </td>
                      </tr>
                    ) : (
                      monetization.withdrawals.map((w) => (
                        <tr key={w.id}>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            {w.student?.fullName || 'Student'}{' '}
                            <span className="font-mono text-zinc-500">
                              ({w.student?.studentId})
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold">
                            {formatINR(w.amount)}
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-600">
                            {w.payoutMethod.toUpperCase()} ·{' '}
                            {w.payoutDestinationMasked}
                          </td>
                          <td className="px-4 py-3 capitalize font-semibold">
                            {w.status}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {w.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleWithdrawalUpdate(w.id, 'approved')
                                  }
                                >
                                  Approve
                                </Button>
                              )}
                              {(w.status === 'pending' ||
                                w.status === 'approved') && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleWithdrawalUpdate(w.id, 'paid')
                                    }
                                  >
                                    Mark Paid
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600"
                                    onClick={() =>
                                      handleWithdrawalUpdate(w.id, 'rejected')
                                    }
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Promotions Management */}
              <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
                <div className="px-5 py-3.5 border-b border-zinc-100">
                  <h2 className="font-display text-base font-bold text-zinc-900">
                    Boosted Listings &amp; Promotions ({monetization.promotions.length})
                  </h2>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Listing</th>
                      <th className="px-4 py-3 font-semibold">Seller</th>
                      <th className="px-4 py-3 font-semibold">Package</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Moderation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 tabular-nums">
                    {monetization.promotions.map((pr) => (
                      <tr key={pr.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900">
                            {pr.listing?.title || 'Listing'}
                          </p>
                          <p className="font-mono text-[11px] text-zinc-500">
                            {pr.listing?.productCode}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          {pr.seller?.fullName || 'Seller'}
                        </td>
                        <td className="px-4 py-3 capitalize font-medium">
                          {pr.packageType} · {formatINR(pr.amount)}
                        </td>
                        <td className="px-4 py-3 capitalize font-semibold">
                          {pr.promotionStatus}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {pr.promotionStatus === 'active' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handlePromotionStatus(pr.id, 'suspended')
                                }
                              >
                                Suspend Boost
                              </Button>
                            ) : (
                              pr.promotionStatus === 'suspended' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handlePromotionStatus(pr.id, 'active')
                                  }
                                >
                                  Reactivate
                                </Button>
                              )
                            )}
                            {pr.seller && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className={
                                  pr.seller.boostSuspended
                                    ? 'text-teal-700'
                                    : 'text-red-600'
                                }
                                onClick={() =>
                                  handleUserSuspensionToggle(pr.seller!.id, {
                                    boostSuspended: !pr.seller!.boostSuspended,
                                  })
                                }
                              >
                                {pr.seller.boostSuspended
                                  ? 'Enable Seller Boosts'
                                  : 'Suspend Seller Boosts'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Referral Commissions & Anti-Abuse */}
              <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
                <div className="px-5 py-3.5 border-b border-zinc-100">
                  <h2 className="font-display text-base font-bold text-zinc-900">
                    Referral Commissions &amp; Anti-Abuse Audit (
                    {monetization.referralTransactions.length})
                  </h2>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Referrer</th>
                      <th className="px-4 py-3 font-semibold">Referred Peer</th>
                      <th className="px-4 py-3 font-semibold">Order / Reward</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 tabular-nums">
                    {monetization.referralTransactions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-6 text-center text-zinc-500"
                        >
                          No referral commission entries yet.
                        </td>
                      </tr>
                    ) : (
                      monetization.referralTransactions.map((rt) => (
                        <tr key={rt.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-zinc-900">
                              {rt.referrer?.fullName || 'Referrer'}
                            </p>
                            <p className="font-mono text-[11px] text-zinc-500">
                              {rt.referralCode}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-zinc-800">
                              {rt.referredUser?.fullName || 'Peer'}
                            </p>
                            {rt.suspiciousPairCount >= 3 && (
                              <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 mt-0.5">
                                <AlertTriangle className="h-3 w-3" />
                                Repeated pair ({rt.suspiciousPairCount}x)
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {formatINR(rt.eligibleAmount)} →{' '}
                            <strong className="text-teal-700">
                              {formatINR(rt.commissionAmount)}
                            </strong>
                          </td>
                          <td className="px-4 py-3 capitalize font-semibold">
                            {rt.rewardStatus}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {rt.rewardStatus === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleReferralStatus(rt.id, 'credited')
                                  }
                                >
                                  Credit Now
                                </Button>
                              )}
                              {rt.rewardStatus !== 'reversed' &&
                                rt.rewardStatus !== 'rejected' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600"
                                    onClick={() =>
                                      handleReferralStatus(rt.id, 'reversed')
                                    }
                                  >
                                    Reverse
                                  </Button>
                                )}
                              {rt.referrer && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleUserSuspensionToggle(rt.referrer!.id, {
                                      referralSuspended:
                                        !rt.referrer!.referralSuspended,
                                    })
                                  }
                                >
                                  {rt.referrer.referralSuspended
                                    ? 'Restore Referrals'
                                    : 'Suspend Referrals'}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
