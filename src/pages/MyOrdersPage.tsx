import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Star,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  apiFetch,
  type AccountRestrictionItem,
  type EateryOrder,
} from '../lib/api';
import { formatDate, formatDateTime, formatINR } from '../lib/utils';

const PROGRESS_STEPS = [
  'Pending',
  'Accepted',
  'Preparing',
  'Ready for Pickup',
  'Collected',
] as const;

export function MyOrdersPage() {
  const [orders, setOrders] = useState<EateryOrder[]>([]);
  const [restrictions, setRestrictions] = useState<AccountRestrictionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [cancelTarget, setCancelTarget] = useState<EateryOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const [reviewTarget, setReviewTarget] = useState<EateryOrder | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [appealTarget, setAppealTarget] =
    useState<AccountRestrictionItem | null>(null);
  const [appealNote, setAppealNote] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, restRes] = await Promise.all([
        apiFetch<{ orders: EateryOrder[] }>('/api/orders/mine'),
        apiFetch<{ restrictions: AccountRestrictionItem[] }>(
          '/api/restrictions/mine'
        ),
      ]);
      setOrders(ordRes.orders);
      setRestrictions(restRes.restrictions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setSubmittingCancel(true);
    try {
      await apiFetch(`/api/orders/${cancelTarget.id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ cancellationReason: cancelReason.trim() }),
      });
      toast.success(`Order ${cancelTarget.orderCode} cancelled.`);
      setCancelTarget(null);
      setCancelReason('');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cancellation failed.');
    } finally {
      setSubmittingCancel(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    setSubmittingReview(true);
    try {
      await apiFetch('/api/shop-reviews', {
        method: 'POST',
        body: JSON.stringify({
          orderId: reviewTarget.id,
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      });
      toast.success('Verified eatery review submitted!');
      setReviewTarget(null);
      setReviewRating(5);
      setReviewComment('');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Review failed.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealTarget) return;
    setSubmittingAppeal(true);
    try {
      await apiFetch(`/api/restrictions/${appealTarget.id}/appeal`, {
        method: 'POST',
        body: JSON.stringify({ appealNote: appealNote.trim() }),
      });
      toast.success('Your appeal has been submitted for Campus Admin review.');
      setAppealTarget(null);
      setAppealNote('');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Appeal submission failed.');
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const activeOrders = orders.filter((o) =>
    ['Pending', 'Accepted', 'Preparing', 'Ready for Pickup'].includes(o.status)
  );
  const historyOrders = orders.filter((o) =>
    ['Collected', 'Rejected', 'Cancelled'].includes(o.status)
  );
  const openNotices = restrictions.filter((r) =>
    ['pending_review', 'active'].includes(r.restrictionStatus)
  );

  const renderOrderCard = (order: EateryOrder) => {
    const stepIdx = PROGRESS_STEPS.indexOf(
      order.status as (typeof PROGRESS_STEPS)[number]
    );
    const isTerminalBad = ['Rejected', 'Cancelled'].includes(order.status);

    return (
      <div
        key={order.id}
        className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-zinc-900">
                {order.orderCode}
              </span>
              <span className="text-xs text-zinc-400">·</span>
              <span
                className={`text-xs font-semibold ${
                  order.status === 'Ready for Pickup'
                    ? 'text-teal-700'
                    : order.status === 'Collected'
                      ? 'text-emerald-700'
                      : isTerminalBad
                        ? 'text-red-600'
                        : 'text-amber-700'
                }`}
              >
                {order.status}
              </span>
            </div>
            <h3 className="mt-1 font-display text-base font-bold text-zinc-900">
              {order.shop?.name || 'Campus Eatery'}
            </h3>
            <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
              <MapPin className="h-3.5 w-3.5 text-zinc-400" />
              {order.shop?.location || 'PEC Campus'} ·{' '}
              <span className="tabular-nums">
                Ordered {formatDateTime(order.createdAt)}
              </span>
            </p>
          </div>

          <div className="text-right">
            <p className="font-mono text-lg font-bold text-zinc-900 tabular-nums">
              {formatINR(order.totalAmount)}
            </p>
            <p className="text-[11px] text-zinc-500">Pay at shop counter</p>
          </div>
        </div>

        {/* Live Status Stepper or Rejection/Cancellation Notice */}
        {isTerminalBad ? (
          <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-800 flex items-start gap-2">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Order {order.status}</p>
              {order.cancellationReason && (
                <p className="mt-0.5">Reason: {order.cancellationReason}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-100 bg-[#FAFAFA] p-3.5">
            <div className="grid grid-cols-5 gap-1.5">
              {PROGRESS_STEPS.map((step, idx) => {
                const done = stepIdx >= idx;
                return (
                  <div key={step} className="space-y-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-colors ${
                        done ? 'bg-teal-600' : 'bg-zinc-200'
                      }`}
                    />
                    <p
                      className={`text-[10px] sm:text-[11px] leading-tight ${
                        done
                          ? 'font-semibold text-zinc-900'
                          : 'text-zinc-400'
                      }`}
                    >
                      {step}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Itemized Summary */}
        <div className="border-t border-zinc-100 pt-3 space-y-1.5 text-xs">
          {order.items.map((item) => (
            <div
              key={`${order.id}-${item.menuItemId}`}
              className="flex items-center justify-between text-zinc-700"
            >
              <span>
                {item.quantity} × {item.name}
              </span>
              <span className="font-mono tabular-nums text-zinc-900">
                {formatINR(item.subtotal)}
              </span>
            </div>
          ))}
          {order.notes && (
            <p className="pt-1 text-[11px] text-zinc-500">
              Note: {order.notes}
            </p>
          )}
        </div>

        {order.shop?.paymentProcessNote &&
          ['Pending', 'Accepted', 'Preparing', 'Ready for Pickup'].includes(
            order.status
          ) && (
            <p className="text-[11px] text-zinc-500 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-100">
              {order.shop.paymentProcessNote}
            </p>
          )}

        {/* Order Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
          <div className="flex flex-wrap gap-2">
            {['Pending', 'Accepted', 'Preparing'].includes(order.status) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-red-600 hover:bg-red-50"
                onClick={() => {
                  setCancelTarget(order);
                  setCancelReason('');
                }}
              >
                Cancel Order
              </Button>
            )}
            {order.status === 'Collected' && !order.alreadyReviewed && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setReviewTarget(order);
                  setReviewRating(5);
                  setReviewComment('');
                }}
              >
                <Star className="h-3.5 w-3.5" />
                Rate &amp; Review Shop
              </Button>
            )}
            {order.status === 'Collected' && order.alreadyReviewed && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Verified Review Submitted
              </span>
            )}
          </div>

          {order.shop && (
            <Button asChild size="sm" variant="ghost">
              <Link to={`/app/eateries/${order.shop.slug}`}>View Menu</Link>
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-900">
            My Takeaway Food Orders
          </h1>
          <p className="text-sm text-zinc-600 mt-0.5">
            Track live preparation status across PEC campus eateries and review
            collected orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Status
          </Button>
          <Button asChild size="sm">
            <Link to="/app/eateries">Browse Eateries</Link>
          </Button>
        </div>
      </div>

      {/* Private Account Reliability / Restriction Notice */}
      {openNotices.length > 0 && (
        <div className="space-y-3">
          {openNotices.map((notice) => (
            <div
              key={notice.id}
              className={`rounded-xl border p-4 space-y-2 ${
                notice.restrictionStatus === 'active'
                  ? 'border-red-200 bg-red-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {notice.restrictionStatus === 'active' ? (
                    <ShieldAlert className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-zinc-900 text-sm">
                      {notice.restrictionStatus === 'active'
                        ? 'Takeaway Ordering Temporarily Restricted'
                        : 'Private Order Reliability Notice (Under Admin Review)'}
                    </p>
                    <p className="text-zinc-700">
                      <strong>Shop:</strong> {notice.shopName} ·{' '}
                      <strong>Reason:</strong> {notice.reason}
                    </p>
                    <p className="text-zinc-600 font-mono">
                      Evidence: {notice.evidenceReference}
                      {notice.expiresAt &&
                        ` · Expires: ${formatDate(notice.expiresAt)}`}
                    </p>
                    {notice.appealStatus !== 'none' && (
                      <p className="font-medium text-zinc-800 pt-0.5">
                        Appeal Status:{' '}
                        <span className="capitalize">{notice.appealStatus}</span>
                        {notice.appealNote && ` — "${notice.appealNote}"`}
                      </p>
                    )}
                  </div>
                </div>

                {notice.appealStatus === 'none' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAppealTarget(notice);
                      setAppealNote('');
                    }}
                  >
                    Submit Appeal
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading your takeaway orders...</p>
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">
              Active Orders ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              Order History ({historyOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeOrders.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center space-y-3">
                <Clock className="h-9 w-9 text-zinc-400 mx-auto" />
                <p className="text-sm font-semibold text-zinc-900">
                  No active takeaway orders right now
                </p>
                <p className="text-xs text-zinc-500">
                  Explore Verka Booth, Nescafe Corner, or Student Centre Canteen
                  to order ahead.
                </p>
                <Button asChild size="sm">
                  <Link to="/app/eateries">Browse Campus Eateries</Link>
                </Button>
              </div>
            ) : (
              activeOrders.map(renderOrderCard)
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {historyOrders.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center space-y-2">
                <UtensilsCrossed className="h-9 w-9 text-zinc-400 mx-auto" />
                <p className="text-sm text-zinc-500">No past food orders yet.</p>
              </div>
            ) : (
              historyOrders.map(renderOrderCard)
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Cancel Order Modal */}
      <Dialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order {cancelTarget?.orderCode}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCancelOrder} className="space-y-4">
            <p className="text-xs text-zinc-600 leading-relaxed">
              Please let the shop know why you are cancelling. Note that repeated
              unjustified cancellations are tracked in the campus order reliability
              system.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Cancellation Reason
              </label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Lab ran late / ordered by mistake"
                required
                minLength={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelTarget(null)}
              >
                Keep Order
              </Button>
              <Button
                type="submit"
                disabled={submittingCancel}
                className="bg-red-600 hover:bg-red-700"
              >
                {submittingCancel ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog
        open={Boolean(reviewTarget)}
        onOpenChange={(open) => {
          if (!open) setReviewTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Review {reviewTarget?.shop?.name || 'Eatery'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-2">
                Rating (Order {reviewTarget?.orderCode})
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Rate ${n} stars`}
                    onClick={() => setReviewRating(n)}
                    className="p-1 cursor-pointer"
                  >
                    <Star
                      className={`h-7 w-7 ${
                        n <= reviewRating
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-zinc-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Comment (optional)
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Share food quality, packaging, or pickup speed..."
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReviewTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submittingReview}>
                {submittingReview ? 'Submitting...' : 'Submit Verified Review'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Appeal Modal */}
      <Dialog
        open={Boolean(appealTarget)}
        onOpenChange={(open) => {
          if (!open) setAppealTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Reliability Appeal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitAppeal} className="space-y-4">
            <p className="text-xs text-zinc-600 leading-relaxed">
              Your explanation will be reviewed privately by a PEC Campus
              Administrator alongside the flagged order history.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Appeal Explanation
              </label>
              <textarea
                value={appealNote}
                onChange={(e) => setAppealNote(e.target.value)}
                rows={4}
                required
                minLength={10}
                placeholder="Explain what happened with the referenced order(s)..."
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAppealTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submittingAppeal}>
                {submittingAppeal ? 'Submitting...' : 'Send Appeal to Admin'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
