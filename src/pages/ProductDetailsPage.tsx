import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Crown,
  Edit3,
  Flag,
  Heart,
  MapPin,
  MessageSquare,
  Package,
  QrCode,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
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
import { QrCodeCard } from '../components/qr/QrCodeCard';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../context/AuthContext';
import { apiFetch, type Product } from '../lib/api';
import { resolveImageUrl } from '../lib/demoImages';
import { formatDate, formatINR } from '../lib/utils';

interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: { fullName: string; department: string } | null;
}

export function ProductDetailsPage({ isPublic = false }: { isPublic?: boolean }) {
  const { idOrCode } = useParams<{ idOrCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);

  // Modals
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [rentModalOpen, setRentModalOpen] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Form states
  const [rentStart, setRentStart] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [rentEnd, setRentEnd] = useState(() => {
    const d = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3);
    return d.toISOString().split('T')[0];
  });
  const [rentNotes, setRentNotes] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNotes, setOfferNotes] = useState('');
  const [messageText, setMessageText] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadProduct = useCallback(async () => {
    if (!idOrCode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ product: Product; reviews: ReviewItem[] }>(
        `/api/products/${encodeURIComponent(idOrCode)}`
      );
      setProduct(res.product);
      setReviews(res.reviews || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Product not found.');
    } finally {
      setLoading(false);
    }
  }, [idOrCode]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    if (!user || !product) return;
    apiFetch<{ items: Product[] }>('/api/wishlist')
      .then((res) => {
        setWishlisted(res.items.some((item) => item.id === product.id));
      })
      .catch(() => {});
  }, [user, product]);

  const rentalEstimate = useMemo(() => {
    if (!product || !rentStart || !rentEnd) return null;
    const start = new Date(rentStart);
    const end = new Date(rentEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return null;
    }
    const days = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    );
    const daily =
      product.rentalPriceDaily ??
      (product.rentalPriceWeekly ? Math.round(product.rentalPriceWeekly / 7) : null) ??
      (product.rentalPriceMonthly ? Math.round(product.rentalPriceMonthly / 30) : 25);

    let rentalTotal = days * daily;
    if (days >= 28 && product.rentalPriceMonthly) {
      const months = Math.floor(days / 30);
      rentalTotal = months * product.rentalPriceMonthly + (days % 30) * daily;
    } else if (days >= 7 && product.rentalPriceWeekly) {
      const weeks = Math.floor(days / 7);
      rentalTotal = weeks * product.rentalPriceWeekly + (days % 7) * daily;
    }
    return {
      days,
      rentalTotal,
      deposit: product.securityDeposit,
    };
  }, [product, rentStart, rentEnd]);

  const requireSignedIn = (): boolean => {
    if (!user) {
      toast.error('Please sign in with your PEC Student ID to continue.');
      navigate('/login');
      return false;
    }
    return true;
  };

  const handleBuyNow = async () => {
    if (!product || !requireSignedIn()) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          transactionType: 'buy',
          notes: `Purchase request for ${product.productCode}`,
        }),
      });
      toast.success(
        'Purchase request sent to seller! Track handover QR in My Transactions.'
      );
      navigate('/app/transactions');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Purchase request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !requireSignedIn()) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          transactionType: 'rent',
          bookingStart: rentStart,
          bookingEnd: rentEnd,
          notes: rentNotes,
        }),
      });
      toast.success('Rental booking request sent to owner!');
      setRentModalOpen(false);
      navigate('/app/transactions');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rental request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !requireSignedIn()) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          transactionType: 'offer',
          offerAmount: Number(offerAmount),
          notes: offerNotes,
        }),
      });
      toast.success('Price offer sent to seller!');
      setOfferModalOpen(false);
      navigate('/app/transactions');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to send offer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !requireSignedIn() || !messageText.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: product.sellerId,
          productId: product.id,
          messageText: messageText.trim(),
        }),
      });
      toast.success('Message sent to seller!');
      setMessageText('');
      setContactModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!product || !requireSignedIn()) return;
    try {
      await apiFetch(`/api/wishlist/${product.id}`, {
        method: wishlisted ? 'DELETE' : 'POST',
      });
      setWishlisted((prev) => !prev);
      toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wishlist error.');
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/p/${product?.productCode}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Listing link copied to clipboard.');
    } catch {
      toast.info(`Share link: ${shareUrl}`);
    }
  };

  const handleDeleteListing = async () => {
    if (!product) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/products/${product.id}`, { method: 'DELETE' });
      toast.success('Listing deleted.');
      navigate('/app/my-listings');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !requireSignedIn()) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          reportedUserId: product.sellerId,
          reason: reportReason,
        }),
      });
      toast.success('Report submitted to PEC moderators.');
      setReportModalOpen(false);
      setReportReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const isOwner = Boolean(user && product && user.id === product.sellerId);

  const pageBody = loading ? (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <Skeleton className="lg:col-span-7 aspect-[4/3] rounded-2xl" />
      <Skeleton className="lg:col-span-5 h-96 rounded-2xl" />
    </div>
  ) : error || !product ? (
    <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center">
      <Package className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
      <h2 className="text-lg font-semibold text-zinc-900">
        {error || 'Product not found'}
      </h2>
      <p className="text-sm text-zinc-500 mt-1">
        Check the PingME product code or browse active campus listings.
      </p>
      <Button asChild className="mt-4" variant="outline">
        <Link to={isPublic ? '/explore' : '/app/explore'}>
          Return to Marketplace
        </Link>
      </Button>
    </div>
  ) : (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          to={isPublic ? '/explore' : '/app/explore'}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Marketplace
        </Link>
        <span className="font-mono text-xs text-zinc-500">
          {product.productCode}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Gallery + Description + Reviews */}
        <div className="lg:col-span-7 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="aspect-[4/3] w-full bg-zinc-100">
              {product.images[activeImgIdx] ? (
                <img
                  src={
                    resolveImageUrl(product.images[activeImgIdx]) ||
                    product.images[activeImgIdx]
                  }
                  alt={product.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-12 w-12 text-zinc-300" />
                </div>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="flex gap-2 p-3 border-t border-zinc-100 overflow-x-auto">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImgIdx(i)}
                    className={`h-16 w-20 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                      activeImgIdx === i
                        ? 'border-teal-600'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={resolveImageUrl(img) || img}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-zinc-900">
              Item Description & Campus Pickup
            </h2>
            <p className="text-sm leading-relaxed text-zinc-700 whitespace-pre-line">
              {product.description}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100 text-sm">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-teal-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-500">Pickup Location</p>
                  <p className="font-medium text-zinc-900">
                    {product.pickupLocation}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Hostel / Department</p>
                <p className="font-medium text-zinc-900">
                  {product.hostelOrDept}
                </p>
              </div>
            </div>
          </div>

          {/* Seller Reviews */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="font-display text-lg font-bold text-zinc-900 mb-4">
              Seller Reviews ({reviews.length})
            </h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No completed transaction reviews for this seller yet.
              </p>
            ) : (
              <div className="space-y-4 divide-y divide-zinc-100">
                {reviews.map((rv) => (
                  <div key={rv.id} className="pt-3 first:pt-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-900">
                        {rv.reviewer?.fullName || 'PEC Student'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-amber-600">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {rv.rating}.0
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600 mt-1">{rv.comment}</p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      {formatDate(rv.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Contiguous Purchase/Rental Module & Product QR */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
            <div>
              {product.isBoosted && (
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                  <Sparkles className="h-3 w-3 text-teal-400" />
                  <span>Sponsored Listing · Boosted Visibility</span>
                </div>
              )}
              <p className="text-xs text-zinc-500">
                {product.category} · {product.subcategory} · {product.condition}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-zinc-900">
                {product.title}
              </h1>
              <p
                className={`mt-2 text-xs font-semibold ${
                  product.availabilityStatus === 'Available'
                    ? 'text-teal-700'
                    : 'text-amber-700'
                }`}
              >
                Status: {product.availabilityStatus}
              </p>
            </div>

            {/* Pricing Grid */}
            <div className="rounded-xl border border-zinc-200 bg-[#FAFAFA] p-4 space-y-3">
              {(product.listingType === 'sell' ||
                product.listingType === 'both') && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-zinc-600">
                    Buy Outright
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-zinc-900 tabular-nums">
                      {formatINR(product.sellingPrice)}
                    </span>
                    {product.negotiable && (
                      <p className="text-[11px] text-teal-700 font-medium">
                        Price negotiable
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(product.listingType === 'rent' ||
                product.listingType === 'both') && (
                <div className="space-y-2 border-t border-zinc-200 pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-zinc-600">
                      Rental Rates
                    </span>
                    <div className="text-right font-mono text-sm font-semibold text-zinc-900 tabular-nums space-y-0.5">
                      {product.rentalPriceDaily && (
                        <div>{formatINR(product.rentalPriceDaily)} / day</div>
                      )}
                      {product.rentalPriceWeekly && (
                        <div className="text-xs text-zinc-600">
                          {formatINR(product.rentalPriceWeekly)} / week
                        </div>
                      )}
                      {product.rentalPriceMonthly && (
                        <div className="text-xs text-zinc-600">
                          {formatINR(product.rentalPriceMonthly)} / month
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-600">
                    <span>Refundable Security Deposit</span>
                    <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                      {formatINR(product.securityDeposit)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Action Buttons */}
            {isOwner ? (
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-zinc-500">
                  You own this listing.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <Button asChild variant="outline">
                    <Link to={`/app/edit-listing/${product.id}`}>
                      <Edit3 className="h-4 w-4" />
                      Edit Listing
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={submitting}
                    onClick={handleDeleteListing}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {product.availabilityStatus === 'Available' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(product.listingType === 'sell' ||
                      product.listingType === 'both') && (
                      <Button
                        type="button"
                        onClick={handleBuyNow}
                        disabled={submitting}
                        className="w-full"
                      >
                        Buy Now ({formatINR(product.sellingPrice)})
                      </Button>
                    )}

                    {(product.listingType === 'rent' ||
                      product.listingType === 'both') && (
                      <Button
                        type="button"
                        variant={product.listingType === 'rent' ? 'default' : 'secondary'}
                        onClick={() => {
                          if (requireSignedIn()) setRentModalOpen(true);
                        }}
                        className="w-full"
                      >
                        <Calendar className="h-4 w-4" />
                        Rent Now
                      </Button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {product.availabilityStatus === 'Available' &&
                    (product.listingType === 'sell' ||
                      product.listingType === 'both') && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (requireSignedIn()) setOfferModalOpen(true);
                        }}
                      >
                        Make an Offer
                      </Button>
                    )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (requireSignedIn()) setContactModalOpen(true);
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Contact Seller
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleWishlist}
                  >
                    <Heart
                      className={`h-3.5 w-3.5 ${
                        wishlisted ? 'text-rose-600 fill-current' : ''
                      }`}
                    />
                    {wishlisted ? 'Saved' : 'Add to Wishlist'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQrModalOpen(true)}
                  >
                    <QrCode className="h-3.5 w-3.5 text-teal-700" />
                    View Product QR
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleShare}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share Listing
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (requireSignedIn()) setReportModalOpen(true);
                    }}
                    className="text-zinc-500"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Report
                  </Button>
                </div>
              </div>
            )}

            {/* Seller Card */}
            {product.seller && (
              <div className="border-t border-zinc-100 pt-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {product.seller.fullName}
                    </p>
                    {product.seller.verificationStatus === 'verified' && (
                      <ShieldCheck
                        aria-label="Verified PEC student"
                        className="h-4 w-4 text-teal-700 shrink-0"
                      />
                    )}
                    {product.seller.isPremium && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 shrink-0">
                        <Crown className="h-3.5 w-3.5" />
                        Premium
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">
                    {product.seller.department} · ID{' '}
                    <span className="font-mono">
                      {product.seller.maskedStudentId}
                    </span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-zinc-900 tabular-nums">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-current" />
                    {product.seller.rating ?? '5.0'}
                  </span>
                  <p className="text-[11px] text-zinc-500">
                    {product.seller.reviewCount || 0} reviews
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Embedded PingME Product QR Card */}
          <QrCodeCard
            value={product.qrPayload}
            title="PingME Product Discovery QR"
            subtitle="Scan to open this verified campus listing"
            codeLabel={product.productCode}
            size={168}
            compact
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isPublic ? (
        <div className="min-h-screen bg-[#FAFAFA]">
          <header className="border-b border-zinc-200 bg-white px-4 sm:px-8 h-16 flex items-center justify-between">
            <Link
              to="/"
              className="font-display text-xl font-bold tracking-tight text-zinc-900"
            >
              PingME
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link to="/explore" className="text-zinc-600 hover:text-zinc-900">
                Explore
              </Link>
              {user ? (
                <Button asChild size="sm">
                  <Link to="/app">Dashboard</Link>
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link to="/login">Sign In</Link>
                </Button>
              )}
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {pageBody}
          </main>
        </div>
      ) : (
        pageBody
      )}

      {/* Product QR Full Dialog */}
      {product && (
        <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Product Discovery QR</DialogTitle>
            </DialogHeader>
            <QrCodeCard
              value={product.qrPayload}
              title={product.title}
              subtitle={product.pickupLocation}
              codeLabel={product.productCode}
              size={220}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Rent Booking Dialog */}
      {product && (
        <Dialog open={rentModalOpen} onOpenChange={setRentModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Book Rental: {product.title}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleRentSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={rentStart}
                    onChange={(e) => setRentStart(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Return Date
                  </label>
                  <Input
                    type="date"
                    value={rentEnd}
                    onChange={(e) => setRentEnd(e.target.value)}
                    required
                  />
                </div>
              </div>

              {rentalEstimate ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">
                      Rental Duration ({rentalEstimate.days} days)
                    </span>
                    <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                      {formatINR(rentalEstimate.rentalTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">
                      Refundable Security Deposit
                    </span>
                    <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                      {formatINR(rentalEstimate.deposit)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-200">
                    Handover and return will be verified on campus using
                    single-use PingME QR tokens.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-red-600">
                  Return date must be after start date.
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Pickup Note for Owner (optional)
                </label>
                <Input
                  value={rentNotes}
                  onChange={(e) => setRentNotes(e.target.value)}
                  placeholder="e.g. Can collect at LTC after 3 PM"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRentModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !rentalEstimate}
                >
                  {submitting ? 'Sending...' : 'Send Rental Request'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Offer Dialog */}
      {product && (
        <Dialog open={offerModalOpen} onOpenChange={setOfferModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Make an Offer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleOfferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Your Offer (₹ INR) — Listed at {formatINR(product.sellingPrice)}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  required
                  placeholder="e.g. 200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Note (optional)
                </label>
                <Input
                  value={offerNotes}
                  onChange={(e) => setOfferNotes(e.target.value)}
                  placeholder="Can pick up today at Central Library"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOfferModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Offer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Contact Seller Dialog */}
      {product && (
        <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Message {product.seller?.fullName}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSendMessage} className="space-y-4">
              <textarea
                rows={4}
                required
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={`Ask about ${product.title}, availability, or campus pickup spot...`}
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setContactModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Report Dialog */}
      {product && (
        <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report Listing</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <textarea
                rows={3}
                required
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe why this listing violates PEC marketplace rules..."
                className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReportModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={submitting}>
                  Submit Report
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
