import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, PackageSearch, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ProductCard } from '../components/ProductCard';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../context/AuthContext';
import { apiFetch, type CategoryItem, type Product } from '../lib/api';

interface MarketplacePageProps {
  defaultType?: 'all' | 'sell' | 'rent';
  isPublic?: boolean;
  pageTitle?: string;
}

export function MarketplacePage({
  defaultType = 'all',
  isPublic = false,
  pageTitle,
}: MarketplacePageProps) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [type, setType] = useState<'all' | 'sell' | 'rent'>(
    (searchParams.get('type') as 'all' | 'sell' | 'rent') || defaultType
  );
  const [category, setCategory] = useState(
    searchParams.get('category') || 'all'
  );
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [condition, setCondition] = useState(
    searchParams.get('condition') || 'all'
  );
  const [availability, setAvailability] = useState(
    searchParams.get('availability') || 'all'
  );
  const [sort, setSort] = useState(searchParams.get('sort') || 'recent');

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setType(defaultType);
  }, [defaultType]);

  useEffect(() => {
    const qParam = searchParams.get('q');
    const catParam = searchParams.get('category');
    if (qParam !== null) setQuery(qParam);
    if (catParam !== null) setCategory(catParam);
  }, [searchParams]);

  useEffect(() => {
    apiFetch<{ categories: CategoryItem[] }>('/api/categories')
      .then((res) => setCategories(res.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ items: Product[] }>('/api/wishlist')
      .then((res) => setWishlistIds(new Set(res.items.map((i) => i.id))))
      .catch(() => {});
  }, [user]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (type !== 'all') params.set('type', type);
      if (category !== 'all') params.set('category', category);
      if (minPrice !== '') params.set('minPrice', minPrice);
      if (maxPrice !== '') params.set('maxPrice', maxPrice);
      if (condition !== 'all') params.set('condition', condition);
      if (availability !== 'all') params.set('availability', availability);
      if (sort !== 'recent') params.set('sort', sort);

      const res = await apiFetch<{ products: Product[]; total: number }>(
        `/api/products?${params.toString()}`
      );
      setProducts(res.products);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Unable to fetch products.'
      );
    } finally {
      setLoading(false);
    }
  }, [query, type, category, minPrice, maxPrice, condition, availability, sort]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchProducts();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const handleToggleWishlist = async (productId: string) => {
    if (!user) {
      toast.error('Please sign in to save items to your wishlist.');
      return;
    }
    const exists = wishlistIds.has(productId);
    try {
      await apiFetch(`/api/wishlist/${productId}`, {
        method: exists ? 'DELETE' : 'POST',
      });
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (exists) next.delete(productId);
        else next.add(productId);
        return next;
      });
      toast.success(exists ? 'Removed from wishlist' : 'Saved to wishlist');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Wishlist update failed.'
      );
    }
  };

  const clearAllFilters = () => {
    setQuery('');
    setType(defaultType);
    setCategory('all');
    setMinPrice('');
    setMaxPrice('');
    setCondition('all');
    setAvailability('all');
    setSort('recent');
    setSearchParams({});
  };

  const linkPrefix = isPublic ? '/p' : '/app/product';

  const filterPanel = (
    <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Filter className="h-4 w-4 text-teal-700" />
          Filters
        </span>
        <button
          type="button"
          onClick={clearAllFilters}
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          Clear all
        </button>
      </div>

      {/* Transaction Type */}
      <div>
        <p className="text-xs font-semibold text-zinc-700 mb-2">
          Transaction Type
        </p>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1">
          {[
            { value: 'all', label: 'All' },
            { value: 'sell', label: 'For Sale' },
            { value: 'rent', label: 'For Rent' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value as 'all' | 'sell' | 'rent')}
              className={`rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                type === opt.value
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          Product Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-zinc-700">
            Price Range (INR)
          </span>
          {maxPrice && (
            <span className="font-mono text-[11px] text-teal-700 tabular-nums">
              Up to ₹{maxPrice}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <Input
            type="number"
            min={0}
            placeholder="Min ₹"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="h-9 text-xs tabular-nums"
          />
          <Input
            type="number"
            min={0}
            placeholder="Max ₹"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="h-9 text-xs tabular-nums"
          />
        </div>
        <input
          type="range"
          min={0}
          max={2000}
          step={25}
          value={maxPrice === '' ? 2000 : Math.min(2000, Number(maxPrice))}
          onChange={(e) => setMaxPrice(e.target.value)}
          aria-label="Maximum price slider"
          className="w-full accent-teal-600 cursor-pointer"
        />
      </div>

      {/* Condition */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          Product Condition
        </label>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <option value="all">Any Condition</option>
          <option value="New">New</option>
          <option value="Like New">Like New</option>
          <option value="Good">Good</option>
          <option value="Fair">Fair</option>
        </select>
      </div>

      {/* Availability */}
      <div>
        <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
          Availability
        </label>
        <select
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <option value="all">All Statuses</option>
          <option value="Available">Available</option>
          <option value="Currently Rented">Currently Rented</option>
          <option value="Sold">Sold</option>
        </select>
      </div>
    </div>
  );

  const content = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-900">
            {pageTitle ||
              (defaultType === 'sell'
                ? 'Buy Campus Products'
                : defaultType === 'rent'
                  ? 'Rent Campus Gear'
                  : 'Explore PEC Marketplace')}
          </h1>
          <p className="text-sm text-zinc-600 mt-0.5 tabular-nums">
            Showing {products.length}{' '}
            {products.length === 1 ? 'matching product' : 'matching products'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort products"
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <option value="recent">Recently Added</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="popular">Most Popular</option>
          </select>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="h-4 w-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by product name, category, description, or product code (e.g. calculator, PM-PEC-10242)..."
          className="h-11 pl-10 bg-white"
        />
      </div>

      {mobileFiltersOpen && <div className="lg:hidden">{filterPanel}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="hidden lg:block lg:col-span-3 sticky top-20">
          {filterPanel}
        </aside>

        <div className="lg:col-span-9">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3"
                >
                  <Skeleton className="aspect-[4/3] w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
              <PackageSearch className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-zinc-900">
                No matching items found
              </h3>
              <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
                Try broadening your search keywords, price range, or clearing
                active filters.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={clearAllFilters}
                className="mt-4"
              >
                Reset All Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  linkPrefix={linkPrefix}
                  isWishlisted={wishlistIds.has(p.id)}
                  onToggleWishlist={user ? handleToggleWishlist : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
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
            <Link
              to="/explore"
              className="text-zinc-900 font-semibold whitespace-nowrap"
            >
              Explore Marketplace
            </Link>
            <Link to="/eateries" className="hover:text-zinc-900 whitespace-nowrap">
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
