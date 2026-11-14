import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BarChart3,
  CheckCircle2,
  Crown,
  Headphones,
  MessageSquare,
  Send,
  TrendingUp,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  PaymentCheckoutModal,
  type CheckoutTarget,
} from '../components/PaymentCheckoutModal';
import { useAuth } from '../context/AuthContext';
import {
  apiFetch,
  type PaymentTransactionItem,
  type PremiumAnalyticsResponse,
  type PremiumStatusResponse,
  type SupportTicketItem,
} from '../lib/api';
import { formatDate, formatINR } from '../lib/utils';

export function PremiumAnalyticsPage() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<PremiumStatusResponse | null>(null);
  const [analytics, setAnalytics] = useState<PremiumAnalyticsResponse | null>(null);
  const [payments, setPayments] = useState<PaymentTransactionItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [chartMetric, setChartMetric] = useState<'views' | 'revenue'>('views');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Priority support form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendingTicket, setSendingTicket] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [premRes, payRes, ticketRes] = await Promise.all([
        apiFetch<PremiumStatusResponse>('/api/premium/status'),
        apiFetch<{ payments: PaymentTransactionItem[] }>(
          '/api/payments/history?limit=6'
        ),
        apiFetch<{ tickets: SupportTicketItem[] }>('/api/support/tickets'),
      ]);
      setStatus(premRes);
      setPayments(payRes.payments);
      setTickets(ticketRes.tickets);

      if (premRes.isPremium || user?.role === 'admin') {
        const analRes = await apiFetch<PremiumAnalyticsResponse>(
          `/api/analytics/premium?range=${range}`
        );
        setAnalytics(analRes);
      } else {
        setAnalytics(null);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Unable to load Premium Analytics.'
      );
    } finally {
      setLoading(false);
    }
  }, [range, user?.role]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openUpgradeCheckout = () => {
    const price = status?.plan.price ?? 199;
    const days = status?.plan.durationDays ?? 30;
    setCheckoutTarget({
      purpose: 'premium_membership',
      title: 'PingME Premium Seller Membership',
      subtitle: `${days}-day campus seller analytics & priority support subscription`,
      amount: price,
      benefits: [
        'Full Seller Analytics Dashboard (views, unique visitors & conversion %)',
        'Product-wise performance comparison & interactive historical charts',
        'Priority Campus Support queue & verified Premium profile indicator',
      ],
    });
    setCheckoutOpen(true);
  };

  const submitPriorityTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSendingTicket(true);
    try {
      await apiFetch('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      toast.success('Priority support ticket submitted to PEC moderators.');
      setSubject('');
      setMessage('');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit ticket.');
    } finally {
      setSendingTicket(false);
    }
  };

  if (loading && !status) {
    return (
      <p className="text-sm text-zinc-500">
        Loading Premium Membership &amp; Seller Analytics...
      </p>
    );
  }

  const isActive = Boolean(status?.isPremium || user?.role === 'admin');

  if (!isActive) {
    const planPrice = status?.plan.price ?? 199;
    const planDays = status?.plan.durationDays ?? 30;

    return (
      <div className="space-y-8 max-w-4xl">
        <div>
          <p className="text-xs font-medium text-teal-700">
            PingME Seller Pro · PEC Chandigarh
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-zinc-900">
            Premium Membership &amp; Seller Analytics
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Track listing views, unique campus visitors, enquiry conversion rates,
            and revenue trends across every item you sell or rent.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-800">
              <Crown className="h-4 w-4 text-amber-600" />
              For Active PEC Student Sellers &amp; Lenders
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold text-zinc-900 tabular-nums">
                {formatINR(planPrice)}
              </span>
              <span className="text-sm text-zinc-500">
                / {planDays} days
              </span>
            </div>

            <ul className="space-y-2.5 text-sm text-zinc-700">
              {[
                'Advanced Seller Analytics Dashboard with real-time conversion tracking',
                'Product-specific total views vs. unique PEC visitor counts',
                'Interactive daily, weekly & monthly sales and engagement charts',
                'Product-wise revenue & enquiry comparison table',
                'Priority campus support queue & Premium badge on your profile',
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="pt-2 flex flex-wrap gap-3">
              <Button size="lg" onClick={openUpgradeCheckout}>
                <Crown className="h-4 w-4" />
                Upgrade to Premium ({formatINR(planPrice)})
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/app/my-listings">Boost Individual Listing (from ₹20)</Link>
              </Button>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-zinc-200 bg-[#FAFAFA] p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              What Unlocks Immediately
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <p className="text-zinc-500">Visitor Tracking</p>
                <p className="mt-1 font-semibold text-zinc-900">
                  Views vs. Uniques
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <p className="text-zinc-500">Funnel Ratio</p>
                <p className="mt-1 font-semibold text-zinc-900">
                  Conversion Rate %
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <p className="text-zinc-500">Time Horizon</p>
                <p className="mt-1 font-semibold text-zinc-900">
                  Daily / Wk / Mo
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                <p className="text-zinc-500">Helpdesk</p>
                <p className="mt-1 font-semibold text-zinc-900">
                  Priority Support
                </p>
              </div>
            </div>
          </div>
        </div>

        <PaymentCheckoutModal
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          target={checkoutTarget}
          onSuccess={async () => {
            await refreshUser();
            await loadData();
          }}
        />
      </div>
    );
  }

  const series = analytics?.trendSeries || [];
  const maxVal = Math.max(
    1,
    ...series.map((d) => (chartMetric === 'views' ? d.views : d.revenue))
  );
  const maxSecondary = Math.max(
    1,
    ...series.map((d) => (chartMetric === 'views' ? d.uniqueVisitors : d.sales))
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800">
            <Crown className="h-4 w-4 text-amber-600" />
            <span>PingME Premium Seller Active</span>
            {status?.activeSubscription?.expiryDate && (
              <span className="text-zinc-500 font-normal tabular-nums">
                · Valid until {formatDate(status.activeSubscription.expiryDate)}
              </span>
            )}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-zinc-900">
            Seller Analytics Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={openUpgradeCheckout}>
            Extend Membership ({formatINR(status?.plan.price ?? 199)})
          </Button>
          <Button asChild size="sm">
            <Link to="/app/my-listings">Manage &amp; Boost Listings</Link>
          </Button>
        </div>
      </div>

      {/* 6 Core Analytics KPI Cards */}
      {analytics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: 'Total Listing Views',
                value: analytics.summary.totalListingViews,
                sub: `${analytics.summary.activeListingsCount} active items`,
              },
              {
                label: 'Unique Visitors',
                value: analytics.summary.uniqueVisitors,
                sub: 'Distinct PEC browsers',
              },
              {
                label: 'Total Enquiries',
                value: analytics.summary.totalEnquiries,
                sub: 'Buyer threads',
              },
              {
                label: 'Completed Sales',
                value: analytics.summary.completedSales,
                sub: `of ${analytics.summary.totalOrders} orders`,
              },
              {
                label: 'Conversion Rate',
                value: `${analytics.summary.conversionRate}%`,
                sub: 'Sales per view',
              },
              {
                label: 'Revenue Generated',
                value: formatINR(analytics.summary.revenueGenerated),
                sub: `${analytics.summary.activeBoostsCount} active boosts`,
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-zinc-200 bg-white p-4"
              >
                <p className="text-xs text-zinc-500">{kpi.label}</p>
                <p className="mt-1 text-xl font-bold text-zinc-900 tabular-nums">
                  {kpi.value}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-400 tabular-nums">
                  {kpi.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Best Performing Product + Interactive Trend Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Interactive Trend Chart */}
            <div className="lg:col-span-8 rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-zinc-900 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-teal-700" />
                    Historical Engagement &amp; Sales Trends
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Hover any period to inspect views, unique visitors, enquiries, and revenue.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs">
                    {(['views', 'revenue'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setChartMetric(m)}
                        className={`rounded-md px-2.5 py-1 font-medium cursor-pointer transition-colors ${
                          chartMetric === m
                            ? 'bg-white text-zinc-900 shadow-xs'
                            : 'text-zinc-500 hover:text-zinc-900'
                        }`}
                      >
                        {m === 'views' ? 'Views & Visitors' : 'Revenue & Sales'}
                      </button>
                    ))}
                  </div>

                  <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs">
                    {(['daily', 'weekly', 'monthly'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRange(r)}
                        className={`rounded-md px-2.5 py-1 font-medium capitalize cursor-pointer transition-colors ${
                          range === r
                            ? 'bg-teal-700 text-white'
                            : 'text-zinc-500 hover:text-zinc-900'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interactive Bar Chart */}
              <div className="pt-2">
                <div className="h-52 flex items-end gap-1.5 sm:gap-2 border-b border-zinc-200 pb-2">
                  {series.map((pt, idx) => {
                    const primary =
                      chartMetric === 'views' ? pt.views : pt.revenue;
                    const secondary =
                      chartMetric === 'views' ? pt.uniqueVisitors : pt.sales;
                    const primaryPct = Math.max(4, Math.round((primary / maxVal) * 100));
                    const secondaryPct = Math.max(
                      secondary > 0 ? 6 : 0,
                      Math.round((secondary / maxSecondary) * 80)
                    );
                    const isHovered = hoverIdx === idx;

                    return (
                      <div
                        key={pt.label}
                        onMouseEnter={() => setHoverIdx(idx)}
                        onMouseLeave={() => setHoverIdx(null)}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative"
                      >
                        <div className="w-full flex items-end justify-center gap-0.5 h-full">
                          <div
                            style={{ height: `${primaryPct}%` }}
                            className={`w-full max-w-[18px] rounded-t transition-colors ${
                              isHovered ? 'bg-teal-800' : 'bg-teal-600'
                            }`}
                          />
                          <div
                            style={{ height: `${secondaryPct}%` }}
                            className={`w-full max-w-[10px] rounded-t transition-colors ${
                              isHovered ? 'bg-amber-600' : 'bg-amber-400'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between gap-1 pt-1.5 text-[10px] text-zinc-500 tabular-nums overflow-x-auto">
                  {series.map((pt) => (
                    <span key={pt.label} className="flex-1 text-center truncate">
                      {pt.label}
                    </span>
                  ))}
                </div>

                {/* Live Hover / Legend Bar */}
                <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                  {hoverIdx !== null && series[hoverIdx] ? (
                    <div className="flex flex-wrap items-center gap-4 text-zinc-700">
                      <span className="font-semibold text-zinc-900">
                        {series[hoverIdx].label}
                      </span>
                      <span>Views: {series[hoverIdx].views}</span>
                      <span>Unique Visitors: {series[hoverIdx].uniqueVisitors}</span>
                      <span>Enquiries: {series[hoverIdx].enquiries}</span>
                      <span>Sales: {series[hoverIdx].sales}</span>
                      <span className="font-semibold text-teal-800">
                        Revenue: {formatINR(series[hoverIdx].revenue)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-zinc-500">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-xs bg-teal-600" />
                        {chartMetric === 'views' ? 'Total Views' : 'Revenue (₹)'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-xs bg-amber-400" />
                        {chartMetric === 'views'
                          ? 'Unique Visitors'
                          : 'Completed Sales'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Best Performing Product Card */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
                  <Award className="h-4 w-4 text-amber-600" />
                  Best-Performing Listing
                </div>
                {analytics.bestPerformingProduct ? (
                  <>
                    <Link
                      to={`/app/product/${analytics.bestPerformingProduct.productCode}`}
                      className="block font-display text-base font-bold text-zinc-900 hover:text-teal-700"
                    >
                      {analytics.bestPerformingProduct.title}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {analytics.bestPerformingProduct.category} ·{' '}
                      <span className="font-mono">
                        {analytics.bestPerformingProduct.productCode}
                      </span>
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs tabular-nums">
                      <div>
                        <p className="text-zinc-500">Revenue</p>
                        <p className="font-semibold text-zinc-900">
                          {formatINR(analytics.bestPerformingProduct.revenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Sales / Views</p>
                        <p className="font-semibold text-zinc-900">
                          {analytics.bestPerformingProduct.completedSales} /{' '}
                          {analytics.bestPerformingProduct.views}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Unique Visitors</p>
                        <p className="font-semibold text-zinc-900">
                          {analytics.bestPerformingProduct.uniqueVisitors}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Conversion</p>
                        <p className="font-semibold text-teal-700">
                          {analytics.bestPerformingProduct.conversionRate}%
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Publish a listing to begin tracking product performance.
                  </p>
                )}
              </div>

              {/* Quick Insights */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-2.5 text-xs">
                <p className="font-semibold text-zinc-900 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-teal-700" />
                  Engagement Highlights
                </p>
                <div className="flex justify-between text-zinc-600 tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-zinc-400" />
                    Unique Reach Ratio
                  </span>
                  <span className="font-semibold text-zinc-900">
                    {analytics.summary.totalListingViews > 0
                      ? `${Math.min(
                          100,
                          Math.round(
                            (analytics.summary.uniqueVisitors /
                              analytics.summary.totalListingViews) *
                              100
                          )
                        )}%`
                      : '0%'}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600 tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
                    Enquiry-to-Sale Rate
                  </span>
                  <span className="font-semibold text-zinc-900">
                    {analytics.summary.totalEnquiries > 0
                      ? `${Math.min(
                          100,
                          Math.round(
                            (analytics.summary.completedSales /
                              analytics.summary.totalEnquiries) *
                              100
                          )
                        )}%`
                      : '0%'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Product-Wise Performance Table */}
          <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-zinc-900">
                  Product-Wise Performance Comparison
                </h2>
                <p className="text-xs text-zinc-500">
                  Side-by-side funnel metrics for all your campus listings.
                </p>
              </div>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Listing</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Views</th>
                  <th className="px-4 py-3 font-semibold text-right">Unique</th>
                  <th className="px-4 py-3 font-semibold text-right">Enquiries</th>
                  <th className="px-4 py-3 font-semibold text-right">Sales</th>
                  <th className="px-4 py-3 font-semibold text-right">Conv %</th>
                  <th className="px-4 py-3 font-semibold text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums">
                {analytics.productBreakdown.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-zinc-500"
                    >
                      No listings posted yet.
                    </td>
                  </tr>
                ) : (
                  analytics.productBreakdown.map((item) => (
                    <tr key={item.productId} className="hover:bg-zinc-50/70">
                      <td className="px-4 py-3">
                        <Link
                          to={`/app/product/${item.productCode}`}
                          className="font-semibold text-zinc-900 hover:text-teal-700"
                        >
                          {item.title}
                        </Link>
                        <p className="text-[11px] text-zinc-500 font-mono">
                          {item.productCode}
                          {item.isBoosted ? ' · Boosted' : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {item.availabilityStatus}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {item.views}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {item.uniqueVisitors}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {item.enquiries}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {item.completedSales}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-teal-700 font-semibold">
                        {item.conversionRate}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-900">
                        {formatINR(item.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Priority Customer Support & Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={submitPriorityTicket}
          className="lg:col-span-6 rounded-xl border border-zinc-200 bg-white p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-zinc-900 flex items-center gap-2">
              <Headphones className="h-4 w-4 text-teal-700" />
              Priority Campus Support
            </h2>
            <span className="text-[11px] font-semibold text-teal-700">
              Premium Priority Queue
            </span>
          </div>

          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (e.g. Rental dispute assistance or boost query)"
            required
          />
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe how PEC PingME support can help..."
            required
            className="w-full rounded-lg border border-zinc-200 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {tickets.length} ticket{tickets.length === 1 ? '' : 's'} submitted
            </span>
            <Button type="submit" size="sm" disabled={sendingTicket}>
              <Send className="h-3.5 w-3.5" />
              {sendingTicket ? 'Submitting...' : 'Send Priority Ticket'}
            </Button>
          </div>
        </form>

        <div className="lg:col-span-6 rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-zinc-900">
            Recent Billing &amp; Boost Receipts
          </h2>
          {payments.length === 0 ? (
            <p className="text-xs text-zinc-500 py-4">No payments recorded yet.</p>
          ) : (
            <div className="divide-y divide-zinc-100 text-xs tabular-nums">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-zinc-900">
                      {p.purpose === 'premium_membership'
                        ? 'Premium Membership'
                        : 'Listing Visibility Boost'}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      {p.paymentMethod.toUpperCase()} · {p.gateway.toUpperCase()} ·{' '}
                      {formatDate(p.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-zinc-900">
                      {formatINR(p.amount)}
                    </p>
                    <p
                      className={`text-[11px] font-semibold capitalize ${
                        p.status === 'succeeded'
                          ? 'text-teal-700'
                          : p.status === 'failed'
                            ? 'text-red-600'
                            : 'text-amber-700'
                      }`}
                    >
                      {p.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PaymentCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        target={checkoutTarget}
        onSuccess={async () => {
          await refreshUser();
          await loadData();
        }}
      />
    </div>
  );
}
