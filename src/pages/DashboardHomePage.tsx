import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Cpu,
  Dumbbell,
  Home,
  PlusCircle,
  QrCode,
  Repeat,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ProductCard } from '../components/ProductCard';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../context/AuthContext';
import { apiFetch, type Product } from '../lib/api';

export function DashboardHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchText, setSearchText] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ products: Product[] }>('/api/products')
      .then((res) => setProducts(res.products))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/app/explore?q=${encodeURIComponent(searchText.trim())}`);
  };

  const recentListings = products.slice(0, 3);
  const popularRentals = products
    .filter((p) => p.listingType === 'rent' || p.listingType === 'both')
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 3);
  const recommended = products
    .filter((p) => p.sellerId !== user?.id)
    .slice(0, 3);

  const categoryCards = [
    {
      name: 'Academic',
      items: ['Textbooks', 'Scientific calculators', 'Drawing boards', 'Lab accessories'],
      icon: BookOpen,
    },
    {
      name: 'Electronics',
      items: ['Laptops & accessories', 'Keyboards', 'Headphones', 'Chargers'],
      icon: Cpu,
    },
    {
      name: 'Hostel and Lifestyle',
      items: ['Furniture', 'Storage items', 'Kitchen appliances', 'Cycles'],
      icon: Home,
    },
    {
      name: 'Sports and Recreation',
      items: ['Sports equipment', 'Musical instruments', 'Fitness', 'Board games'],
      icon: Dumbbell,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-zinc-500">
                {user?.studentId} · {user?.department}
              </span>
              {user?.verificationStatus === 'verified' ? (
                <span className="inline-flex items-center gap-1 font-medium text-teal-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified PEC Student
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Verification Pending
                </span>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900">
              Welcome back, {user?.fullName}
            </h1>
            <p className="text-sm text-zinc-600 max-w-2xl">
              Search PEC student listings, manage active rentals, or scan a
              PingME QR code for verified campus handovers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button asChild>
              <Link to="/app/sell">
                <PlusCircle className="h-4 w-4" />
                Sell an Item
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/app/rent-out">
                <Tag className="h-4 w-4" />
                Rent Out Gear
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/app/eateries">
                <UtensilsCrossed className="h-4 w-4" />
                Eateries
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/app/qr-centre">
                <QrCode className="h-4 w-4" />
                QR Centre
              </Link>
            </Button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search textbooks, calculators, cycles, hostel desks, or PM-PEC codes..."
              className="h-11 pl-10 bg-zinc-50"
            />
          </div>
          <Button type="submit" size="lg">
            Search
          </Button>
        </form>
      </section>

      {/* Categories Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-zinc-900">
            Browse by Campus Category
          </h2>
          <Link
            to="/app/explore"
            className="text-xs font-semibold text-teal-700 hover:underline inline-flex items-center gap-1"
          >
            All Categories <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categoryCards.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.name}
                to={`/app/explore?category=${encodeURIComponent(cat.name)}`}
                className="group rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-teal-600"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-teal-700">
                    {cat.name}
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {cat.items.join(' · ')}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recently Listed */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-zinc-900">
            Recently Listed on Campus
          </h2>
          <Link
            to="/app/explore"
            className="text-xs font-semibold text-teal-700 hover:underline inline-flex items-center gap-1"
          >
            Explore All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {recentListings.map((p) => (
              <ProductCard key={p.id} product={p} linkPrefix="/app/product" />
            ))}
          </div>
        )}
      </section>

      {/* Popular Rentals */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-teal-700" />
            <h2 className="font-display text-lg font-bold text-zinc-900">
              Popular Student Rentals
            </h2>
          </div>
          <Link
            to="/app/rent"
            className="text-xs font-semibold text-teal-700 hover:underline inline-flex items-center gap-1"
          >
            Browse Rentals <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {popularRentals.map((p) => (
            <ProductCard key={p.id} product={p} linkPrefix="/app/product" />
          ))}
        </div>
      </section>

      {/* Recommended for You */}
      {recommended.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-zinc-900">
              Recommended for Your Semester
            </h2>
            <Link
              to="/app/buy"
              className="text-xs font-semibold text-teal-700 hover:underline inline-flex items-center gap-1"
            >
              Buy Essentials <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {recommended.map((p) => (
              <ProductCard key={p.id} product={p} linkPrefix="/app/product" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
