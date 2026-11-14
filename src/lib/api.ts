export interface UserProfile {
  id: string;
  studentId: string;
  maskedStudentId: string;
  fullName: string;
  institutionalEmail: string;
  department: string;
  academicYear: string;
  role: 'student' | 'admin' | 'shop_owner' | string;
  verificationStatus: 'verified' | 'pending' | 'rejected' | string;
  avatarUrl: string | null;
  hostelBlock: string | null;
  bio: string | null;
  referralCode: string;
  isPremium: boolean;
  referralSuspended?: boolean;
  boostSuspended?: boolean;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  maskedStudentId: string;
  fullName: string;
  department: string;
  academicYear: string;
  verificationStatus: string;
  avatarUrl: string | null;
  hostelBlock: string | null;
  bio: string | null;
  isPremium?: boolean;
  rating?: number;
  reviewCount?: number;
}

export interface ActiveListingPromotion {
  id: string;
  packageType: 'basic' | 'standard' | 'premium' | string;
  amount: number;
  startTime: string | null;
  expiryTime: string | null;
  promotionStatus: string;
}

export interface Product {
  id: string;
  productCode: string;
  sellerId: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  condition: 'New' | 'Like New' | 'Good' | 'Fair';
  listingType: 'sell' | 'rent' | 'both';
  sellingPrice: number | null;
  negotiable: boolean;
  rentalPriceDaily: number | null;
  rentalPriceWeekly: number | null;
  rentalPriceMonthly: number | null;
  securityDeposit: number;
  minRentalDays: number;
  maxRentalDays: number;
  pickupLocation: string;
  hostelOrDept: string;
  availabilityStatus: 'Available' | 'Currently Rented' | 'Sold' | 'Inactive';
  viewCount: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  images: string[];
  seller: PublicUser | null;
  qrPayload: string;
  isBoosted?: boolean;
  activePromotion?: ActiveListingPromotion | null;
}

export interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  subcategories: string[];
  isActive: boolean;
}

export interface TransactionItem {
  id: string;
  transactionCode: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  transactionType: 'buy' | 'rent' | 'offer';
  bookingStart: string | null;
  bookingEnd: string | null;
  totalAmount: number;
  depositAmount: number;
  offerAmount: number | null;
  notes: string | null;
  transactionStatus: string;
  collectedAt: string | null;
  returnedAt: string | null;
  createdAt: string;
  updatedAt: string;
  product: (Product & { imageUrl?: string | null }) | null;
  buyer: PublicUser | null;
  seller: PublicUser | null;
  activeQrToken?: {
    rawCode: string;
    tokenType: string;
    expiresAt: string;
  } | null;
  alreadyReviewed?: boolean;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  notificationType: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface MessageItem {
  id: string;
  senderId: string;
  receiverId: string;
  productId: string | null;
  messageText: string;
  isRead: boolean;
  createdAt: string;
  sender: PublicUser | null;
  receiver: PublicUser | null;
  product: { id: string; title: string; productCode: string } | null;
}

export interface ShopItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  location: string;
  imageUrl: string;
  openingHours: string;
  prepTime: string;
  paymentProcessNote: string;
  isActive: boolean;
  ownerId: string;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  menuCount?: number;
  availableItemCount?: number;
}

export interface MenuItem {
  id: string;
  shopId: string;
  name: string;
  description: string;
  price: number;
  category: 'Snacks' | 'Meals' | 'Beverages' | 'Other items' | string;
  imageUrl: string;
  isAvailable: boolean;
  dietaryLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderSnapshotItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  dietaryLabel?: string;
}

export type OrderStatus =
  | 'Pending'
  | 'Accepted'
  | 'Preparing'
  | 'Ready for Pickup'
  | 'Collected'
  | 'Rejected'
  | 'Cancelled';

export interface EateryOrder {
  id: string;
  orderCode: string;
  studentId: string;
  shopId: string;
  items: OrderSnapshotItem[];
  totalAmount: number;
  status: OrderStatus | string;
  notes: string | null;
  cancellationReason: string | null;
  pickupConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  shop?: ShopItem | null;
  student?: PublicUser | null;
  alreadyReviewed?: boolean;
  studentReliability?: {
    totalOrders: number;
    collectedCount: number;
    incidentCount: number;
    incidentCodes: string[];
  };
}

export interface ShopReviewItem {
  id: string;
  shopId: string;
  studentId: string;
  orderId: string;
  rating: number;
  comment: string;
  moderationStatus: 'visible' | 'flagged' | 'hidden' | string;
  createdAt: string;
  student?: PublicUser | null;
  shopName?: string;
}

export interface AccountRestrictionItem {
  id: string;
  studentId: string;
  shopId: string | null;
  shopName?: string;
  flaggedBy: string;
  reason: string;
  evidenceReference: string;
  restrictionStatus: 'pending_review' | 'active' | 'dismissed' | 'expired' | string;
  reviewedBy: string | null;
  appealStatus: 'none' | 'submitted' | 'approved' | 'rejected' | string;
  appealNote: string | null;
  createdAt: string;
  expiresAt: string | null;
  student?: PublicUser | UserProfile | null;
  flaggedByUser?: UserProfile | null;
  reviewedByUser?: UserProfile | null;
  reliability?: {
    totalOrders: number;
    collectedCount: number;
    incidentCount: number;
    incidentCodes: string[];
  } | null;
}

export interface ModerationLogItem {
  id: string;
  actorId: string;
  targetStudentId: string | null;
  targetShopId: string | null;
  action: string;
  reason: string;
  timestamp: string;
  actor?: UserProfile | null;
  targetStudent?: UserProfile | null;
  targetShopName?: string | null;
}

// ---------------------------------------------------------------------------
// MONETIZATION, BOOSTS, PREMIUM ANALYTICS & REFERRAL PROGRAMME TYPES
// ---------------------------------------------------------------------------
export interface PlatformSettings {
  id: string;
  key: string;
  boostBasicPrice: number;
  boostBasicHours: number;
  boostStandardPrice: number;
  boostStandardHours: number;
  boostPremiumPrice: number;
  boostPremiumHours: number;
  premiumPrice: number;
  premiumDurationDays: number;
  referralCommissionPct: number;
  referralMinOrderAmount: number;
  referralDisputeWindowHours: number;
  updatedAt: string;
}

export interface GatewayConfigStatus {
  mode: 'razorpay' | 'sandbox';
  isLiveConfigured: boolean;
  keyId: string | null;
  supportedMethods: Array<'upi' | 'card' | 'netbanking'>;
  notice: string;
}

export interface PaymentTransactionItem {
  id: string;
  userId: string;
  purpose: 'listing_boost' | 'premium_membership' | string;
  referenceId: string;
  amount: number;
  currency: string;
  gateway: string;
  gatewayOrderId: string;
  gatewayPaymentId: string | null;
  idempotencyKey: string;
  paymentMethod: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  user?: UserProfile | null;
}

export interface ListingPromotionRow {
  id: string;
  listingId: string;
  sellerId: string;
  packageType: 'basic' | 'standard' | 'premium' | string;
  amount: number;
  startTime: string | null;
  expiryTime: string | null;
  paymentStatus: string;
  promotionStatus: string;
  createdAt: string;
  seller?: UserProfile | null;
  listing?: { id: string; title: string; productCode: string } | null;
}

export interface PremiumSubscriptionRow {
  id: string;
  userId: string;
  planPrice: number;
  durationDays: number;
  startDate: string | null;
  expiryDate: string | null;
  paymentStatus: string;
  subscriptionStatus: string;
  createdAt: string;
  user?: UserProfile | null;
}

export interface PremiumStatusResponse {
  isPremium: boolean;
  activeSubscription: PremiumSubscriptionRow | null;
  history: PremiumSubscriptionRow[];
  plan: { price: number; durationDays: number };
}

export interface PremiumAnalyticsResponse {
  subscription: PremiumSubscriptionRow;
  range: 'daily' | 'weekly' | 'monthly';
  summary: {
    totalListingViews: number;
    uniqueVisitors: number;
    totalEnquiries: number;
    totalOrders: number;
    completedSales: number;
    revenueGenerated: number;
    conversionRate: number;
    activeListingsCount: number;
    activeBoostsCount: number;
  };
  bestPerformingProduct: {
    productId: string;
    productCode: string;
    title: string;
    category: string;
    views: number;
    uniqueVisitors: number;
    completedSales: number;
    revenue: number;
    conversionRate: number;
  } | null;
  productBreakdown: Array<{
    productId: string;
    productCode: string;
    title: string;
    category: string;
    listingType: string;
    availabilityStatus: string;
    isBoosted: boolean;
    views: number;
    uniqueVisitors: number;
    enquiries: number;
    orders: number;
    completedSales: number;
    revenue: number;
    conversionRate: number;
  }>;
  trendSeries: Array<{
    label: string;
    views: number;
    uniqueVisitors: number;
    enquiries: number;
    sales: number;
    revenue: number;
  }>;
}

export interface SupportTicketItem {
  id: string;
  userId: string;
  subject: string;
  message: string;
  isPriority: boolean;
  status: string;
  createdAt: string;
}

export interface ReferralDashboardResponse {
  referralCode: string;
  referralSuspended: boolean;
  rules: {
    commissionRatePct: number;
    minOrderAmount: number;
    disputeWindowHours: number;
  };
  summary: {
    totalReferrals: number;
    verifiedReferrals: number;
    successfulTransactions: number;
    totalCommissionEarned: number;
    creditedBalance: number;
    pendingRewards: number;
    withdrawnAmount: number;
    withdrawableBalance: number;
  };
  referralHistory: Array<{
    id: string;
    maskedStudentId: string;
    department: string;
    academicYear: string;
    verificationStatus: string;
    registrationDate: string;
    transactionsCount: number;
    rewardEarned: number;
    status: string;
  }>;
  commissionLedger: Array<{
    id: string;
    transactionCode: string;
    maskedStudentId: string;
    eligibleAmount: number;
    commissionRate: number;
    commissionAmount: number;
    rewardStatus: 'pending' | 'credited' | 'rejected' | 'reversed' | string;
    eligibleAt: string;
    createdAt: string;
    creditedAt: string | null;
  }>;
  withdrawals: Array<{
    id: string;
    amount: number;
    payoutMethod: string;
    payoutDestinationMasked: string;
    status: 'pending' | 'approved' | 'rejected' | 'paid' | string;
    adminNote: string | null;
    createdAt: string;
    processedAt: string | null;
  }>;
  pagination: {
    page: number;
    limit: number;
    totalReferrals: number;
    totalCommissions: number;
    totalPages: number;
  };
}

export interface AdminMonetizationResponse {
  settings: PlatformSettings;
  metrics: {
    boostRevenue: number;
    premiumRevenue: number;
    totalMonetizationRevenue: number;
    activePromotionsCount: number;
    activeSubscribersCount: number;
    totalReferrals: number;
    referralCommissionLiability: number;
    pendingWithdrawalsCount: number;
  };
  payments: PaymentTransactionItem[];
  promotions: ListingPromotionRow[];
  subscriptions: PremiumSubscriptionRow[];
  referralTransactions: Array<{
    id: string;
    referralCode: string;
    eligibleAmount: number;
    commissionRate: number;
    commissionAmount: number;
    rewardStatus: string;
    adminNote: string | null;
    createdAt: string;
    referrer: UserProfile | null;
    referredUser: UserProfile | null;
    suspiciousPairCount: number;
  }>;
  withdrawals: Array<{
    id: string;
    studentId: string;
    amount: number;
    payoutMethod: string;
    payoutDestinationMasked: string;
    status: string;
    adminNote: string | null;
    createdAt: string;
    student: UserProfile | null;
  }>;
}

const TOKEN_KEY = 'pingme_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string, remember = true) {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data as T;
}
