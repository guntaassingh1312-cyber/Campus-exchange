import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ArrowRight,
  BookOpen,
  Cpu,
  Dumbbell,
  Home,
  QrCode,
  Repeat,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { ProductCard } from '../components/ProductCard';
import { HERO_CAMPUS_IMAGE } from '../lib/demoImages';
import { apiFetch, type Product } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface CommunityStats {
  verifiedStudents: number;
  activeListings: number;
  completedExchanges: number;
  qrScansVerified: number;
}

export function LandingPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<CommunityStats>({
    verifiedStudents: 14,
    activeListings: 16,
    completedExchanges: 2,
    qrScansVerified: 148,
  });
  const [heroQrUrl, setHeroQrUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    QRCode.toDataURL('PINGME:PROD:PM-PEC-10242', {
      width: 240,
      margin: 2,
      color: { dark: '#0f766e', light: '#ffffff' },
    })
      .then(setHeroQrUrl)
      .catch(() => {});

    Promise.all([
      apiFetch<{ products: Product[] }>('/api/products'),
      apiFetch<CommunityStats>('/api/stats/community'),
    ])
      .then(([prodRes, statRes]) => {
        setProducts(prodRes.products);
        setStats(statRes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const featuredProducts = products.slice(0, 6);

  const categories = [
    {
      name: 'Academic',
      detail: 'Textbooks, scientific calculators, drawing boards, lab instruments',
      icon: BookOpen,
    },
    {
      name: 'Electronics',
      detail: 'Laptop stands, mechanical keyboards, headphones, chargers',
      icon: Cpu,
    },
    {
      name: 'Hostel and Lifestyle',
      detail: 'Study tables, bicycles, storage racks, kettles',
      icon: Home,
    },
    {
      name: 'Sports and Recreation',
      detail: 'Badminton rackets, guitars, fitness gear, board games',
      icon: Dumbbell,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">
      {/* Top Bar Contract: 3 zones */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="font-display text-xl font-bold tracking-tight text-zinc-900 whitespace-nowrap shrink-0"
          >
            PingME
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
            <a
              href="#top"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Home
            </a>
            <Link
              to="/explore"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Explore Marketplace
            </Link>
            <Link
              to="/eateries"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Eateries
            </Link>
            <Link
              to="/app/sell"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Sell an Item
            </Link>
            <Link
              to="/app/rent-out"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Rent an Item
            </Link>
            <a
              href="#how-it-works"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
          </nav>

          <div className="flex items-center gap-4 shrink-0">
            {user ? (
              <Button asChild size="sm">
                <Link to="/app">Open Dashboard</Link>
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-zinc-700 hover:text-zinc-900 whitespace-nowrap shrink-0"
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

      {/* Hero Section */}
      <section id="top" className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-medium tracking-wide text-teal-700">
                PingME Campus Exchange · PEC Chandigarh
              </p>
              <h1
                className="mt-3 font-display text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl leading-[1.08]"
                style={{ textWrap: 'balance' }}
              >
                Buy Less. Share More. Discover More.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg">
                Your exclusive PEC Chandigarh marketplace to buy, sell and rent
                everyday essentials directly from fellow students.
              </p>
              <p className="mt-2 font-mono text-xs text-zinc-500">
                Your Campus. Your Resources. One QR Away.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/explore">
                    Explore Marketplace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/app/sell">List Your First Item</Link>
                </Button>
              </div>

              {/* Prominent PingME QR Visual Element */}
              <div className="mt-8 flex items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 max-w-md">
                {heroQrUrl ? (
                  <img
                    src={heroQrUrl}
                    alt="Sample PingME Product QR"
                    className="h-20 w-20 rounded-lg border border-zinc-200 bg-white p-1 shrink-0"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-lg border border-zinc-200 bg-white flex items-center justify-center shrink-0">
                    <QrCode className="h-8 w-8 text-teal-700" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">
                    Scan. Discover. Connect.
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                    Every listed textbook, calculator, or bicycle carries a
                    unique PingME QR tag for instant lookup and verified campus
                    handovers.
                  </p>
                  <Link
                    to="/scan"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                  >
                    Try QR Scanner
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[320px] lg:min-h-[440px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                <img
                  src={HERO_CAMPUS_IMAGE}
                  alt="Punjab Engineering College (PEC) Chandigarh main academic campus building and courtyard"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/85 via-zinc-950/40 to-transparent p-6 text-white">
                  <p className="font-mono text-xs text-teal-300">
                    Punjab Engineering College · Sector 12, Chandigarh
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    Verified hostel-to-hostel exchanges across Himalaya, Shivalik,
                    Kurukshetra & Kalpana Chawla Hostels with one-time QR
                    handover verification.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Community Statistics Row */}
          <div className="mt-12 grid grid-cols-2 gap-4 border-t border-zinc-200 pt-8 sm:grid-cols-4">
            <div>
              <p className="text-2xl font-bold text-zinc-900 tabular-nums">
                {stats.verifiedStudents}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Verified PEC Students
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 tabular-nums">
                {stats.activeListings}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Active Campus Listings
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 tabular-nums">
                {stats.completedExchanges}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Verified Exchanges Completed
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-teal-700 tabular-nums">
                {stats.qrScansVerified}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                PingME QR Scans Logged
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured & Recently Added Marketplace Listings */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl font-bold text-zinc-900 sm:text-3xl">
              Featured Campus Listings
            </h2>
            <p className="text-sm text-zinc-600 mt-1">
              Recently listed textbooks, electronics, cycles, and hostel gear
              from PEC students.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/explore">
              View All Listings
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-80 rounded-xl border border-zinc-200 bg-white animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Popular Categories */}
      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-zinc-900">
              Popular Campus Categories
            </h2>
            <p className="text-sm text-zinc-600 mt-1">
              Browse essentials tailored to every semester and hostel life at PEC.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.name}
                  to={`/explore?category=${encodeURIComponent(cat.name)}`}
                  className="group rounded-xl border border-zinc-200 bg-[#FAFAFA] p-5 transition-colors hover:border-teal-600 hover:bg-white"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700 mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-zinc-900 group-hover:text-teal-700">
                    {cat.name}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
                    {cat.detail}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* How PingME & QR Verification Work */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold text-zinc-900 sm:text-3xl">
              How PingME Works on Campus
            </h2>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
              Built around trust, short walking-distance handovers, and circular
              resource sharing across hostels and academic blocks.
            </p>

            <div className="mt-6 space-y-5">
              <div className="flex gap-4">
                <span className="font-mono text-sm font-bold text-teal-700 pt-0.5">
                  01.
                </span>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">
                    Verify with your PEC Student Identity
                  </h3>
                  <p className="text-sm text-zinc-600 mt-1">
                    Register using your PEC Student ID and institutional email so
                    every buyer and lender knows they are dealing with a fellow
                    student.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="font-mono text-sm font-bold text-teal-700 pt-0.5">
                  02.
                </span>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">
                    List for Sale, Rent, or Both
                  </h3>
                  <p className="text-sm text-zinc-600 mt-1">
                    Set daily, weekly, or monthly rental rates with refundable
                    security deposits, and get an auto-generated PingME Product QR.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="font-mono text-sm font-bold text-teal-700 pt-0.5">
                  03.
                </span>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">
                    Meet on Campus & Verify via One-Time QR
                  </h3>
                  <p className="text-sm text-zinc-600 mt-1">
                    Meet at PEC Library, LTC, or hostel stands. Scan the
                    cryptographic handover QR to record item collection and
                    return timestamps cleanly.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-teal-700 text-xs font-semibold">
                <QrCode className="h-4 w-4" />
                <span>Core Platform Technology</span>
              </div>
              <h3 className="mt-2 font-display text-xl font-bold text-zinc-900">
                Why Renting & PingME QR Matter
              </h3>
              <div className="mt-5 space-y-4 text-sm text-zinc-600">
                <div className="flex items-start gap-3">
                  <Repeat className="h-4 w-4 text-teal-700 mt-1 shrink-0" />
                  <p>
                    <strong className="text-zinc-900">Monetise idle gear:</strong>{' '}
                    Calculators, A2 drawing boards, and cycles sit unused most of
                    the semester. Renting them out lowers student costs by up to 80%.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 text-teal-700 mt-1 shrink-0" />
                  <p>
                    <strong className="text-zinc-900">Tamper-proof handovers:</strong>{' '}
                    Expiring single-use transaction QR tokens verify both buyer and
                    owner identities at pickup and return, preventing disputes.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="h-4 w-4 text-teal-700 mt-1 shrink-0" />
                  <p>
                    <strong className="text-zinc-900">Physical-to-digital stickers:</strong>{' '}
                    Print a PingME Product QR on a dorm study table or cycle so any
                    passerby can scan and check price and availability instantly.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7 pt-5 border-t border-zinc-100 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/scan">Open QR Scanner</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/login">Demo Accounts & Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-display text-base font-bold text-zinc-900">
              PingME – PEC Campus Marketplace
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Punjab Engineering College (Deemed to be University), Sector 12,
              Chandigarh · Support: pingme-support@pec.edu.in
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-zinc-600">
            <Link to="/explore" className="hover:text-zinc-900">
              Marketplace
            </Link>
            <Link to="/eateries" className="hover:text-zinc-900">
              Eateries
            </Link>
            <Link to="/scan" className="hover:text-zinc-900">
              Scan QR
            </Link>
            <Link to="/login" className="hover:text-zinc-900">
              Student Login
            </Link>
            <Link to="/register" className="hover:text-zinc-900">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
