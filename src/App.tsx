import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { DashboardHomePage } from './pages/DashboardHomePage';
import { CreateListingPage } from './pages/CreateListingPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { QrCentrePage } from './pages/QrCentrePage';
import { TransactionsPage } from './pages/TransactionsPage';
import { MyListingsPage } from './pages/MyListingsPage';
import { WishlistPage } from './pages/WishlistPage';
import { MessagesPage } from './pages/MessagesPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { EateriesPage } from './pages/EateriesPage';
import { ShopMenuPage } from './pages/ShopMenuPage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { ShopDashboardPage } from './pages/ShopDashboardPage';
import { PremiumAnalyticsPage } from './pages/PremiumAnalyticsPage';
import { ReferralsPage } from './pages/ReferralsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] text-sm text-zinc-500">
        Loading PingME session...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function ShopOwnerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'shop_owner' && user.role !== 'admin') {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/explore" element={<MarketplacePage isPublic />} />
          <Route path="/eateries" element={<EateriesPage isPublic />} />
          <Route path="/eateries/:shopId" element={<ShopMenuPage isPublic />} />
          <Route path="/p/:idOrCode" element={<ProductDetailsPage isPublic />} />
          <Route path="/scan" element={<QrCentrePage isPublicScan />} />

          {/* Authenticated Student Dashboard Routes */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHomePage />} />
            <Route path="explore" element={<MarketplacePage />} />
            <Route path="eateries" element={<EateriesPage />} />
            <Route path="eateries/:shopId" element={<ShopMenuPage />} />
            <Route path="orders" element={<MyOrdersPage />} />
            <Route
              path="shop-dashboard"
              element={
                <ShopOwnerRoute>
                  <ShopDashboardPage />
                </ShopOwnerRoute>
              }
            />
            <Route
              path="buy"
              element={
                <MarketplacePage
                  defaultType="sell"
                  pageTitle="Buy Campus Essentials"
                />
              }
            />
            <Route
              path="rent"
              element={
                <MarketplacePage
                  defaultType="rent"
                  pageTitle="Rent Campus Gear"
                />
              }
            />
            <Route path="sell" element={<CreateListingPage defaultMode="sell" />} />
            <Route
              path="rent-out"
              element={<CreateListingPage defaultMode="rent" />}
            />
            <Route path="edit-listing/:id" element={<CreateListingPage />} />
            <Route path="product/:idOrCode" element={<ProductDetailsPage />} />
            <Route path="my-listings" element={<MyListingsPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="premium-analytics" element={<PremiumAnalyticsPage />} />
            <Route path="referrals" element={<ReferralsPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="qr-centre" element={<QrCentrePage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <AdminDashboardPage />
                </AdminRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
