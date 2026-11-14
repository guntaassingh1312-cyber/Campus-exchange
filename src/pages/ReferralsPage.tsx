import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Gift,
  IndianRupee,
  Share2,
  ShieldAlert,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { apiFetch, type ReferralDashboardResponse } from '../lib/api';
import { formatDate, formatINR } from '../lib/utils';

export function ReferralsPage() {
  const [data, setData] = useState<ReferralDashboardResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Withdraw dialog
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<ReferralDashboardResponse>(
        `/api/referrals/dashboard?page=${page}&limit=10`
      );
      setData(res);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Unable to load referral dashboard.'
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const referralLink = data
    ? `${window.location.origin}/register?ref=${encodeURIComponent(data.referralCode)}`
    : '';

  const copyText = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 1800);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1800);
      }
      toast.success(
        type === 'code' ? 'Referral code copied!' : 'Shareable referral link copied!'
      );
    } catch {
      toast.info(text);
    }
  };

  const handleShareInvite = async () => {
    if (!data) return;
    const shareText = `Join PingME – PEC Campus Marketplace to buy, sell & rent gear on campus! Register with my referral code ${data.referralCode}: ${referralLink}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join PingME PEC Marketplace',
          text: shareText,
          url: referralLink,
        });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    await copyText(shareText, 'link');
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawing(true);
    try {
      await apiFetch('/api/referrals/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(withdrawAmount),
          upiId: upiId.trim(),
        }),
      });
      toast.success('Withdrawal request submitted for admin payout.');
      setWithdrawOpen(false);
      setWithdrawAmount('');
      setUpiId('');
      await loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Withdrawal failed.');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading && !data) {
    return (
      <p className="text-sm text-zinc-500">
        Loading Student Referral &amp; Rewards Programme...
      </p>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-700">
            Student Referral &amp; Rewards Programme · PEC Chandigarh
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-bold text-zinc-900">
            Referrals &amp; Campus Rewards
          </h1>
          <p className="text-sm text-zinc-600 mt-0.5">
            Earn {data.rules.commissionRatePct}% commission when referred PEC peers
            complete verified marketplace exchanges of ₹{data.rules.minOrderAmount}+.
          </p>
        </div>

        <Button
          onClick={() => {
            setWithdrawAmount(String(data.summary.withdrawableBalance || ''));
            setWithdrawOpen(true);
          }}
          disabled={data.summary.withdrawableBalance < 10 || data.referralSuspended}
        >
          <Wallet className="h-4 w-4" />
          Withdraw ({formatINR(data.summary.withdrawableBalance)})
        </Button>
      </div>

      {data.referralSuspended && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Referral payouts are currently paused on your account by campus
            administration. Contact PingME support for review.
          </span>
        </div>
      )}

      {/* Referral Code & Shareable Link Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-5 space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Your Unique PEC Referral Code
          </p>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-zinc-200 bg-[#FAFAFA] px-4 py-2.5 font-mono text-base font-bold text-zinc-900 tracking-wide">
              {data.referralCode}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => copyText(data.referralCode, 'code')}
            >
              {copiedCode ? (
                <Check className="h-4 w-4 text-teal-700" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copy
            </Button>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Shareable Invitation Link
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={referralLink}
              readOnly
              className="font-mono text-xs bg-[#FAFAFA]"
            />
            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => copyText(referralLink, 'link')}
              >
                {copiedLink ? (
                  <Check className="h-4 w-4 text-teal-700" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copy Link
              </Button>
              <Button type="button" onClick={handleShareInvite}>
                <Share2 className="h-4 w-4" />
                Share Invite
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: 'Total Referrals',
            value: data.summary.totalReferrals,
            sub: `${data.summary.verifiedReferrals} verified PEC`,
            icon: Users,
          },
          {
            label: 'Successful Orders',
            value: data.summary.successfulTransactions,
            sub: `Min ₹${data.rules.minOrderAmount} order`,
            icon: Gift,
          },
          {
            label: 'Total Earned',
            value: formatINR(data.summary.totalCommissionEarned),
            sub: `${data.rules.commissionRatePct}% commission`,
            icon: IndianRupee,
          },
          {
            label: 'Pending Window',
            value: formatINR(data.summary.pendingRewards),
            sub: `${data.rules.disputeWindowHours}h verification`,
            icon: IndianRupee,
          },
          {
            label: 'Withdrawable',
            value: formatINR(data.summary.withdrawableBalance),
            sub: 'Ready for UPI payout',
            icon: Wallet,
          },
          {
            label: 'Withdrawn / Pending Payout',
            value: formatINR(data.summary.withdrawnAmount),
            sub: 'Total claimed',
            icon: Wallet,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-200 bg-white p-4"
          >
            <p className="text-xs text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-xl font-bold text-zinc-900 tabular-nums">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400 tabular-nums">
              {stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Referred Peers History (Masked IDs only, privacy-safe) */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-zinc-900">
              Referred Students ({data.pagination.totalReferrals})
            </h2>
            <p className="text-xs text-zinc-500">
              Student IDs are masked for peer privacy. Self-referrals and incomplete
              orders are excluded.
            </p>
          </div>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Student ID</th>
              <th className="px-4 py-3 font-semibold">Department</th>
              <th className="px-4 py-3 font-semibold">Registered</th>
              <th className="px-4 py-3 font-semibold text-right">
                Eligible Txns
              </th>
              <th className="px-4 py-3 font-semibold text-right">
                Commission Earned
              </th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {data.referralHistory.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No referrals yet. Share your code {data.referralCode} with PEC peers!
                </td>
              </tr>
            ) : (
              data.referralHistory.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-zinc-900">
                    {row.maskedStudentId}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{row.department}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(row.registrationDate)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {row.transactionsCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-teal-700">
                    {formatINR(row.rewardEarned)}
                  </td>
                  <td className="px-4 py-3 capitalize font-semibold text-zinc-700">
                    {row.status}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Commission Ledger & Payouts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-xl border border-zinc-200 bg-white overflow-x-auto">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="font-display text-base font-bold text-zinc-900">
              Commission Ledger
            </h2>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Transaction</th>
                <th className="px-4 py-3 font-semibold">Peer</th>
                <th className="px-4 py-3 font-semibold text-right">Order</th>
                <th className="px-4 py-3 font-semibold text-right">Reward</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 tabular-nums">
              {data.commissionLedger.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    Commissions appear once a referred peer completes an eligible exchange.
                  </td>
                </tr>
              ) : (
                data.commissionLedger.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono text-zinc-900">
                      {c.transactionCode}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-600">
                      {c.maskedStudentId}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatINR(c.eligibleAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-teal-700">
                      {formatINR(c.commissionAmount)}
                    </td>
                    <td className="px-4 py-3 capitalize font-semibold">
                      <span
                        className={
                          c.rewardStatus === 'credited'
                            ? 'text-teal-700'
                            : c.rewardStatus === 'pending'
                              ? 'text-amber-700'
                              : 'text-red-600'
                        }
                      >
                        {c.rewardStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {data.pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between text-xs">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-zinc-500 tabular-nums">
                Page {page} of {data.pagination.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-zinc-900">
            Reward Withdrawals
          </h2>
          {data.withdrawals.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4">
              No withdrawal requests yet. Minimum withdrawal is ₹10.
            </p>
          ) : (
            <div className="divide-y divide-zinc-100 text-xs tabular-nums">
              {data.withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-zinc-900">
                      {formatINR(w.amount)} via {w.payoutMethod}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      {w.payoutDestinationMasked} · {formatDate(w.createdAt)}
                    </p>
                    {w.adminNote && (
                      <p className="text-[11px] text-zinc-600 mt-0.5">
                        Note: {w.adminNote}
                      </p>
                    )}
                  </div>
                  <span
                    className={`font-semibold capitalize ${
                      w.status === 'paid' || w.status === 'approved'
                        ? 'text-teal-700'
                        : w.status === 'rejected'
                          ? 'text-red-600'
                          : 'text-amber-700'
                    }`}
                  >
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Withdrawal Modal */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw Referral Rewards</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWithdrawSubmit} className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs flex justify-between">
              <span className="text-zinc-600">Withdrawable Balance</span>
              <span className="font-mono font-bold text-teal-700 tabular-nums">
                {formatINR(data.summary.withdrawableBalance)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Amount to Withdraw (₹ INR, min ₹10)
              </label>
              <Input
                type="number"
                min={10}
                max={data.summary.withdrawableBalance}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                UPI ID (stored masked after request)
              </label>
              <Input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. aarav@okaxis"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWithdrawOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={withdrawing}>
                {withdrawing ? 'Submitting...' : 'Request Payout'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
