import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  QrCode,
  ScanLine,
  Star,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { QrCodeCard } from '../components/qr/QrCodeCard';
import { QrScannerPanel } from '../components/qr/QrScannerPanel';
import { useAuth } from '../context/AuthContext';
import { apiFetch, type TransactionItem } from '../lib/api';
import { formatDate, formatDateTime, formatINR } from '../lib/utils';

export function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [displayQr, setDisplayQr] = useState<{
    rawCode: string;
    tokenType: string;
    txnCode: string;
    expiresAt: string;
  } | null>(null);

  const [verifyScannerOpen, setVerifyScannerOpen] = useState(false);
  const [reviewTxn, setReviewTxn] = useState<TransactionItem | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ transactions: TransactionItem[] }>(
        '/api/transactions'
      );
      setTransactions(res.transactions);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load transactions.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const updateStatus = async (txnId: string, status: string) => {
    try {
      await apiFetch(`/api/transactions/${txnId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success(`Transaction marked ${status}.`);
      await loadTransactions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const issueHandoverQr = async (txn: TransactionItem) => {
    try {
      const res = await apiFetch<{
        qrToken: { rawCode: string; tokenType: string; expiresAt: string };
      }>(`/api/qr/transaction/${txn.id}/issue`, {
        method: 'POST',
      });
      setDisplayQr({
        rawCode: res.qrToken.rawCode,
        tokenType: res.qrToken.tokenType,
        txnCode: txn.transactionCode,
        expiresAt: res.qrToken.expiresAt,
      });
      toast.success('One-time handover QR generated.');
      await loadTransactions();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Unable to generate handover QR.'
      );
    }
  };

  const handleVerifyScan = async (rawCode: string) => {
    try {
      const res = await apiFetch<{
        verified: boolean;
        transaction: { transactionCode: string; transactionStatus: string };
      }>('/api/qr/transaction/verify', {
        method: 'POST',
        body: JSON.stringify({ rawCode }),
      });
      toast.success(
        `QR Verified! ${res.transaction.transactionCode} is now ${res.transaction.transactionStatus}.`
      );
      setVerifyScannerOpen(false);
      await loadTransactions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'QR verification failed.');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTxn) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          transactionId: reviewTxn.id,
          rating,
          comment,
        }),
      });
      toast.success('Thank you! Your student review was submitted.');
      setReviewTxn(null);
      setComment('');
      setRating(5);
      await loadTransactions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const incoming = transactions.filter((t) => t.sellerId === user?.id);
  const outgoing = transactions.filter((t) => t.buyerId === user?.id);

  const renderTransactionCard = (txn: TransactionItem) => {
    const isSeller = txn.sellerId === user?.id;
    const isRent = txn.transactionType === 'rent';
    const counterparty = isSeller ? txn.buyer : txn.seller;

    const showReturnReminder =
      isRent &&
      txn.transactionStatus === 'Collected' &&
      txn.bookingEnd &&
      new Date(txn.bookingEnd).getTime() - Date.now() < 1000 * 60 * 60 * 36;

    return (
      <div
        key={txn.id}
        className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="font-mono font-semibold text-zinc-900">
                {txn.transactionCode}
              </span>
              <span>·</span>
              <span className="capitalize">{txn.transactionType}</span>
              <span>·</span>
              <span>{isSeller ? 'Incoming (You own)' : 'Outgoing (Your request)'}</span>
            </div>

            {txn.product ? (
              <Link
                to={`/app/product/${txn.product.productCode}`}
                className="block text-base font-semibold text-zinc-900 hover:text-teal-700"
              >
                {txn.product.title}
              </Link>
            ) : (
              <p className="text-base font-semibold text-zinc-900">Item</p>
            )}

            <p className="text-xs text-zinc-600">
              With:{' '}
              <span className="font-medium text-zinc-900">
                {counterparty?.fullName || 'PEC Student'}
              </span>{' '}
              ({counterparty?.maskedStudentId})
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-zinc-900 tabular-nums">
              {formatINR(txn.totalAmount)}
            </p>
            {txn.depositAmount > 0 && (
              <p className="text-xs text-zinc-500 tabular-nums">
                + {formatINR(txn.depositAmount)} deposit
              </p>
            )}
            <p
              className={`mt-1 text-xs font-semibold ${
                ['Completed', 'Returned'].includes(txn.transactionStatus)
                  ? 'text-teal-700'
                  : ['Rejected', 'Cancelled'].includes(txn.transactionStatus)
                    ? 'text-red-600'
                    : 'text-amber-700'
              }`}
            >
              {txn.transactionStatus}
            </p>
          </div>
        </div>

        {isRent && txn.bookingStart && txn.bookingEnd && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-600">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-teal-700" />
              {formatDate(txn.bookingStart)} to {formatDate(txn.bookingEnd)}
            </span>
            {txn.collectedAt && (
              <span>Collected: {formatDateTime(txn.collectedAt)}</span>
            )}
            {txn.returnedAt && (
              <span>Returned: {formatDateTime(txn.returnedAt)}</span>
            )}
          </div>
        )}

        {showReturnReminder && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
            Return reminder: Rental period ends on {formatDate(txn.bookingEnd)}.
            Coordinate campus meetup and verify return with PingME QR.
          </div>
        )}

        {txn.notes && (
          <p className="text-xs text-zinc-500">Note: {txn.notes}</p>
        )}

        {/* Role & Status Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100">
          {isSeller && txn.transactionStatus === 'Pending' && (
            <>
              <Button
                size="sm"
                onClick={() =>
                  updateStatus(txn.id, isRent ? 'Booked' : 'Accepted')
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isRent ? 'Accept & Book' : 'Accept Request'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatus(txn.id, 'Rejected')}
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </Button>
            </>
          )}

          {!isSeller &&
            ['Pending', 'Accepted', 'Booked'].includes(
              txn.transactionStatus
            ) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateStatus(txn.id, 'Cancelled')}
              >
                Cancel Request
              </Button>
            )}

          {isSeller &&
            ['Accepted', 'Booked'].includes(txn.transactionStatus) && (
              <Button size="sm" onClick={() => issueHandoverQr(txn)}>
                <QrCode className="h-3.5 w-3.5" />
                Show Collection QR
              </Button>
            )}

          {!isSeller &&
            ['Accepted', 'Booked'].includes(txn.transactionStatus) && (
              <Button
                size="sm"
                onClick={() => setVerifyScannerOpen(true)}
              >
                <ScanLine className="h-3.5 w-3.5" />
                Scan Collection QR
              </Button>
            )}

          {isRent &&
            ['Collected', 'Return Pending'].includes(txn.transactionStatus) && (
              <>
                {!isSeller && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => issueHandoverQr(txn)}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    Generate Return QR
                  </Button>
                )}
                {isSeller && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => issueHandoverQr(txn)}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      Show Return QR
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setVerifyScannerOpen(true)}
                    >
                      <ScanLine className="h-3.5 w-3.5" />
                      Scan Return QR
                    </Button>
                  </>
                )}
                {!isSeller && (
                  <Button
                    size="sm"
                    onClick={() => setVerifyScannerOpen(true)}
                  >
                    <ScanLine className="h-3.5 w-3.5" />
                    Scan Owner Return QR
                  </Button>
                )}
              </>
            )}

          {['Completed', 'Returned'].includes(txn.transactionStatus) &&
            !txn.alreadyReviewed && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviewTxn(txn)}
              >
                <Star className="h-3.5 w-3.5 text-amber-500" />
                Leave Review
              </Button>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-900">
            My Transactions & Handovers
          </h1>
          <p className="text-sm text-zinc-600 mt-0.5">
            Approve student requests, generate handover QR tokens, and track
            rental returns.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setVerifyScannerOpen(true)}
        >
          <ScanLine className="h-4 w-4 text-teal-700" />
          Scan Handover QR
        </Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All ({transactions.length})
          </TabsTrigger>
          <TabsTrigger value="incoming">
            Incoming ({incoming.length})
          </TabsTrigger>
          <TabsTrigger value="outgoing">
            Outgoing ({outgoing.length})
          </TabsTrigger>
        </TabsList>

        {(['all', 'incoming', 'outgoing'] as const).map((tab) => {
          const list =
            tab === 'all'
              ? transactions
              : tab === 'incoming'
                ? incoming
                : outgoing;

          return (
            <TabsContent key={tab} value={tab} className="space-y-4">
              {loading ? (
                <p className="text-sm text-zinc-500">Loading transactions...</p>
              ) : list.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
                  <ArrowLeftRight className="h-9 w-9 text-zinc-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-zinc-900">
                    No transactions in this view
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link to="/app/explore">Explore Campus Listings</Link>
                  </Button>
                </div>
              ) : (
                list.map(renderTransactionCard)
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Handover QR Display Modal */}
      {displayQr && (
        <Dialog
          open={Boolean(displayQr)}
          onOpenChange={(open) => !open && setDisplayQr(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>One-Time Handover QR</DialogTitle>
            </DialogHeader>
            <QrCodeCard
              value={displayQr.rawCode}
              title={
                displayQr.tokenType === 'handover_collect'
                  ? 'Item Collection Verification'
                  : 'Item Return Verification'
              }
              subtitle={`Ask the other student to scan before ${formatDateTime(displayQr.expiresAt)}`}
              codeLabel={displayQr.txnCode}
              size={220}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Verify Handover QR Modal */}
      <Dialog open={verifyScannerOpen} onOpenChange={setVerifyScannerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Verify Transaction Handover QR</DialogTitle>
          </DialogHeader>
          <QrScannerPanel
            onScanResult={handleVerifyScan}
            placeholder="Paste or scan PINGME:HANDOVER:... token"
            submitLabel="Verify Handover"
            helperText="Scan the counterparty's one-time handover QR code to confirm item collection or return."
          />
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog
        open={Boolean(reviewTxn)}
        onOpenChange={(open) => !open && setReviewTxn(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Rate Transaction {reviewTxn?.transactionCode}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div>
              <p className="text-xs font-medium text-zinc-700 mb-2">Rating</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold cursor-pointer ${
                      rating >= star
                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-zinc-200 text-zinc-400'
                    }`}
                  >
                    {star} ★
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Review Comment
              </label>
              <textarea
                rows={3}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share how the campus handover and item condition went..."
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReviewTxn(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
