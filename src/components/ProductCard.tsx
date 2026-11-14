import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Heart, MapPin, Package, QrCode, ShieldCheck, Sparkles } from 'lucide-react';
import type { Product } from '../lib/api';
import { resolveImageUrl } from '../lib/demoImages';
import { formatINR } from '../lib/utils';

interface ProductCardProps {
  product: Product;
  isWishlisted?: boolean;
  onToggleWishlist?: (productId: string) => void;
  linkPrefix?: string;
}

export function ProductCard({
  product,
  isWishlisted = false,
  onToggleWishlist,
  linkPrefix = '/p',
}: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const resolvedSrc = resolveImageUrl(product.images?.[0]);

  const primaryPrice =
    product.listingType === 'rent'
      ? product.rentalPriceDaily
        ? `${formatINR(product.rentalPriceDaily)}/day`
        : product.rentalPriceMonthly
          ? `${formatINR(product.rentalPriceMonthly)}/mo`
          : `${formatINR(product.rentalPriceWeekly)}/wk`
      : formatINR(product.sellingPrice);

  const secondaryRate =
    product.listingType === 'both' && product.rentalPriceDaily
      ? `or ${formatINR(product.rentalPriceDaily)}/day rent`
      : product.listingType === 'rent' && product.rentalPriceMonthly
        ? `${formatINR(product.rentalPriceMonthly)}/mo`
        : null;

  return (
    <div className="group flex flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <Link
        to={`${linkPrefix}/${product.productCode}`}
        className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 block"
      >
        {resolvedSrc && !imgError ? (
          <img
            src={resolvedSrc}
            alt={product.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 p-4 text-center">
            <Package className="h-8 w-8 text-zinc-400 mb-2" />
            <span className="text-xs font-medium text-zinc-500 line-clamp-1">
              {product.title}
            </span>
          </div>
        )}

        {product.isBoosted && (
          <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-zinc-900/90 px-2 py-1 text-[11px] font-semibold tracking-wide text-white shadow-sm">
            <Sparkles className="h-3 w-3 text-teal-400" />
            <span>Sponsored</span>
            <span className="text-zinc-400">·</span>
            <span className="text-teal-300">Boosted</span>
          </div>
        )}

        {product.availabilityStatus !== 'Available' && (
          <div className="absolute inset-x-0 bottom-0 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-white">
            {product.availabilityStatus}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span className="truncate">
            {product.category} · {product.condition}
          </span>
          <span className="font-mono text-[11px] text-zinc-400 shrink-0 tabular-nums">
            {product.productCode}
          </span>
        </div>

        <Link
          to={`${linkPrefix}/${product.productCode}`}
          className="mt-1.5 text-base font-semibold text-zinc-900 line-clamp-1 hover:text-teal-700 transition-colors"
        >
          {product.title}
        </Link>

        <div className="mt-2 flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-base font-bold text-zinc-900 tabular-nums">
              {primaryPrice}
            </span>
            {secondaryRate && (
              <span className="text-xs text-zinc-500 truncate tabular-nums">
                {secondaryRate}
              </span>
            )}
          </div>

          <span className="text-xs font-medium text-teal-700 shrink-0">
            {product.listingType === 'sell'
              ? 'For Sale'
              : product.listingType === 'rent'
                ? 'For Rent'
                : 'Sale & Rent'}
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{product.pickupLocation}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {product.seller?.verificationStatus === 'verified' && (
              <span
                title="Verified PEC Student"
                className="inline-flex items-center gap-1 text-teal-700 font-medium"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
            {product.seller?.isPremium && (
              <span
                title="PingME Premium Seller"
                className="inline-flex items-center gap-1 text-amber-700 font-semibold"
              >
                <Crown className="h-3.5 w-3.5" />
              </span>
            )}
            {onToggleWishlist && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onToggleWishlist(product.id);
                }}
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                  isWishlisted
                    ? 'text-rose-600 bg-rose-50'
                    : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <Heart
                  className="h-4 w-4"
                  fill={isWishlisted ? 'currentColor' : 'none'}
                />
              </button>
            )}
            <Link
              to={`${linkPrefix}/${product.productCode}`}
              aria-label="View product QR and details"
              className="rounded-md p-1.5 text-zinc-400 hover:text-teal-700 hover:bg-teal-50 transition-colors"
            >
              <QrCode className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
