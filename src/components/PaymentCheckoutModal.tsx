import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Landmark,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  apiFetch,
  type GatewayConfigStatus,
  type PaymentTransactionItem,
} from '../lib/api';
import { formatINR } from '../lib/utils';

export interface CheckoutTarget {
  purpose: 'listing_boost' | 'premium_membership';
  title: string;
  subtitle: string;
  amount: number;
  benefits: string[];
  listingId?: string;
  packageType?: 'basic' | 'standard' | 'premium';
}

interface PaymentCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: CheckoutTarget | null;
  onSuccess: () => void | Promise<void>;
}

const METHODS: Array<{
  id: 'upi' | 'card' | 'netbanking';
  label: string;
  hint: string;
  icon: typeof Smartphone;
}> = [
  { id: 'upi', label: 'UPI (GPay / PhonePe / Paytm)', hint: 'Instant verification', icon: Smartphone },
  { id: 'card', label: 'Debit / Credit Card', hint: 'Visa, Mastercard, RuPay', icon: CreditCard },
  { id: 'netbanking', label: 'NetBanking', hint: 'SBI, HDFC, ICICI & 40+ banks', icon: Landmark },
];

export function PaymentCheckoutModal({
  open,
  onOpenChange,
  target,
  onSuccess,
}: PaymentCheckoutModalProps) {
  const [gatewayStatus, setGatewayStatus] = useState<GatewayConfigStatus | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [processing, setProcessing] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PaymentTransactionItem | null>(null);

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setReceipt(null);
      setIdempotencyKey(`pm_pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
      apiFetch<{ gateway: GatewayConfigStatus }>('/api/payments/config')
        .then((res) => setGatewayStatus(res.gateway))
        .catch(() => {});
    }
  }, [open, target?.listingId, target?.packageType, target?.purpose]);

  if (!target) return null;

  const executeCheckout = async (simulateFailure = false) => {
    setProcessing(true);
    setErrorMsg(null);
    try {
      const checkout = await apiFetch<{
        paymentTransaction: PaymentTransactionItem;
        gatewayOrder: {
          gateway: 'razorpay' | 'sandbox';
          gatewayOrderId: string;
          amountPaise: number;
          keyId: string | null;
        };
      }>('/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          purpose: target.purpose,
          listingId: target.listingId,
          packageType: target.packageType,
          paymentMethod,
          idempotencyKey,
        }),
      });

      // Verify payment atomically on the server
      const verified = await apiFetch<{
        verified: boolean;
        paymentTransaction: PaymentTransactionItem;
      }>('/api/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          paymentTransactionId: checkout.paymentTransaction.id,
          gatewayOrderId: checkout.gatewayOrder.gatewayOrderId,
          simulateFailure,
        }),
      });

      setReceipt(verified.paymentTransaction);
      toast.success('Payment verified and feature activated!');
      await onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment did not complete.';
      setErrorMsg(msg);
      // Fresh idempotency key for clean retry after failed payment
      setIdempotencyKey(`pm_pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {receipt ? 'Payment Confirmed' : 'PingME Secure Checkout'}
          </DialogTitle>
        </DialogHeader>

        {receipt ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-teal-900 text-sm">
                  {target.title} Activated
                </p>
                <p className="text-teal-800">{target.subtitle}</p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs space-y-2 tabular-nums">
              <div className="flex justify-between">
                <span className="text-zinc-500">Amount Paid</span>
                <span className="font-semibold text-zinc-900">
                  {formatINR(receipt.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Method</span>
                <span className="font-mono uppercase text-zinc-900">
                  {receipt.paymentMethod}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Gateway Reference</span>
                <span className="font-mono text-zinc-900">
                  {receipt.gatewayPaymentId || receipt.gatewayOrderId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Mode</span>
                <span className="font-mono uppercase text-zinc-700">
                  {receipt.gateway}
                </span>
              </div>
            </div>

            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-xl border border-zinc-200 bg-[#FAFAFA] p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900">
                  {target.title}
                </p>
                <span className="text-lg font-bold text-zinc-900 tabular-nums">
                  {formatINR(target.amount)}
                </span>
              </div>
              <p className="text-xs text-zinc-600">{target.subtitle}</p>
              <ul className="pt-2 border-t border-zinc-200 space-y-1 text-xs text-zinc-700">
                {target.benefits.map((b) => (
                  <li key={b} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sandbox vs Live notice */}
            {gatewayStatus && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  {gatewayStatus.isLiveConfigured
                    ? gatewayStatus.notice
                    : 'Sandbox Checkout Mode: Razorpay credentials are not configured, so no real money is deducted. Transactions are recorded and verified atomically in Cloud SQL.'}
                </span>
              </div>
            )}

            {/* Method Selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-700">
                Select Payment Method
              </p>
              <div className="space-y-2">
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-teal-700 bg-teal-50/50'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`h-4 w-4 ${active ? 'text-teal-700' : 'text-zinc-500'}`}
                        />
                        <div>
                          <p className="text-xs font-semibold text-zinc-900">
                            {m.label}
                          </p>
                          <p className="text-[11px] text-zinc-500">{m.hint}</p>
                        </div>
                      </div>
                      <span
                        className={`h-3.5 w-3.5 rounded-full border ${
                          active
                            ? 'border-4 border-teal-700 bg-white'
                            : 'border-zinc-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <Button
                type="button"
                className="w-full"
                disabled={processing}
                onClick={() => executeCheckout(false)}
              >
                {processing
                  ? 'Verifying Payment...'
                  : `Pay ${formatINR(target.amount)} via ${paymentMethod.toUpperCase()}`}
              </Button>

              {gatewayStatus && !gatewayStatus.isLiveConfigured && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-zinc-500"
                  disabled={processing}
                  onClick={() => executeCheckout(true)}
                >
                  Simulate Declined Payment (Sandbox Test)
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
