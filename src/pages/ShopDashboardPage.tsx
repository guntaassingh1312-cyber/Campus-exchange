import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Flag,
  Plus,
  RefreshCw,
  ShieldAlert,
  Star,
  Store,
  Trash2,
  XCircle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';
import {
  apiFetch,
  type AccountRestrictionItem,
  type EateryOrder,
  type MenuItem,
  type ShopItem,
  type ShopReviewItem,
} from '../lib/api';
import { resolveImageUrl } from '../lib/demoImages';
import { formatDate, formatDateTime, formatINR } from '../lib/utils';

interface ShopDashboardResponse {
  shop: ShopItem;
  ownedShops: ShopItem[];
  menuItems: MenuItem[];
  orders: EateryOrder[];
  reviews: ShopReviewItem[];
  ratingDistribution: Record<number, number>;
  flaggedAccounts: AccountRestrictionItem[];
}

const MENU_CATEGORIES = ['Snacks', 'Meals', 'Beverages', 'Other items'] as const;
const DIETARY_LABELS = ['Veg', 'Vegan', 'Egg', 'Non-Veg', ''] as const;

export function ShopDashboardPage() {
  const { user } = useAuth();
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [data, setData] = useState<ShopDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Menu Item Dialog
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState<string>('Snacks');
  const [itemDietary, setItemDietary] = useState<string>('Veg');
  const [itemAvailable, setItemAvailable] = useState(true);
  const [savingItem, setSavingItem] = useState(false);

  // Reject Order Dialog
  const [rejectTarget, setRejectTarget] = useState<EateryOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [updatingOrder, setUpdatingOrder] = useState(false);

  // Flag Student Dialog
  const [flagTarget, setFlagTarget] = useState<EateryOrder | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagEvidence, setFlagEvidence] = useState('');
  const [submittingFlag, setSubmittingFlag] = useState(false);

  const loadDashboard = useCallback(async (shopIdOverride?: string) => {
    setLoading(true);
    try {
      const targetId = shopIdOverride ?? selectedShopId;
      const query = targetId ? `?shopId=${encodeURIComponent(targetId)}` : '';
      const res = await apiFetch<ShopDashboardResponse>(
        `/api/shop-dashboard${query}`
      );
      setData(res);
      if (!selectedShopId && res.shop) {
        setSelectedShopId(res.shop.id);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Unable to load shop dashboard.'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedShopId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const toggleShopActive = async () => {
    if (!data) return;
    try {
      await apiFetch('/api/shop-dashboard/shop', {
        method: 'PATCH',
        body: JSON.stringify({
          shopId: data.shop.id,
          isActive: !data.shop.isActive,
        }),
      });
      toast.success(
        data.shop.isActive
          ? `${data.shop.name} marked Closed.`
          : `${data.shop.name} is now Open for takeaway orders.`
      );
      await loadDashboard(data.shop.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Unable to update shop status.'
      );
    }
  };

  const openAddMenu = () => {
    setEditingItem(null);
    setItemName('');
    setItemDesc('');
    setItemPrice('');
    setItemCategory('Snacks');
    setItemDietary('Veg');
    setItemAvailable(true);
    setMenuModalOpen(true);
  };

  const openEditMenu = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemDesc(item.description);
    setItemPrice(String(item.price));
    setItemCategory(item.category);
    setItemDietary(item.dietaryLabel || 'Veg');
    setItemAvailable(item.isAvailable);
    setMenuModalOpen(true);
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSavingItem(true);
    try {
      const payload = {
        shopId: data.shop.id,
        name: itemName.trim(),
        description: itemDesc.trim(),
        price: Number(itemPrice),
        category: itemCategory,
        dietaryLabel: itemDietary,
        isAvailable: itemAvailable,
      };
      if (editingItem) {
        await apiFetch(`/api/shop-dashboard/menu/${editingItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success(`Updated "${itemName}".`);
      } else {
        await apiFetch('/api/shop-dashboard/menu', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(`Added "${itemName}" to menu.`);
      }
      setMenuModalOpen(false);
      await loadDashboard(data.shop.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Unable to save menu item.'
      );
    } finally {
      setSavingItem(false);
    }
  };

  const handleToggleItemAvailability = async (item: MenuItem) => {
    try {
      await apiFetch(`/api/shop-dashboard/menu/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      toast.success(
        `${item.name} marked ${!item.isAvailable ? 'Available' : 'Unavailable'}.`
      );
      await loadDashboard(data?.shop.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleDeleteMenuItem = async (item: MenuItem) => {
    try {
      await apiFetch(`/api/shop-dashboard/menu/${item.id}`, {
        method: 'DELETE',
      });
      toast.success(`Removed "${item.name}".`);
      await loadDashboard(data?.shop.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleAdvanceOrder = async (
    order: EateryOrder,
    nextStatus: 'Accepted' | 'Preparing' | 'Ready for Pickup' | 'Collected'
  ) => {
    try {
      await apiFetch(`/api/shop-dashboard/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      toast.success(`Order ${order.orderCode} updated to ${nextStatus}.`);
      await loadDashboard(data?.shop.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update order.'
      );
    }
  };

  const handleRejectOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    setUpdatingOrder(true);
    try {
      await apiFetch(`/api/shop-dashboard/orders/${rejectTarget.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'Rejected',
          cancellationReason: rejectReason.trim(),
        }),
      });
      toast.success(`Order ${rejectTarget.orderCode} rejected.`);
      setRejectTarget(null);
      setRejectReason('');
      await loadDashboard(data?.shop.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to reject order.'
      );
    } finally {
      setUpdatingOrder(false);
    }
  };

  const openFlagModal = (order: EateryOrder) => {
    setFlagTarget(order);
    setFlagReason('');
    setFlagEvidence(
      order.studentReliability?.incidentCodes.join(', ') || order.orderCode
    );
  };

  const handleFlagStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagTarget || !data) return;
    setSubmittingFlag(true);
    try {
      await apiFetch('/api/shop-dashboard/restrictions/flag', {
        method: 'POST',
        body: JSON.stringify({
          shopId: data.shop.id,
          studentId: flagTarget.studentId,
          reason: flagReason.trim(),
          evidenceReference: flagEvidence.trim(),
        }),
      });
      toast.success(
        'Account flagged and sent to PEC Campus Admin for review.'
      );
      setFlagTarget(null);
      await loadDashboard(data.shop.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Unable to flag student account.'
      );
    } finally {
      setSubmittingFlag(false);
    }
  };

  if (loading && !data) {
    return (
      <p className="text-sm text-zinc-500">Loading Shop Owner Dashboard...</p>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        Unable to load Shop Dashboard. Ensure you are signed in with an
        authorized campus shop owner account.
      </div>
    );
  }

  const incomingOrders = data.orders.filter((o) =>
    ['Pending', 'Accepted', 'Preparing', 'Ready for Pickup'].includes(o.status)
  );
  const historyOrders = data.orders.filter((o) =>
    ['Collected', 'Rejected', 'Cancelled'].includes(o.status)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
            <Store className="h-4 w-4" />
            <span>Authorized Shop Management Portal</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-zinc-900">
            {data.shop.name}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {data.shop.location} · {data.shop.openingHours} · Prep:{' '}
            {data.shop.prepTime}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {user?.role === 'admin' && data.ownedShops.length > 1 && (
            <select
              value={data.shop.id}
              onChange={(e) => {
                setSelectedShopId(e.target.value);
                void loadDashboard(e.target.value);
              }}
              aria-label="Switch managed shop"
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800"
            >
              {data.ownedShops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadDashboard(data.shop.id)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>

          <Button
            type="button"
            size="sm"
            variant={data.shop.isActive ? 'outline' : 'default'}
            onClick={toggleShopActive}
          >
            {data.shop.isActive ? 'Shop Open · Pause Orders' : 'Shop Closed · Reopen'}
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Active Incoming Orders</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 tabular-nums">
            {incomingOrders.length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Menu Items</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 tabular-nums">
            {data.menuItems.filter((m) => m.isAvailable).length}/
            {data.menuItems.length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Average Shop Rating</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 tabular-nums flex items-center gap-1.5">
            {data.shop.reviewCount > 0 ? data.shop.averageRating.toFixed(1) : '—'}
            <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-500">Verified Reviews</p>
          <p className="mt-1 text-2xl font-bold text-teal-700 tabular-nums">
            {data.shop.reviewCount}
          </p>
        </div>
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="orders">
            Incoming Orders ({incomingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="menu">
            Menu Items ({data.menuItems.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Order History ({historyOrders.length})
          </TabsTrigger>
          <TabsTrigger value="reliability">
            Ratings &amp; Flagged Accounts ({data.flaggedAccounts.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Incoming Orders */}
        <TabsContent value="orders" className="space-y-4">
          {incomingOrders.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
              No pending or active takeaway orders right now.
            </div>
          ) : (
            incomingOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-zinc-900">
                        {order.orderCode}
                      </span>
                      <span className="text-xs font-semibold text-teal-700">
                        · {order.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-700">
                      Customer:{' '}
                      <strong>{order.student?.fullName || 'PEC Student'}</strong>{' '}
                      <span className="font-mono text-zinc-500">
                        ({order.student?.maskedStudentId})
                      </span>{' '}
                      · Ordered {formatDateTime(order.createdAt)}
                    </p>
                    {order.studentReliability && (
                      <p className="mt-1 text-[11px] text-zinc-500 tabular-nums">
                        Shop Reliability: {order.studentReliability.collectedCount}{' '}
                        collected · {order.studentReliability.incidentCount}{' '}
                        cancelled/rejected
                      </p>
                    )}
                  </div>

                  <p className="font-mono text-lg font-bold text-zinc-900 tabular-nums">
                    {formatINR(order.totalAmount)}
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-100 bg-[#FAFAFA] p-3 space-y-1 text-xs">
                  {order.items.map((line) => (
                    <div
                      key={`${order.id}-${line.menuItemId}`}
                      className="flex items-center justify-between text-zinc-700"
                    >
                      <span>
                        <strong>{line.quantity}×</strong> {line.name}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatINR(line.subtotal)}
                      </span>
                    </div>
                  ))}
                  {order.notes && (
                    <p className="pt-1.5 text-[11px] text-amber-800 font-medium">
                      Student Note: {order.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap gap-2">
                    {order.status === 'Pending' && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAdvanceOrder(order, 'Accepted')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Accept Order
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setRejectTarget(order);
                            setRejectReason('');
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject Order
                        </Button>
                      </>
                    )}
                    {order.status === 'Accepted' && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAdvanceOrder(order, 'Preparing')}
                        >
                          Mark Preparing
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setRejectTarget(order);
                            setRejectReason('');
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {order.status === 'Preparing' && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          handleAdvanceOrder(order, 'Ready for Pickup')
                        }
                      >
                        Mark Ready for Pickup
                      </Button>
                    )}
                    {order.status === 'Ready for Pickup' && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleAdvanceOrder(order, 'Collected')}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark Collected
                      </Button>
                    )}
                  </div>

                  {order.studentReliability &&
                    order.studentReliability.incidentCount >= 2 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-amber-700 hover:bg-amber-50"
                        onClick={() => openFlagModal(order)}
                      >
                        <Flag className="h-3.5 w-3.5" />
                        Flag Student ({order.studentReliability.incidentCount} incidents)
                      </Button>
                    )}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* TAB 2: Menu Management */}
        <TabsContent value="menu" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-600">
              Add items, edit INR prices, or pause availability when items sell out.
            </p>
            <Button type="button" size="sm" onClick={openAddMenu}>
              <Plus className="h-4 w-4" />
              Add Menu Item
            </Button>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Diet</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Availability</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.menuItems.map((item) => {
                  const img = resolveImageUrl(item.imageUrl);
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {img && (
                            <img
                              src={img}
                              alt={item.name}
                              className="h-10 w-10 rounded-md object-cover border border-zinc-100 shrink-0"
                            />
                          )}
                          <div>
                            <p className="font-semibold text-zinc-900">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-zinc-500 line-clamp-1 max-w-xs">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{item.category}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {item.dietaryLabel || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-900 tabular-nums">
                        {formatINR(item.price)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleItemAvailability(item)}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                            item.isAvailable
                              ? 'border-teal-200 bg-teal-50 text-teal-800'
                              : 'border-red-200 bg-red-50 text-red-700'
                          }`}
                        >
                          {item.isAvailable ? 'Available' : 'Unavailable'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditMenu(item)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteMenuItem(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 3: Order History */}
        <TabsContent value="history">
          <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order ID</th>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Items</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Status &amp; Notes</th>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">Reliability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {historyOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-zinc-500"
                    >
                      No completed, rejected, or cancelled orders yet.
                    </td>
                  </tr>
                ) : (
                  historyOrders.map((ord) => (
                    <tr key={ord.id}>
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-900">
                        {ord.orderCode}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">
                          {ord.student?.fullName || 'Student'}
                        </p>
                        <p className="font-mono text-[11px] text-zinc-500">
                          {ord.student?.maskedStudentId}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 max-w-xs">
                        {ord.items
                          .map((i) => `${i.quantity}× ${i.name}`)
                          .join(', ')}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold tabular-nums">
                        {formatINR(ord.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${
                            ord.status === 'Collected'
                              ? 'text-teal-700'
                              : 'text-red-600'
                          }`}
                        >
                          {ord.status}
                        </span>
                        {ord.cancellationReason && (
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            {ord.cancellationReason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 tabular-nums whitespace-nowrap">
                        {formatDateTime(ord.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {ord.studentReliability &&
                        ord.studentReliability.incidentCount >= 2 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-amber-700 border-amber-200"
                            onClick={() => openFlagModal(ord)}
                          >
                            <Flag className="h-3 w-3" />
                            Flag ({ord.studentReliability.incidentCount})
                          </Button>
                        ) : (
                          <span className="text-[11px] text-zinc-400">
                            {ord.studentReliability?.incidentCount || 0}{' '}
                            incidents
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 4: Ratings, Reviews & Private Flagged Accounts */}
        <TabsContent value="reliability" className="space-y-6">
          {/* Private Restricted Orders / Flagged Accounts Section */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-zinc-900 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-700" />
                  Private Restricted Orders / Flagged Accounts
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Visible only to authorized shop owners and PEC Campus Admins.
                  At least 2 documented cancelled or uncollected orders are
                  required before flagging; Campus Admin approval is mandatory
                  before any ordering restriction takes effect.
                </p>
              </div>
            </div>

            {data.flaggedAccounts.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">
                No student accounts have been flagged by {data.shop.name}.
              </p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {data.flaggedAccounts.map((flag) => (
                  <div
                    key={flag.id}
                    className="py-3.5 flex flex-wrap items-start justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900">
                          {flag.student?.fullName || 'Student'}
                        </span>
                        <span className="font-mono text-zinc-500">
                          {flag.student?.maskedStudentId}
                        </span>
                        <span
                          className={`font-semibold capitalize ${
                            flag.restrictionStatus === 'active'
                              ? 'text-red-600'
                              : flag.restrictionStatus === 'pending_review'
                                ? 'text-amber-700'
                                : 'text-zinc-500'
                          }`}
                        >
                          · {flag.restrictionStatus.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-zinc-700">{flag.reason}</p>
                      <p className="font-mono text-[11px] text-zinc-500">
                        Evidence: {flag.evidenceReference} · Flagged{' '}
                        {formatDateTime(flag.createdAt)}
                        {flag.expiresAt &&
                          ` · Expires ${formatDate(flag.expiresAt)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shop Ratings & Verified Reviews */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-zinc-900">
                  Verified Student Reviews ({data.reviews.length})
                </h2>
                <p className="text-xs text-zinc-500">
                  Average Rating:{' '}
                  <strong className="text-zinc-900 tabular-nums">
                    {data.shop.reviewCount > 0
                      ? `${data.shop.averageRating.toFixed(1)} / 5`
                      : 'No reviews yet'}
                  </strong>
                </p>
              </div>
            </div>

            {data.reviews.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">
                No verified reviews received yet.
              </p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {data.reviews.map((rev) => (
                  <div key={rev.id} className="py-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900">
                        {rev.student?.fullName || 'PEC Student'} (
                        {rev.student?.maskedStudentId})
                      </span>
                      <span className="text-zinc-400 tabular-nums">
                        {formatDateTime(rev.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
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
                      <p className="text-zinc-600">{rev.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Menu Item Dialog */}
      <Dialog open={menuModalOpen} onOpenChange={setMenuModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveMenuItem} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Item Name
              </label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Grilled Cheese Sandwich"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Description
              </label>
              <textarea
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                rows={2}
                required
                placeholder="Ingredients, portion size, or serving note"
                className="w-full rounded-lg border border-zinc-200 p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Price (INR)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={5000}
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Category
                </label>
                <select
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs"
                >
                  {MENU_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Dietary Label
                </label>
                <select
                  value={itemDietary}
                  onChange={(e) => setItemDietary(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs"
                >
                  {DIETARY_LABELS.map((d) => (
                    <option key={d || 'none'} value={d}>
                      {d || 'None'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={itemAvailable}
                onChange={(e) => setItemAvailable(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-teal-600"
              />
              Currently available for ordering
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMenuModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingItem}>
                {savingItem
                  ? 'Saving...'
                  : editingItem
                    ? 'Save Changes'
                    : 'Add Item'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject Order Modal */}
      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Order {rejectTarget?.orderCode}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRejectOrder} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Rejection Reason (shown to student)
              </label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Ingredient sold out / closing soon"
                required
                minLength={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updatingOrder}
                className="bg-red-600 hover:bg-red-700"
              >
                {updatingOrder ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Flag Student Account Modal */}
      <Dialog
        open={Boolean(flagTarget)}
        onOpenChange={(open) => {
          if (!open) setFlagTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Flag Student Account for Admin Review
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFlagStudent} className="space-y-4">
            <p className="text-xs text-zinc-600 leading-relaxed">
              Submitting this flag sends a private review request to Campus
              Admins. No automated ban is applied without admin verification.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Documented Order Evidence
              </label>
              <Input
                value={flagEvidence}
                onChange={(e) => setFlagEvidence(e.target.value)}
                required
                minLength={3}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Reason for Flagging
              </label>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                rows={3}
                required
                minLength={10}
                placeholder="Describe repeated unjustified cancellations or uncollected confirmed orders..."
                className="w-full rounded-lg border border-zinc-200 p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFlagTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submittingFlag}>
                {submittingFlag ? 'Submitting Flag...' : 'Submit for Admin Review'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
