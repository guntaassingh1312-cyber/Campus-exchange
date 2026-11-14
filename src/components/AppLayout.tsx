import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Bell,
  ClipboardList,
  Compass,
  Crown,
  Gift,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  PlusCircle,
  QrCode,
  Repeat,
  ShieldAlert,
  ShoppingBag,
  Store,
  Tag,
  User,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, type NotificationItem } from '../lib/api';
import { cn, formatDateTime } from '../lib/utils';

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const loadNotifications = async () => {
    try {
      const data = await apiFetch<{ notifications: NotificationItem[] }>(
        '/api/notifications'
      );
      setNotifications(data.notifications);
    } catch {
      // Ignore silent poll errors
    }
  };

  useEffect(() => {
    if (user) {
      void loadNotifications();
    }
  }, [user, location.pathname]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Ignore
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', to: '/app', icon: LayoutDashboard, exact: true },
    { label: 'Explore Marketplace', to: '/app/explore', icon: Compass },
    { label: 'Buy Products', to: '/app/buy', icon: ShoppingBag },
    { label: 'Rent Products', to: '/app/rent', icon: Repeat },
    { label: 'Eateries', to: '/app/eateries', icon: UtensilsCrossed },
    { label: 'My Food Orders', to: '/app/orders', icon: ClipboardList },
    { label: 'Sell an Item', to: '/app/sell', icon: PlusCircle },
    { label: 'Rent Out an Item', to: '/app/rent-out', icon: Tag },
    { label: 'My Listings', to: '/app/my-listings', icon: Package },
    { label: 'My Transactions', to: '/app/transactions', icon: ArrowLeftRight },
    { label: 'Premium Analytics', to: '/app/premium-analytics', icon: Crown },
    { label: 'Referrals & Rewards', to: '/app/referrals', icon: Gift },
    { label: 'My Wishlist', to: '/app/wishlist', icon: Heart },
    { label: 'PingME QR Centre', to: '/app/qr-centre', icon: QrCode },
    { label: 'Messages', to: '/app/messages', icon: MessageSquare },
    { label: 'My Profile', to: '/app/profile', icon: User },
  ];

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  const renderNavContent = () => (
    <div className="flex h-full flex-col justify-between py-5 px-3">
      <div>
        <div className="px-3 mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-zinc-900 whitespace-nowrap"
          >
            PingME
          </Link>
          <span className="font-mono text-[11px] text-zinc-400">PEC</span>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-teal-700' : 'text-zinc-400'
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}

          {(user?.role === 'shop_owner' || user?.role === 'admin') && (
            <Link
              to="/app/shop-dashboard"
              onClick={() => setMobileNavOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap mt-2 border-t border-zinc-100 pt-3',
                isActive('/app/shop-dashboard')
                  ? 'bg-teal-700 text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              )}
            >
              <Store className="h-4 w-4 shrink-0" />
              <span>Shop Dashboard</span>
            </Link>
          )}

          {user?.role === 'admin' && (
            <Link
              to="/app/admin"
              onClick={() => setMobileNavOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap mt-1',
                isActive('/app/admin')
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              )}
            >
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Admin Console</span>
            </Link>
          )}
        </nav>
      </div>

      <div className="border-t border-zinc-200 pt-4 px-2 space-y-3">
        {user && (
          <div className="px-2">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-zinc-900 truncate">
                {user.fullName}
              </p>
              {user.isPremium && (
                <Crown
                  aria-label="Premium Member"
                  className="h-3.5 w-3.5 text-amber-600 shrink-0"
                />
              )}
            </div>
            <p className="text-xs text-zinc-500 font-mono truncate">
              {user.studentId} ·{' '}
              <span
                className={
                  user.verificationStatus === 'verified'
                    ? 'text-teal-700'
                    : 'text-amber-700'
                }
              >
                {user.verificationStatus === 'verified'
                  ? 'Verified'
                  : 'Pending'}
              </span>
              {user.isPremium && (
                <span className="text-amber-700"> · Premium</span>
              )}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-red-700 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-zinc-200 bg-white sticky top-0 h-screen overflow-y-auto">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-zinc-950/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-68 max-w-[82vw] bg-white h-full border-r border-zinc-200 overflow-y-auto">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
            {renderNavContent()}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 border-b border-zinc-200 bg-white/95 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-zinc-500 truncate">
              PingME Campus Exchange · PEC Chandigarh
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/app/qr-centre"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap"
            >
              <QrCode className="h-3.5 w-3.5 text-teal-700" />
              Scan QR
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notifications"
                className="relative rounded-lg border border-zinc-200 bg-white p-2 text-zinc-600 hover:bg-zinc-50 cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-semibold text-white tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-zinc-200 bg-white shadow-xl z-40 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                    <span className="text-sm font-semibold text-zinc-900">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-xs font-medium text-teal-700 hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-zinc-500 text-center">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <Link
                          key={n.id}
                          to={n.linkUrl || '/app/transactions'}
                          onClick={() => setNotifOpen(false)}
                          className={cn(
                            'block px-4 py-3 hover:bg-zinc-50 transition-colors',
                            !n.isRead && 'bg-teal-50/40'
                          )}
                        >
                          <p className="text-xs font-semibold text-zinc-900">
                            {n.title}
                          </p>
                          <p className="text-xs text-zinc-600 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-[11px] text-zinc-400 mt-1 tabular-nums">
                            {formatDateTime(n.createdAt)}
                          </p>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
