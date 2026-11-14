import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  Timer,
  Trash2,
  UtensilsCrossed,
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
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../context/AuthContext';
import {
  apiFetch,
  type EateryOrder,
  type MenuItem,
  type ShopItem,
  type ShopReviewItem,
} from '../lib/api';
import { resolveImageUrl } from '../lib/demoImages';
import { formatDateTime, formatINR } from '../lib/utils';

interface ShopMenuPageProps {
  isPublic?: boolean;
}

interface CartEntry {
  item: MenuItem;
  quantity: number;
}

const MENU_CATEGORIES = ['Snacks', 'Meals', 'Beverages', 'Other items'] as const;

export function ShopMenuPage({ isPublic = false }: ShopMenuPageProps) {
  const { shopId } = useParams<{ shopId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [shop, setShop] = useState<ShopItem | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<ShopReviewItem[]>([]);
  const [ratingDistribution, setRatingDistribution] = useState<Record<number, number>>({
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  });
  const [loading, setLoading] = useState(true);
  const [reviewSort, setReviewSort] = useState<'newest' | 'highest'>('newest');

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [dietaryFilter, setDietaryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Per-item quantity picker before adding to cart
  const [draftQty, setDraftQty] = useState<Record<string, number>>({});
  // Cart state
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [orderNotes, setOrderNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    crypto.randomUUID()
  );
  const [placingOrder, setPlacingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<EateryOrder | null>(null);

  const loadShop = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{
        shop: ShopItem;
        menuItems: MenuItem[];
        reviews: ShopReviewItem[];
        ratingDistribution: Record<number, number>;
      }>(`/api/shops/${encodeURIComponent(shopId)}?sort=${reviewSort}`);
      setShop(data.shop);
      setMenuItems(data.menuItems);
      setReviews(data.reviews);
      setRatingDistribution(data.ratingDistribution);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load shop menu.');
    } finally {
      setLoading(false);
    }
  }, [shopId, reviewSort]);

  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  const resetIdempotency = () => {
    setIdempotencyKey(crypto.randomUUID());
  };

  const getDraftQty = (itemId: string) => draftQty[itemId] || 1;

  const setItemDraftQty = (itemId: string, next: number) => {
    const clamped = Math.max(1, Math.min(20, next));
    setDraftQty((prev) => ({ ...prev, [itemId]: clamped }));
  };

  const addToCart = (item: MenuItem) => {
    if (!item.isAvailable) {
      toast.error(`${item.name} is currently unavailable.`);
      return;
    }
    if (!shop?.isActive) {
      toast.error('This eatery is currently closed for takeaway orders.');
      return;
    }
    const qtyToAdd = getDraftQty(item.id);
    setCart((prev) => {
      const existing = prev[item.id];
      const nextQty = Math.min(20, (existing?.quantity || 0) + qtyToAdd);
      return {
        ...prev,
        [item.id]: { item, quantity: nextQty },
      };
    });
    resetIdempotency();
    toast.success(`Added ${qtyToAdd} × ${item.name} to cart`);
  };

  const updateCartQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const entry = prev[itemId];
      if (!entry) return prev;
      const next = entry.quantity + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...entry, quantity: Math.min(20, next) },
      };
    });
    resetIdempotency();
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
    resetIdempotency();
  };

  const cartEntries = Object.values(cart);
  const cartTotal = useMemo(
    () =>
      cartEntries.reduce(
        (sum, entry) => sum + entry.item.price * entry.quantity,
        0
      ),
    [cartEntries]
  );
  const cartItemCount = useMemo(
    () => cartEntries.reduce((sum, entry) => sum + entry.quantity, 0),
    [cartEntries]
  );

  const filteredMenu = useMemo(() => {
    return menuItems.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      if (dietaryFilter !== 'All' && item.dietaryLabel !== dietaryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const hay = `${item.name} ${item.description} ${item.category}`.toLowerCase();
        if (!hay.includes(searchQuery.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [menuItems, selectedCategory, dietaryFilter, searchQuery]);

  const groupedMenu = useMemo(() => {
    const groups: { category: string; items: MenuItem[] }[] = [];
    const knownSet = new Set<string>(MENU_CATEGORIES);
    for (const cat of MENU_CATEGORIES) {
      const items = filteredMenu.filter((i) => i.category === cat);
      if (items.length > 0) groups.push({ category: cat, items });
    }
    const extra = filteredMenu.filter((i) => !knownSet.has(i.category));
    if (extra.length > 0) groups.push({ category: 'Other items', items: extra });
    return groups;
  }, [filteredMenu]);

  const handlePlaceOrder = async () => {
    if (!user) {
      toast.error('Please sign in with your PEC student account to place a takeaway order.');
      navigate('/login');
      return;
    }
    if (!shop || cartEntries.length === 0) return;

    setPlacingOrder(true);
    try {
      const res = await apiFetch<{ order: EateryOrder; shop: ShopItem }>(
        '/api/orders',
        {
          method: 'POST',
          body: JSON.stringify({
            shopId: shop.id,
            items: cartEntries.map((c) => ({
              menuItemId: c.item.id,
              quantity: c.quantity,
            })),
            notes: orderNotes.trim() || undefined,
            idempotencyKey,
          }),
        }
      );
      setConfirmedOrder(res.order);
      setCart({});
      setOrderNotes('');
      resetIdempotency();
      toast.success(`Takeaway order ${res.order.orderCode} placed!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Unable to place takeaway order.'
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  const backLink = isPublic ? '/eateries' : '/app/eateries';

  const content = loading ? (
    <div className="space-y-6">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <div className="lg:col-span-4">
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    </div>
  ) : !shop ? (
    <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
      <h2 className="text-lg font-semibold text-zinc-900">Eatery not found</h2>
      <Button asChild variant="outline" className="mt-4">
        <Link to={backLink}>Back to Campus Eateries</Link>
      </Button>
    </div>
  ) : (
    <div className="space-y-8">
      <div>
        <Link
          to={backLink}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to All Campus Eateries
        </Link>

        {/* Shop Banner Card */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-5 aspect-[16/10] lg:aspect-auto bg-zinc-100">
            {resolveImageUrl(shop.imageUrl) && (
              <img
                src={resolveImageUrl(shop.imageUrl)!}
                alt={shop.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="lg:col-span-7 p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`text-xs font-semibold ${
                    shop.isActive ? 'text-teal-700' : 'text-red-600'
                  }`}
                >
                  {shop.isActive
                    ? 'Open for Takeaway Orders'
                    : 'Currently Closed'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 tabular-nums">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                  {shop.reviewCount > 0 ? shop.averageRating.toFixed(1) : 'New'} / 5
                  <span className="text-zinc-500 font-normal">
                    ({shop.reviewCount} verified{' '}
                    {shop.reviewCount === 1 ? 'review' : 'reviews'})
                  </span>
                </span>
              </div>

              <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-zinc-900">
                {shop.name}
              </h1>
              <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                {shop.description}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-zinc-100 pt-4 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-teal-700 shrink-0" />
                <span>{shop.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-teal-700 shrink-0" />
                <span className="tabular-nums">{shop.openingHours}</span>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-teal-700 shrink-0" />
                <span className="tabular-nums">Est. Prep: {shop.prepTime}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu + Cart Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Menu Controls & Items */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu items..."
                className="flex-1"
              />
              <select
                value={dietaryFilter}
                onChange={(e) => setDietaryFilter(e.target.value)}
                aria-label="Dietary filter"
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800"
              >
                <option value="All">All Dietary Labels</option>
                <option value="Veg">Veg</option>
                <option value="Vegan">Vegan</option>
                <option value="Egg">Egg</option>
                <option value="Non-Veg">Non-Veg</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['All', ...MENU_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {groupedMenu.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
              <UtensilsCrossed className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-zinc-800">
                No menu items match your current filter.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedMenu.map((group) => (
                <section key={group.category} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                    <h2 className="font-display text-lg font-bold text-zinc-900">
                      {group.category}
                    </h2>
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {group.items.length}{' '}
                      {group.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {group.items.map((item) => {
                      const img = resolveImageUrl(item.imageUrl);
                      const qty = getDraftQty(item.id);
                      const inCart = cart[item.id]?.quantity || 0;
                      const dietDotColor =
                        item.dietaryLabel === 'Non-Veg'
                          ? 'bg-red-600'
                          : item.dietaryLabel === 'Egg'
                            ? 'bg-amber-500'
                            : 'bg-emerald-600';

                      return (
                        <div
                          key={item.id}
                          className={`flex flex-col justify-between rounded-xl border bg-white p-4 transition-colors ${
                            item.isAvailable
                              ? 'border-zinc-200 hover:border-zinc-300'
                              : 'border-zinc-200 bg-zinc-50/60 opacity-80'
                          }`}
                        >
                          <div className="flex gap-3.5">
                            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-100">
                              {img ? (
                                <img
                                  src={img}
                                  alt={item.name}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-zinc-400">
                                  <UtensilsCrossed className="h-5 w-5" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                {item.dietaryLabel ? (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-600">
                                    <span
                                      className={`h-2 w-2 rounded-full ${dietDotColor}`}
                                    />
                                    {item.dietaryLabel}
                                  </span>
                                ) : (
                                  <span />
                                )}
                                <span
                                  className={`text-[11px] font-semibold ${
                                    item.isAvailable
                                      ? 'text-teal-700'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {item.isAvailable ? 'Available' : 'Unavailable'}
                                </span>
                              </div>

                              <h3 className="mt-1 text-sm font-semibold text-zinc-900 leading-snug">
                                {item.name}
                              </h3>
                              <p className="mt-1 text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                            <div>
                              <span className="font-mono text-base font-bold text-zinc-900 tabular-nums">
                                {formatINR(item.price)}
                              </span>
                              {inCart > 0 && (
                                <p className="text-[11px] font-medium text-teal-700 tabular-nums">
                                  {inCart} in cart
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50">
                                <button
                                  type="button"
                                  aria-label={`Decrease quantity for ${item.name}`}
                                  disabled={!item.isAvailable || qty <= 1}
                                  onClick={() => setItemDraftQty(item.id, qty - 1)}
                                  className="p-1.5 text-zinc-600 hover:text-zinc-900 disabled:opacity-40 cursor-pointer"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-6 text-center font-mono text-xs font-semibold tabular-nums">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Increase quantity for ${item.name}`}
                                  disabled={!item.isAvailable || qty >= 20}
                                  onClick={() => setItemDraftQty(item.id, qty + 1)}
                                  className="p-1.5 text-zinc-600 hover:text-zinc-900 disabled:opacity-40 cursor-pointer"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <Button
                                type="button"
                                size="sm"
                                disabled={!item.isAvailable || !shop.isActive}
                                onClick={() => addToCart(item)}
                              >
                                Add to Cart
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Right: Persistent Takeaway Cart */}
        <aside className="lg:col-span-4 lg:sticky lg:top-20 rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-zinc-900 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-teal-700" />
                Takeaway Cart
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{shop.name}</p>
            </div>
            {cartItemCount > 0 && (
              <span className="font-mono text-xs font-semibold text-teal-700 tabular-nums">
                {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>

          {cartEntries.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Select available items from the menu to start your takeaway order.
            </div>
          ) : (
            <>
              <div className="divide-y divide-zinc-100 max-h-72 overflow-y-auto pr-1">
                {cartEntries.map(({ item, quantity }) => (
                  <div key={item.id} className="py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 font-mono tabular-nums mt-0.5">
                        {formatINR(item.price)} × {quantity} ={' '}
                        <span className="font-semibold text-zinc-900">
                          {formatINR(item.price * quantity)}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center rounded-md border border-zinc-200">
                        <button
                          type="button"
                          aria-label={`Remove one ${item.name}`}
                          onClick={() => updateCartQty(item.id, -1)}
                          className="p-1 text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center font-mono text-[11px] font-semibold tabular-nums">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Add one ${item.name}`}
                          onClick={() => updateCartQty(item.id, 1)}
                          className="p-1 text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete ${item.name}`}
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 text-zinc-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Pickup Note (optional)
                </label>
                <Input
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Less spicy, collecting at 1:15 PM"
                  className="h-9 text-xs"
                  maxLength={200}
                />
              </div>

              <div className="border-t border-zinc-100 pt-3 space-y-2">
                <div className="flex items-center justify-between text-sm font-bold text-zinc-900">
                  <span>Final Order Total</span>
                  <span className="font-mono text-lg tabular-nums">
                    {formatINR(cartTotal)}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 flex items-start gap-2 text-[11px] text-zinc-600 leading-relaxed">
                <Info className="h-3.5 w-3.5 text-teal-700 shrink-0 mt-0.5" />
                <span>{shop.paymentProcessNote}</span>
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={placingOrder || !shop.isActive}
                onClick={handlePlaceOrder}
              >
                {placingOrder ? 'Placing Takeaway Order...' : 'Place Takeaway Order'}
              </Button>
            </>
          )}
        </aside>
      </div>

      {/* Verified Ratings & Reviews Section */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-zinc-900">
              Verified Student Ratings &amp; Reviews
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Reviews can only be submitted after an order is collected from{' '}
              {shop.name}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Sort by:</span>
            <select
              value={reviewSort}
              onChange={(e) =>
                setReviewSort(e.target.value as 'newest' | 'highest')
              }
              aria-label="Sort shop reviews"
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800"
            >
              <option value="newest">Newest First</option>
              <option value="highest">Highest Rated</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-4 rounded-xl border border-zinc-200 bg-[#FAFAFA] p-5 text-center">
            <p className="font-mono text-4xl font-bold text-zinc-900 tabular-nums">
              {shop.reviewCount > 0 ? shop.averageRating.toFixed(1) : '—'}
            </p>
            <div className="mt-1 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-4 w-4 ${
                    n <= Math.round(shop.averageRating)
                      ? 'fill-amber-400 text-amber-500'
                      : 'text-zinc-300'
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500 tabular-nums">
              Based on {shop.reviewCount} verified{' '}
              {shop.reviewCount === 1 ? 'review' : 'reviews'}
            </p>
          </div>

          <div className="md:col-span-8 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = ratingDistribution[star] || 0;
              const pct =
                shop.reviewCount > 0
                  ? Math.round((count / shop.reviewCount) * 100)
                  : 0;
              return (
                <div key={star} className="flex items-center gap-3 text-xs">
                  <span className="w-10 font-mono text-zinc-700 tabular-nums">
                    {star} ★
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full bg-teal-600 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-zinc-500 tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {reviews.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4 text-center">
            No verified reviews yet. Collect a takeaway order to be the first to
            review.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {reviews.map((rev) => (
              <div key={rev.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900">
                      {rev.student?.fullName || 'PEC Student'}
                    </span>
                    <span className="font-mono text-xs text-zinc-400">
                      · {rev.student?.maskedStudentId || 'Verified'}
                    </span>
                    {rev.moderationStatus === 'flagged' && (
                      <span className="text-[11px] font-medium text-amber-700">
                        · Under Review
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 tabular-nums">
                    {formatDateTime(rev.createdAt)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3.5 w-3.5 ${
                        n <= rev.rating
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-zinc-200'
                      }`}
                    />
                  ))}
                </div>
                {rev.comment && (
                  <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                    {rev.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pickup Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmedOrder)}
        onOpenChange={(open) => {
          if (!open) setConfirmedOrder(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-teal-800">
              <CheckCircle2 className="h-5 w-5 text-teal-700" />
              Takeaway Order Confirmed
            </DialogTitle>
          </DialogHeader>
          {confirmedOrder && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 text-center">
                <p className="text-xs font-medium text-teal-800">
                  Unique Takeaway Order ID
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-zinc-900">
                  {confirmedOrder.orderCode}
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Status: <strong className="text-zinc-900">{confirmedOrder.status}</strong>{' '}
                  · {shop.name}
                </p>
              </div>

              <div className="space-y-1.5 border-y border-zinc-100 py-3 text-xs">
                {confirmedOrder.items.map((line) => (
                  <div
                    key={line.menuItemId}
                    className="flex items-center justify-between text-zinc-700"
                  >
                    <span>
                      {line.quantity} × {line.name}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatINR(line.subtotal)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 font-bold text-zinc-900 text-sm">
                  <span>Order Total</span>
                  <span className="font-mono tabular-nums">
                    {formatINR(confirmedOrder.totalAmount)}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 leading-relaxed">
                <strong className="text-zinc-900">Payment &amp; Collection:</strong>{' '}
                {shop.paymentProcessNote} Pickup location: {shop.location}.
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => {
                    setConfirmedOrder(null);
                    navigate('/app/orders');
                  }}
                >
                  Track Live Status
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmedOrder(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  if (!isPublic) {
    return content;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="font-display text-xl font-bold tracking-tight text-zinc-900 whitespace-nowrap"
          >
            PingME
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600">
            <Link to="/" className="hover:text-zinc-900 whitespace-nowrap">
              Home
            </Link>
            <Link to="/explore" className="hover:text-zinc-900 whitespace-nowrap">
              Explore Marketplace
            </Link>
            <Link
              to="/eateries"
              className="text-zinc-900 font-semibold whitespace-nowrap"
            >
              Eateries
            </Link>
            <Link to="/scan" className="hover:text-zinc-900 whitespace-nowrap">
              Scan QR
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Button asChild size="sm">
                <Link to="/app/orders">My Food Orders</Link>
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-zinc-700 hover:text-zinc-900"
                >
                  Sign In
                </Link>
                <Button asChild size="sm">
                  <Link to="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {content}
      </main>
    </div>
  );
}
