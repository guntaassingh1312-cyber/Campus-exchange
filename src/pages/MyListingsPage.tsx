import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  Package,
  PlusCircle,
  QrCode,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  PaymentCheckoutModal,
  type CheckoutTarget,
} from '../components/PaymentCheckoutModal';
import { useAuth } from '../context/AuthContext';
import {
  apiFetch,
  type ListingPromotionRow,
  type PlatformSettings,
  type Product,
} from '../lib/api';
import { resolveImageUrl } from '../lib/demoImages';
import { formatDateTime, formatINR } from '../lib/utils';

type BoostTier = 'basic' | 'standard' | 'premium';

function formatRemainingDuration(expiryTime: string | null): string {
  if (!expiryTime) return 'Active';
  const diffMs = new Date(expiryTime).getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  return `${mins}m left`;
}

function formatDurationLabel(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24;
    return `${hours} hours (${days} ${days === 1 ? 'day' : 'days'})`;
  }
  return `${hours} hours`;
}

export function MyListingsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<ListingPromotionRow[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [boostTargetProduct, setBoostTargetProduct] = useState<Product | null>(
    null
  );
  const [selectedTier, setSelectedTier] = useState<BoostTier>('standard');
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget | null>(
    null
  );
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const loadListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [prodRes, promoRes, cfgRes] = await Promise.all([
        apiFetch<{ products: Product[] }>(
          `/api/products?sellerId=${encodeURIComponent(user.id)}`
        ),
        apiFetch<{ promotions: ListingPromotionRow[] }>('/api/promotions/mine'),
        apiFetch<{ settings: PlatformSettings }>('/api/payments/config'),
      ]);
      setItems(prodRes.products);
      setPromotions(promoRes.promotions || []);
      setSettings(cfgRes.settings);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Unable to load your listings.'
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  const toggleActive = async (item: Product) => {
    const nextStatus =
      item.availabilityStatus === 'Inactive' ? 'Available' : 'Inactive';
    try {
      await apiFetch(`/api/products/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ availabilityStatus: nextStatus }),
      });
      toast.success(
        nextStatus === 'Available'
          ? 'Listing reactivated!'
          : 'Listing deactivated.'
      );
      await loadListings();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      await apiFetch(`/api/products/${itemId}`, { method: 'DELETE' });
      toast.success('Listing deleted permanently.');
      setItems((prev) => prev.filter((p) => p.id !== itemId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const boostPackages = [
    {
      id: 'basic' as BoostTier,
      name: 'Basic Boost',
      price: settings?.boostBasicPrice ?? 20,
      hours: settings?.boostBasicHours ?? 72,
      benefits: [
        'Priority placement above organic campus listings',
        'Sponsored · Boosted indicator on Marketplace cards',
        'Ideal for quick weekend hostel sales',
      ],
    },
    {
      id: 'standard' as BoostTier,
      name: 'Standard Boost',
      price: settings?.boostStandardPrice ?? 35,
      hours: settings?.boostStandardHours ?? 168,
      benefits: [
        '7-day priority visibility in Explore & Search feeds',
        'Sponsored · Boosted badge across Buy & Rent tabs',
        'Best value for textbooks, calculators & electronics',
      ],
    },
    {
      id: 'premium' as BoostTier,
      name: 'Premium Boost',
      price: settings?.boostPremiumPrice ?? 50,
      hours: settings?.boostPremiumHours ?? 336,
      benefits: [
        '14-day maximum visibility across Marketplace & Popular feeds',
        'Sponsored · Boosted badge on cards & product details',
        'Best suited for cycles, monitors & high-value rentals',
      ],
    },
  ];

  const chosenPkg =
    boostPackages.find((p) => p.id === selectedTier) || boostPackages[1];

  const openPaymentForBoost = () => {
    if (!boostTargetProduct) return;
    setCheckoutTarget({
      purpose: 'listing_boost',
      title: `${chosenPkg.name} · ${boostTargetProduct.title}`,
      subtitle: `${formatDurationLabel(chosenPkg.hours)} of prioritized PEC marketplace visibility`,
      amount: chosenPkg.price,
      benefits: chosenPkg.benefits,
      listingId: boostTargetProduct.id,
      packageType: chosenPkg.id,
    });
    setBoostTargetProduct(null);
    setCheckoutOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-900">
            My Listings &amp; Visibility Boosts
          </h1>
          <p className="text-sm text-zinc-600 mt-0.5">
            Manage your PEC items or boost active listings for priority campus
            visibility.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/sell">
            <PlusCircle className="h-4 w-4" />
            New Listing
          </Link>
        </Button>
      </div>

      {user?.boostSuspended && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Listing boosts are currently suspended on your account by a PEC
          moderator. Organic listings remain active.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading your listings...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <Package className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
          <p className="text-base font-semibold text-zinc-900">
            You haven’t posted any items yet
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            Turn unused textbooks, electronics, or cycles into campus income.
          </p>
          <Button asChild className="mt-4">
            <Link to="/app/sell">List Your First Item</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const activePromo =
              item.activePromotion ||
              promotions.find(
                (p) =>
                  p.listingId === item.id &&
                  p.promotionStatus === 'active' &&
                  (!p.expiryTime || new Date(p.expiryTime) > new Date())
              ) ||
              null;

            return (
              <div
                key={item.id}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <img
                    src={resolveImageUrl(item.images[0]) || item.images[0]}
                    alt={item.title}
                    className="h-16 w-20 rounded-lg object-cover border border-zinc-100 shrink-0 bg-zinc-100"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="font-mono">{item.productCode}</span>
                      <span>·</span>
                      <span
                        className={
                          item.availabilityStatus === 'Available'
                            ? 'text-teal-700 font-medium'
                            : 'text-amber-700 font-medium'
                        }
                      >
                        {item.availabilityStatus}
                      </span>
                      {activePromo && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-zinc-900">
                            <Sparkles className="h-3 w-3 text-teal-700" />
                            Boosted ({activePromo.packageType.toUpperCase()} ·{' '}
                            {formatRemainingDuration(activePromo.expiryTime)})
                          </span>
                        </>
                      )}
                    </div>
                    <Link
                      to={`/app/product/${item.productCode}`}
                      className="block text-sm font-semibold text-zinc-900 truncate hover:text-teal-700 mt-0.5"
                    >
                      {item.title}
                    </Link>
                    <p className="text-xs text-zinc-600 mt-0.5 tabular-nums">
                      {item.sellingPrice
                        ? `Sale ${formatINR(item.sellingPrice)}`
                        : ''}
                      {item.sellingPrice && item.rentalPriceDaily ? ' · ' : ''}
                      {item.rentalPriceDaily
                        ? `Rent ${formatINR(item.rentalPriceDaily)}/day`
                        : item.rentalPriceMonthly
                          ? `Rent ${formatINR(item.rentalPriceMonthly)}/mo`
                          : ''}
                      {activePromo?.expiryTime && (
                        <span className="text-zinc-400">
                          {' '}
                          · Expires {formatDateTime(activePromo.expiryTime)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {item.availabilityStatus === 'Available' &&
                    !activePromo &&
                    !user?.boostSuspended && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedTier('standard');
                          setBoostTargetProduct(item);
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Boost Listing
                      </Button>
                    )}
                  {activePromo && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 tabular-nums">
                      <Clock className="h-3.5 w-3.5" />
                      {formatRemainingDuration(activePromo.expiryTime)}
                    </span>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/product/${item.productCode}`}>
                      <QrCode className="h-3.5 w-3.5" />
                      QR
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/edit-listing/${item.id}`}>
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive(item)}
                  >
                    {item.availabilityStatus === 'Inactive' ? (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        Reactivate
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        Deactivate
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Promotion History */}
      {promotions.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
          <div className="px-4 py-3 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-900">
              Recent Promotion History
            </h2>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Package</th>
                <th className="px-4 py-2.5 font-semibold">Amount</th>
                <th className="px-4 py-2.5 font-semibold">Payment</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 tabular-nums">
              {promotions.slice(0, 8).map((pr) => {
                const matchingItem = items.find((i) => i.id === pr.listingId);
                return (
                  <tr key={pr.id}>
                    <td className="px-4 py-2.5 font-medium text-zinc-900 capitalize">
                      {pr.packageType} Boost
                      {matchingItem ? ` · ${matchingItem.title}` : ''}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {formatINR(pr.amount)}
                    </td>
                    <td className="px-4 py-2.5 capitalize">{pr.paymentStatus}</td>
                    <td className="px-4 py-2.5 capitalize font-semibold text-teal-700">
                      {pr.promotionStatus}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">
                      {pr.expiryTime ? formatDateTime(pr.expiryTime) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Boost Package Selector Modal */}
      <Dialog
        open={Boolean(boostTargetProduct)}
        onOpenChange={(open) => {
          if (!open) setBoostTargetProduct(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Boost Listing Visibility</DialogTitle>
          </DialogHeader>

          {boostTargetProduct && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs">
                <p className="font-semibold text-zinc-900">
                  {boostTargetProduct.title}
                </p>
                <p className="font-mono text-zinc-500 mt-0.5">
                  {boostTargetProduct.productCode} · {boostTargetProduct.category}
                </p>
              </div>

              <div className="space-y-2.5">
                {boostPackages.map((pkg) => {
                  const selected = selectedTier === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedTier(pkg.id)}
                      className={`w-full rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-teal-700 bg-teal-50/50'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-900">
                            {pkg.name}
                          </span>
                          <span className="text-xs text-zinc-500">
                            · {formatDurationLabel(pkg.hours)}
                          </span>
                        </div>
                        <span className="text-base font-bold text-zinc-900 tabular-nums">
                          {formatINR(pkg.price)}
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                        {pkg.benefits.map((b) => (
                          <li key={b} className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-teal-700 shrink-0" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBoostTargetProduct(null)}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={openPaymentForBoost}>
                  Continue to Pay {formatINR(chosenPkg.price)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PaymentCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        target={checkoutTarget}
        onSuccess={loadListings}
      />
    </div>
  );
}

