import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  MapPin,
  Search,
  Star,
  Store,
  Timer,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../context/AuthContext';
import { apiFetch, type ShopItem } from '../lib/api';
import { resolveImageUrl } from '../lib/demoImages';

interface EateriesPageProps {
  isPublic?: boolean;
}

export function EateriesPage({ isPublic = false }: EateriesPageProps) {
  const { user } = useAuth();
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [openOnly, setOpenOnly] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ shops: ShopItem[] }>('/api/shops')
      .then((res) => setShops(res.shops))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredShops = shops.filter((shop) => {
    if (openOnly && !shop.isActive) return false;
    if (query.trim()) {
      const hay = `${shop.name} ${shop.location} ${shop.description}`.toLowerCase();
      if (!hay.includes(query.trim().toLowerCase())) return false;
    }
    return true;
  });

  const baseShopPath = isPublic ? '/eateries' : '/app/eateries';

  const content = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-700">
            PEC Campus Takeaway Ordering
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 mt-0.5">
            Campus Eateries &amp; Canteens
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Order fresh snacks, meals, and beverages for counter takeaway across
            PEC Chandigarh.
          </p>
        </div>

        {user && (
          <div className="flex items-center gap-2.5">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/orders">My Food Orders</Link>
            </Button>
            {(user.role === 'shop_owner' || user.role === 'admin') && (
              <Button asChild size="sm">
                <Link to="/app/shop-dashboard">
                  <Store className="h-4 w-4" />
                  Shop Dashboard
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Search & Availability Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campus eateries by name or location (e.g. Verka, Nescafe, LTC, Student Centre)..."
            className="h-11 pl-10 bg-white"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpenOnly((prev) => !prev)}
          className={`h-11 rounded-lg border px-4 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            openOnly
              ? 'border-teal-600 bg-teal-50 text-teal-800'
              : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          {openOnly ? 'Showing Open Shops Only' : 'All Participating Shops'}
        </button>
      </div>

      {/* Eateries Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3"
            >
              <Skeleton className="aspect-[16/10] w-full" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : filteredShops.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
          <UtensilsCrossed className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-900">
            No matching eateries found
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            Try clearing your search or showing closed shops as well.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShops.map((shop) => {
            const img = resolveImageUrl(shop.imageUrl);
            return (
              <article
                key={shop.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-colors hover:border-teal-600"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-zinc-100">
                  {img ? (
                    <img
                      src={img}
                      alt={shop.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-400">
                      <UtensilsCrossed className="h-8 w-8" />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-lg font-bold text-zinc-900 leading-snug">
                      {shop.name}
                    </h2>
                    <span
                      className={`text-xs font-semibold whitespace-nowrap pt-0.5 ${
                        shop.isActive ? 'text-teal-700' : 'text-zinc-500'
                      }`}
                    >
                      {shop.isActive ? 'Open Now' : 'Closed'}
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 line-clamp-2">
                    {shop.description}
                  </p>

                  <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3.5 text-xs text-zinc-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate">{shop.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span className="tabular-nums">{shop.openingHours}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Timer className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="tabular-nums">Prep: {shop.prepTime}</span>
                      </span>
                      <span className="flex items-center gap-1 font-medium text-zinc-900 tabular-nums">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                        {shop.reviewCount > 0 ? shop.averageRating.toFixed(1) : 'New'}{' '}
                        <span className="text-zinc-400 font-normal">
                          / 5 · {shop.reviewCount}{' '}
                          {shop.reviewCount === 1 ? 'review' : 'reviews'}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-1">
                    <Button asChild className="w-full">
                      <Link to={`${baseShopPath}/${shop.slug}`}>
                        View Menu
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
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
                <Link to="/app">Dashboard</Link>
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
