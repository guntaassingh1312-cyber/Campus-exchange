import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firebaseUid: text('firebase_uid').unique(),
    studentId: text('student_id').notNull().unique(),
    fullName: text('full_name').notNull(),
    institutionalEmail: text('institutional_email').notNull().unique(),
    passwordHash: text('password_hash'),
    department: text('department').notNull().default('Computer Science & Engineering'),
    academicYear: text('academic_year').notNull().default('3rd Year'),
    role: text('role').notNull().default('student'), // 'student' | 'admin' | 'shop_owner'
    verificationStatus: text('verification_status').notNull().default('pending'), // 'verified' | 'pending' | 'rejected'
    avatarUrl: text('avatar_url'),
    hostelBlock: text('hostel_block').default('Campus'),
    bio: text('bio'),
    referralCode: text('referral_code'),
    referredBy: uuid('referred_by'),
    isPremium: boolean('is_premium').notNull().default(false),
    referralSuspended: boolean('referral_suspended').notNull().default(false),
    boostSuspended: boolean('boost_suspended').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('profiles_student_id_idx').on(table.studentId),
    index('profiles_email_idx').on(table.institutionalEmail),
    index('profiles_referral_code_idx').on(table.referralCode),
  ]
);

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  subcategories: text('subcategories').notNull().default('[]'), // JSON string array
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productCode: text('product_code').notNull().unique(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    subcategory: text('subcategory').notNull().default('General'),
    condition: text('condition').notNull(), // 'New' | 'Like New' | 'Good' | 'Fair'
    listingType: text('listing_type').notNull(), // 'sell' | 'rent' | 'both'
    sellingPrice: integer('selling_price'),
    negotiable: boolean('negotiable').notNull().default(false),
    rentalPriceDaily: integer('rental_price_daily'),
    rentalPriceWeekly: integer('rental_price_weekly'),
    rentalPriceMonthly: integer('rental_price_monthly'),
    securityDeposit: integer('security_deposit').notNull().default(0),
    minRentalDays: integer('min_rental_days').notNull().default(1),
    maxRentalDays: integer('max_rental_days').notNull().default(30),
    pickupLocation: text('pickup_location').notNull(),
    hostelOrDept: text('hostel_or_dept').notNull().default('PEC Campus'),
    availabilityStatus: text('availability_status').notNull().default('Available'), // 'Available' | 'Currently Rented' | 'Sold' | 'Inactive'
    qrTokenHash: text('qr_token_hash').notNull(),
    viewCount: integer('view_count').notNull().default(0),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('products_seller_idx').on(table.sellerId),
    index('products_category_idx').on(table.category),
    index('products_code_idx').on(table.productCode),
    index('products_availability_idx').on(table.availabilityStatus),
  ]
);

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    imageUrl: text('image_url').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('product_images_product_idx').on(table.productId)]
);

export const uploadedFiles = pgTable('uploaded_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  uploaderId: uuid('uploader_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  mimeType: text('mime_type').notNull(),
  dataBase64: text('data_base64').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    transactionCode: text('transaction_code').notNull().unique(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    buyerId: uuid('buyer_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    transactionType: text('transaction_type').notNull(), // 'buy' | 'rent' | 'offer'
    bookingStart: timestamp('booking_start'),
    bookingEnd: timestamp('booking_end'),
    totalAmount: integer('total_amount').notNull(),
    depositAmount: integer('deposit_amount').notNull().default(0),
    offerAmount: integer('offer_amount'),
    notes: text('notes'),
    transactionStatus: text('transaction_status').notNull().default('Pending'),
    collectedAt: timestamp('collected_at'),
    returnedAt: timestamp('returned_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('transactions_product_idx').on(table.productId),
    index('transactions_buyer_idx').on(table.buyerId),
    index('transactions_seller_idx').on(table.sellerId),
  ]
);

export const qrTokens = pgTable(
  'qr_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
    transactionId: uuid('transaction_id').references(() => transactions.id, {
      onDelete: 'cascade',
    }),
    tokenHash: text('token_hash').notNull().unique(),
    rawCode: text('raw_code').notNull(),
    tokenType: text('token_type').notNull(), // 'product_discovery' | 'handover_collect' | 'handover_return'
    issuedBy: uuid('issued_by').references(() => profiles.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at'),
    usedAt: timestamp('used_at'),
    usedBy: uuid('used_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('qr_tokens_hash_idx').on(table.tokenHash),
    index('qr_tokens_product_idx').on(table.productId),
    index('qr_tokens_txn_idx').on(table.transactionId),
  ]
);

export const qrScanLogs = pgTable(
  'qr_scan_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scannerId: uuid('scanner_id').references(() => profiles.id, { onDelete: 'set null' }),
    qrTokenId: uuid('qr_token_id').references(() => qrTokens.id, { onDelete: 'set null' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    transactionId: uuid('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    scanAction: text('scan_action').notNull(),
    status: text('status').notNull(), // 'success' | 'invalid' | 'expired' | 'unauthorized' | 'duplicate'
    details: text('details').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('qr_scan_logs_scanner_idx').on(table.scannerId)]
);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    reviewedUserId: uuid('reviewed_user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('reviews_reviewed_user_idx').on(table.reviewedUserId),
    index('reviews_txn_idx').on(table.transactionId),
  ]
);

export const wishlists = pgTable(
  'wishlists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('wishlists_user_idx').on(table.userId)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    message: text('message').notNull(),
    notificationType: text('notification_type').notNull(),
    linkUrl: text('link_url'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)]
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    receiverId: uuid('receiver_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    messageText: text('message_text').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('messages_sender_idx').on(table.senderId),
    index('messages_receiver_idx').on(table.receiverId),
  ]
);

export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reporterId: uuid('reporter_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  reportedUserId: uuid('reported_user_id').references(() => profiles.id, {
    onDelete: 'cascade',
  }),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('open'), // 'open' | 'resolved' | 'dismissed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// EATERIES & TAKEAWAY MODULE TABLES
// ---------------------------------------------------------------------------
export interface OrderSnapshotItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  dietaryLabel?: string;
}

export const shops = pgTable(
  'shops',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    location: text('location').notNull(),
    imageUrl: text('image_url').notNull(),
    openingHours: text('opening_hours').notNull(),
    prepTime: text('prep_time').notNull().default('10-15 mins'),
    paymentProcessNote: text('payment_process_note')
      .notNull()
      .default('Payment (UPI or cash) and order collection are handled directly at the shop pickup counter.'),
    isActive: boolean('is_active').notNull().default(true),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    averageRating: doublePrecision('average_rating').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('shops_owner_idx').on(table.ownerId),
    index('shops_slug_idx').on(table.slug),
  ]
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull(),
    price: integer('price').notNull(),
    category: text('category').notNull(), // 'Snacks' | 'Meals' | 'Beverages' | 'Other items'
    imageUrl: text('image_url').notNull(),
    isAvailable: boolean('is_available').notNull().default(true),
    dietaryLabel: text('dietary_label').notNull().default('Veg'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('menu_items_shop_idx').on(table.shopId),
    index('menu_items_category_idx').on(table.category),
  ]
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderCode: text('order_code').notNull().unique(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    items: jsonb('items').$type<OrderSnapshotItem[]>().notNull(),
    totalAmount: integer('total_amount').notNull(),
    status: text('status').notNull().default('Pending'), // 'Pending' | 'Accepted' | 'Preparing' | 'Ready for Pickup' | 'Collected' | 'Rejected' | 'Cancelled'
    notes: text('notes'),
    cancellationReason: text('cancellation_reason'),
    idempotencyKey: text('idempotency_key').unique(),
    pickupConfirmedAt: timestamp('pickup_confirmed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('orders_student_idx').on(table.studentId),
    index('orders_shop_idx').on(table.shopId),
    index('orders_status_idx').on(table.status),
  ]
);

export const shopReviews = pgTable(
  'shop_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull().default(''),
    moderationStatus: text('moderation_status').notNull().default('visible'), // 'visible' | 'flagged' | 'hidden'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('shop_reviews_shop_idx').on(table.shopId),
    index('shop_reviews_student_idx').on(table.studentId),
  ]
);

export const accountRestrictions = pgTable(
  'account_restrictions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'set null' }),
    flaggedBy: uuid('flagged_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    evidenceReference: text('evidence_reference').notNull(),
    restrictionStatus: text('restriction_status').notNull().default('pending_review'), // 'pending_review' | 'active' | 'dismissed' | 'expired'
    reviewedBy: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
    appealStatus: text('appeal_status').notNull().default('none'), // 'none' | 'submitted' | 'approved' | 'rejected'
    appealNote: text('appeal_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),
  },
  (table) => [
    index('account_restrictions_student_idx').on(table.studentId),
    index('account_restrictions_shop_idx').on(table.shopId),
    index('account_restrictions_status_idx').on(table.restrictionStatus),
  ]
);

export const moderationLogs = pgTable(
  'moderation_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    targetStudentId: uuid('target_student_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    targetShopId: uuid('target_shop_id').references(() => shops.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    reason: text('reason').notNull(),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => [
    index('moderation_logs_actor_idx').on(table.actorId),
    index('moderation_logs_target_student_idx').on(table.targetStudentId),
  ]
);

// ---------------------------------------------------------------------------
// MONETIZATION, BOOSTS, PREMIUM, PAYMENTS & REFERRAL PROGRAMME TABLES
// ---------------------------------------------------------------------------
export const platformSettings = pgTable('platform_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  boostBasicPrice: integer('boost_basic_price').notNull().default(20),
  boostBasicHours: integer('boost_basic_hours').notNull().default(72),
  boostStandardPrice: integer('boost_standard_price').notNull().default(35),
  boostStandardHours: integer('boost_standard_hours').notNull().default(168),
  boostPremiumPrice: integer('boost_premium_price').notNull().default(50),
  boostPremiumHours: integer('boost_premium_hours').notNull().default(336),
  premiumPrice: integer('premium_price').notNull().default(199),
  premiumDurationDays: integer('premium_duration_days').notNull().default(30),
  referralCommissionPct: doublePrecision('referral_commission_pct').notNull().default(5),
  referralMinOrderAmount: integer('referral_min_order_amount').notNull().default(100),
  referralDisputeWindowHours: integer('referral_dispute_window_hours').notNull().default(24),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    purpose: text('purpose').notNull(), // 'listing_boost' | 'premium_membership'
    referenceId: uuid('reference_id').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('INR'),
    gateway: text('gateway').notNull().default('sandbox'), // 'razorpay' | 'sandbox'
    gatewayOrderId: text('gateway_order_id').notNull(),
    gatewayPaymentId: text('gateway_payment_id'),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    paymentMethod: text('payment_method').notNull().default('upi'), // 'upi' | 'card' | 'netbanking'
    status: text('status').notNull().default('pending'), // 'pending' | 'succeeded' | 'failed' | 'refunded'
    failureReason: text('failure_reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('payment_transactions_user_idx').on(table.userId),
    index('payment_transactions_order_idx').on(table.gatewayOrderId),
    index('payment_transactions_status_idx').on(table.status),
  ]
);

export const listingPromotions = pgTable(
  'listing_promotions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    packageType: text('package_type').notNull(), // 'basic' | 'standard' | 'premium'
    amount: integer('amount').notNull(),
    startTime: timestamp('start_time'),
    expiryTime: timestamp('expiry_time'),
    paymentStatus: text('payment_status').notNull().default('pending'), // 'pending' | 'paid' | 'failed' | 'refunded'
    promotionStatus: text('promotion_status').notNull().default('pending'), // 'pending' | 'active' | 'expired' | 'cancelled' | 'suspended'
    paymentTransactionId: uuid('payment_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('listing_promotions_listing_idx').on(table.listingId),
    index('listing_promotions_seller_idx').on(table.sellerId),
    index('listing_promotions_status_idx').on(table.promotionStatus),
  ]
);

export const premiumSubscriptions = pgTable(
  'premium_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    planPrice: integer('plan_price').notNull(),
    durationDays: integer('duration_days').notNull().default(30),
    startDate: timestamp('start_date'),
    expiryDate: timestamp('expiry_date'),
    paymentStatus: text('payment_status').notNull().default('pending'), // 'pending' | 'paid' | 'failed' | 'refunded'
    subscriptionStatus: text('subscription_status').notNull().default('pending'), // 'pending' | 'active' | 'expired' | 'cancelled' | 'suspended'
    paymentTransactionId: uuid('payment_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('premium_subscriptions_user_idx').on(table.userId),
    index('premium_subscriptions_status_idx').on(table.subscriptionStatus),
  ]
);

export const productViewEvents = pgTable(
  'product_view_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    visitorKey: text('visitor_key').notNull(),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (table) => [
    index('product_view_events_product_idx').on(table.productId),
    index('product_view_events_seller_idx').on(table.sellerId),
    index('product_view_events_viewed_idx').on(table.viewedAt),
  ]
);

export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    referrerId: uuid('referrer_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    referredUserId: uuid('referred_user_id')
      .notNull()
      .unique()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    referralCode: text('referral_code').notNull(),
    status: text('status').notNull().default('registered'), // 'registered' | 'verified' | 'suspended'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('referrals_referrer_idx').on(table.referrerId),
    index('referrals_code_idx').on(table.referralCode),
  ]
);

export const referralTransactions = pgTable(
  'referral_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    referralId: uuid('referral_id')
      .notNull()
      .references(() => referrals.id, { onDelete: 'cascade' }),
    referrerId: uuid('referrer_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    referredUserId: uuid('referred_user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    referralCode: text('referral_code').notNull(),
    transactionId: uuid('transaction_id')
      .notNull()
      .unique()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    eligibleAmount: integer('eligible_amount').notNull(),
    commissionRate: doublePrecision('commission_rate').notNull(),
    commissionAmount: integer('commission_amount').notNull(),
    rewardStatus: text('reward_status').notNull().default('pending'), // 'pending' | 'credited' | 'rejected' | 'reversed'
    adminNote: text('admin_note'),
    eligibleAt: timestamp('eligible_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    creditedAt: timestamp('credited_at'),
  },
  (table) => [
    index('referral_txns_referrer_idx').on(table.referrerId),
    index('referral_txns_status_idx').on(table.rewardStatus),
  ]
);

export const rewardWithdrawals = pgTable(
  'reward_withdrawals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    payoutMethod: text('payout_method').notNull().default('UPI'),
    payoutDestinationMasked: text('payout_destination_masked').notNull(),
    status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'paid'
    adminNote: text('admin_note'),
    reviewedBy: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
  },
  (table) => [
    index('reward_withdrawals_student_idx').on(table.studentId),
    index('reward_withdrawals_status_idx').on(table.status),
  ]
);

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    message: text('message').notNull(),
    isPriority: boolean('is_priority').notNull().default(false),
    status: text('status').notNull().default('open'), // 'open' | 'in_progress' | 'resolved'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('support_tickets_user_idx').on(table.userId)]
);

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  products: many(products),
  wishlists: many(wishlists),
  notifications: many(notifications),
  ownedShops: many(shops),
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  seller: one(profiles, {
    fields: [products.sellerId],
    references: [profiles.id],
  }),
  images: many(productImages),
  transactions: many(transactions),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const shopsRelations = relations(shops, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [shops.ownerId],
    references: [profiles.id],
  }),
  menuItems: many(menuItems),
  orders: many(orders),
  reviews: many(shopReviews),
}));

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  shop: one(shops, {
    fields: [menuItems.shopId],
    references: [shops.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  student: one(profiles, {
    fields: [orders.studentId],
    references: [profiles.id],
  }),
  shop: one(shops, {
    fields: [orders.shopId],
    references: [shops.id],
  }),
}));

export const shopReviewsRelations = relations(shopReviews, ({ one }) => ({
  shop: one(shops, {
    fields: [shopReviews.shopId],
    references: [shops.id],
  }),
  student: one(profiles, {
    fields: [shopReviews.studentId],
    references: [profiles.id],
  }),
  order: one(orders, {
    fields: [shopReviews.orderId],
    references: [orders.id],
  }),
}));

