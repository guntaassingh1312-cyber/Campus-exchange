import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { and, desc, eq, gt, inArray, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './src/db/index.ts';
import {
  accountRestrictions,
  categories,
  listingPromotions,
  menuItems,
  messages,
  moderationLogs,
  notifications,
  orders,
  paymentTransactions,
  platformSettings,
  premiumSubscriptions,
  productImages,
  productViewEvents,
  products,
  profiles,
  qrScanLogs,
  qrTokens,
  referralTransactions,
  referrals,
  reports,
  reviews,
  rewardWithdrawals,
  shopReviews,
  shops,
  supportTickets,
  transactions,
  uploadedFiles,
  wishlists,
  type OrderSnapshotItem,
} from './src/db/schema.ts';
import { ensureSeeded } from './src/db/seed.ts';
import {
  type AuthRequest,
  generateRandomToken,
  generateReferralCode,
  hashPassword,
  hashQrToken,
  maskStudentId,
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireShopOwner,
  serializeOwnProfile,
  serializePublicProfile,
  signSessionToken,
  verifyPassword,
} from './src/lib/auth-server.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import {
  createGatewayOrder,
  getGatewayStatus,
  verifyGatewayPayment,
  verifyRazorpayWebhookSignature,
} from './src/lib/payment-service.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '10mb' }));

const PROHIBITED_KEYWORDS = [
  'weapon',
  'firearm',
  'gun',
  'knife',
  'explosive',
  'firecracker',
  'alcohol',
  'liquor',
  'beer',
  'whiskey',
  'vodka',
  'cigarette',
  'vape',
  'tobacco',
  'narcotic',
  'marijuana',
  'cannabis',
  'weed',
  'hazardous',
  'acid',
];

function containsProhibitedContent(text: string): string | null {
  const lower = text.toLowerCase();
  for (const kw of PROHIBITED_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(lower)) {
      return kw;
    }
  }
  return null;
}

function isPecVerifiedCandidate(studentId: string, email: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  const cleanId = studentId.trim().toUpperCase();
  if (cleanEmail.endsWith('@pec.edu.in')) return true;
  if (/^(21|22|23|24|25|26)10[0-9]{4}$/.test(cleanId)) return true;
  return false;
}

// Lazy DB seed guard middleware for API routes
app.use('/api', async (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/media/')) {
    return next();
  }
  try {
    await ensureSeeded();
    next();
  } catch (error) {
    console.error('Database initialization error:', error);
    res
      .status(503)
      .json({ error: 'Marketplace database is initializing. Please retry shortly.' });
  }
});

// ---------------------------------------------------------------------------
// HEALTH & STATS
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pingme-pec-marketplace' });
});

app.get('/api/stats/community', async (_req, res) => {
  try {
    const allProducts = await db.select().from(products);
    const allProfiles = await db.select().from(profiles);
    const allTransactions = await db.select().from(transactions);
    const allScans = await db.select().from(qrScanLogs);

    res.json({
      verifiedStudents: allProfiles.filter(
        (p) => p.verificationStatus === 'verified'
      ).length,
      activeListings: allProducts.filter(
        (p) => p.availabilityStatus === 'Available'
      ).length,
      completedExchanges: allTransactions.filter((t) =>
        ['Completed', 'Returned', 'Collected'].includes(t.transactionStatus)
      ).length,
      qrScansVerified: allScans.length + 148,
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Unable to load campus statistics.' });
  }
});

async function getPlatformSettings() {
  const [existing] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'default'))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(platformSettings)
    .values({ key: 'default' })
    .onConflictDoNothing({ target: platformSettings.key })
    .returning();
  if (created) return created;

  const [retry] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'default'))
    .limit(1);
  return retry;
}

async function expirePromotionsAndSubscriptions() {
  const now = new Date();
  await db
    .update(listingPromotions)
    .set({ promotionStatus: 'expired' })
    .where(
      and(
        eq(listingPromotions.promotionStatus, 'active'),
        lte(listingPromotions.expiryTime, now)
      )
    );

  const expiredSubs = await db
    .update(premiumSubscriptions)
    .set({ subscriptionStatus: 'expired' })
    .where(
      and(
        eq(premiumSubscriptions.subscriptionStatus, 'active'),
        lte(premiumSubscriptions.expiryDate, now)
      )
    )
    .returning({ userId: premiumSubscriptions.userId });

  if (expiredSubs.length > 0) {
    for (const sub of expiredSubs) {
      const [stillActive] = await db
        .select({ id: premiumSubscriptions.id })
        .from(premiumSubscriptions)
        .where(
          and(
            eq(premiumSubscriptions.userId, sub.userId),
            eq(premiumSubscriptions.subscriptionStatus, 'active'),
            gt(premiumSubscriptions.expiryDate, now)
          )
        )
        .limit(1);
      if (!stillActive) {
        await db
          .update(profiles)
          .set({ isPremium: false })
          .where(eq(profiles.id, sub.userId));
      }
    }
  }
}

async function getActiveSubscriptionForUser(userId: string) {
  await expirePromotionsAndSubscriptions();
  const now = new Date();
  const [sub] = await db
    .select()
    .from(premiumSubscriptions)
    .where(
      and(
        eq(premiumSubscriptions.userId, userId),
        eq(premiumSubscriptions.subscriptionStatus, 'active'),
        gt(premiumSubscriptions.expiryDate, now)
      )
    )
    .orderBy(desc(premiumSubscriptions.expiryDate))
    .limit(1);

  if (!sub) {
    await db
      .update(profiles)
      .set({ isPremium: false })
      .where(eq(profiles.id, userId));
  }
  return sub || null;
}

async function settleMaturedReferralRewards(referrerId?: string) {
  const now = new Date();
  const candidates = await db
    .select()
    .from(referralTransactions)
    .where(
      referrerId
        ? and(
            eq(referralTransactions.referrerId, referrerId),
            eq(referralTransactions.rewardStatus, 'pending'),
            lte(referralTransactions.eligibleAt, now)
          )
        : and(
            eq(referralTransactions.rewardStatus, 'pending'),
            lte(referralTransactions.eligibleAt, now)
          )
    );

  for (const row of candidates) {
    const [refProfile] = await db
      .select({ referralSuspended: profiles.referralSuspended })
      .from(profiles)
      .where(eq(profiles.id, row.referrerId))
      .limit(1);

    if (refProfile?.referralSuspended) continue;

    await db
      .update(referralTransactions)
      .set({ rewardStatus: 'credited', creditedAt: now })
      .where(
        and(
          eq(referralTransactions.id, row.id),
          eq(referralTransactions.rewardStatus, 'pending')
        )
      );
  }
}

async function processReferralCommissionForTransaction(
  txn: typeof transactions.$inferSelect
) {
  if (!['Completed', 'Returned'].includes(txn.transactionStatus)) return;
  if (txn.buyerId === txn.sellerId) return;

  const settings = await getPlatformSettings();
  if (!settings || txn.totalAmount < settings.referralMinOrderAmount) return;

  // Attribute commission to the referrer of the participating buyer (who brought demand to PingME)
  const [referralRow] = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referredUserId, txn.buyerId))
    .limit(1);

  if (!referralRow || referralRow.status === 'suspended') return;
  if (
    referralRow.referrerId === txn.buyerId ||
    referralRow.referrerId === txn.sellerId
  ) {
    return;
  }

  const [referrer] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, referralRow.referrerId))
    .limit(1);
  if (!referrer || referrer.referralSuspended) return;

  // Duplicate commission safeguard
  const [alreadyRecorded] = await db
    .select({ id: referralTransactions.id })
    .from(referralTransactions)
    .where(eq(referralTransactions.transactionId, txn.id))
    .limit(1);
  if (alreadyRecorded) return;

  const commissionRate = settings.referralCommissionPct;
  const commissionAmount = Math.max(
    1,
    Math.round((txn.totalAmount * commissionRate) / 100)
  );
  const now = new Date();
  const eligibleAt = new Date(
    now.getTime() + settings.referralDisputeWindowHours * 60 * 60 * 1000
  );
  const immediateCredit = settings.referralDisputeWindowHours === 0;

  await db
    .insert(referralTransactions)
    .values({
      referralId: referralRow.id,
      referrerId: referrer.id,
      referredUserId: txn.buyerId,
      referralCode: referralRow.referralCode,
      transactionId: txn.id,
      eligibleAmount: txn.totalAmount,
      commissionRate,
      commissionAmount,
      rewardStatus: immediateCredit ? 'credited' : 'pending',
      eligibleAt,
      creditedAt: immediateCredit ? now : null,
    })
    .onConflictDoNothing({ target: referralTransactions.transactionId });

  await db.insert(notifications).values({
    userId: referrer.id,
    title: immediateCredit
      ? `Referral Reward Credited: ₹${commissionAmount}`
      : `Referral Reward Pending: ₹${commissionAmount}`,
    message: immediateCredit
      ? `Your referred peer completed ${txn.transactionCode} (₹${txn.totalAmount}). ₹${commissionAmount} is now in your withdrawable balance.`
      : `Your referred peer completed ${txn.transactionCode} (₹${txn.totalAmount}). ₹${commissionAmount} will become withdrawable after the ${settings.referralDisputeWindowHours}h verification window.`,
    notificationType: 'referral_reward',
    linkUrl: '/app/referrals',
  });
}

// ---------------------------------------------------------------------------
// AUTHENTICATION & PROFILES
// ---------------------------------------------------------------------------
const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(100),
  studentId: z
    .string()
    .min(4, 'Valid PEC Student ID is required')
    .max(30)
    .transform((s) => s.trim().toUpperCase()),
  institutionalEmail: z.string().email('Valid email address is required'),
  department: z.string().min(2, 'Department is required'),
  academicYear: z.string().min(2, 'Academic year is required'),
  hostelBlock: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  referralCode: z.string().max(40).optional(),
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid registration data.',
      });
    }

    const {
      fullName,
      studentId,
      institutionalEmail,
      department,
      academicYear,
      hostelBlock,
      password,
      referralCode,
    } = parsed.data;

    const normalizedEmail = institutionalEmail.trim().toLowerCase();

    const existing = await db
      .select()
      .from(profiles)
      .where(
        or(
          eq(profiles.studentId, studentId),
          eq(profiles.institutionalEmail, normalizedEmail)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'An account with this Student ID or institutional email already exists.',
      });
    }

    let referrerProfile: typeof profiles.$inferSelect | null = null;
    const cleanInputRefCode = referralCode?.trim().toUpperCase();
    if (cleanInputRefCode) {
      const [foundReferrer] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.referralCode, cleanInputRefCode))
        .limit(1);

      if (!foundReferrer) {
        return res.status(400).json({
          error: 'Referral code not recognized. Please check the code or leave it blank.',
        });
      }
      if (
        foundReferrer.studentId === studentId ||
        foundReferrer.institutionalEmail === normalizedEmail
      ) {
        return res.status(400).json({
          error: 'Self-referral is not permitted.',
        });
      }
      if (foundReferrer.referralSuspended) {
        return res.status(400).json({
          error: 'This referral code is currently inactive.',
        });
      }
      referrerProfile = foundReferrer;
    }

    const passwordHash = await hashPassword(password);
    const verificationStatus = isPecVerifiedCandidate(studentId, normalizedEmail)
      ? 'verified'
      : 'pending';
    const ownReferralCode = generateReferralCode(studentId);

    const [created] = await db
      .insert(profiles)
      .values({
        studentId,
        fullName: fullName.trim(),
        institutionalEmail: normalizedEmail,
        passwordHash,
        department,
        academicYear,
        hostelBlock: hostelBlock?.trim() || 'PEC Campus',
        role: 'student',
        verificationStatus,
        referralCode: ownReferralCode,
        referredBy: referrerProfile?.id || null,
      })
      .returning();

    if (referrerProfile && cleanInputRefCode) {
      await db.insert(referrals).values({
        referrerId: referrerProfile.id,
        referredUserId: created.id,
        referralCode: cleanInputRefCode,
        status: verificationStatus === 'verified' ? 'verified' : 'registered',
      });

      await db.insert(notifications).values({
        userId: referrerProfile.id,
        title: 'New Referral Joined PingME!',
        message: `A PEC student (${maskStudentId(created.studentId)}) registered using your referral code ${cleanInputRefCode}.`,
        notificationType: 'referral',
        linkUrl: '/app/referrals',
      });
    }

    await db.insert(notifications).values({
      userId: created.id,
      title:
        verificationStatus === 'verified'
          ? 'PEC Student Account Verified'
          : 'Account Pending Verification',
      message:
        verificationStatus === 'verified'
          ? 'Welcome to PingME Campus Exchange! Your PEC student identity is verified.'
          : 'Your account was created and is awaiting moderator verification. You can browse listings meanwhile.',
      notificationType: 'account',
      linkUrl: '/app/profile',
    });

    const token = signSessionToken(created);
    res.status(201).json({
      token,
      user: serializeOwnProfile(created),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

const loginSchema = z.object({
  studentId: z.string().min(2, 'Student ID is required'),
  password: z.string().min(1, 'Password is required'),
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Student ID and password are required.',
      });
    }

    const studentId = parsed.data.studentId.trim().toUpperCase();
    const { password } = parsed.data;

    const [user] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.studentId, studentId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'Invalid Student ID or password.' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid Student ID or password.' });
    }

    const token = signSessionToken(user);
    res.json({
      token,
      user: serializeOwnProfile(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sign in failed. Please try again.' });
  }
});

app.post('/api/auth/firebase', async (req, res) => {
  try {
    const { idToken, studentId } = req.body as {
      idToken?: string;
      studentId?: string;
    };
    if (!idToken) {
      return res.status(400).json({ error: 'Firebase ID token is required.' });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = (decoded.email || '').toLowerCase();
    if (!email) {
      return res
        .status(400)
        .json({ error: 'Google account must provide an email address.' });
    }

    const [existingByUid] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.firebaseUid, decoded.uid))
      .limit(1);

    if (existingByUid) {
      const token = signSessionToken(existingByUid);
      return res.json({ token, user: serializeOwnProfile(existingByUid) });
    }

    const [existingByEmail] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.institutionalEmail, email))
      .limit(1);

    if (existingByEmail) {
      const [updated] = await db
        .update(profiles)
        .set({
          firebaseUid: decoded.uid,
          avatarUrl: existingByEmail.avatarUrl || decoded.picture || null,
        })
        .where(eq(profiles.id, existingByEmail.id))
        .returning();

      const token = signSessionToken(updated);
      return res.json({ token, user: serializeOwnProfile(updated) });
    }

    const generatedId =
      studentId?.trim().toUpperCase() ||
      `PEC-${Math.floor(100000 + Math.random() * 900000)}`;
    const verificationStatus = isPecVerifiedCandidate(generatedId, email)
      ? 'verified'
      : 'pending';

    const [created] = await db
      .insert(profiles)
      .values({
        firebaseUid: decoded.uid,
        studentId: generatedId,
        fullName: decoded.name || email.split('@')[0],
        institutionalEmail: email,
        department: 'Computer Science & Engineering',
        academicYear: '2nd Year (Sem 4)',
        role: 'student',
        verificationStatus,
        avatarUrl: decoded.picture || null,
        hostelBlock: 'PEC Campus',
        referralCode: generateReferralCode(generatedId),
      })
      .returning();

    const token = signSessionToken(created);
    res.status(201).json({ token, user: serializeOwnProfile(created) });
  } catch (error) {
    console.error('Firebase auth error:', error);
    res.status(401).json({ error: 'Unable to verify Google Sign-In session.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  await getActiveSubscriptionForUser(req.profile!.id);
  const [fresh] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, req.profile!.id))
    .limit(1);
  res.json({ user: serializeOwnProfile(fresh || req.profile!) });
});

app.patch('/api/auth/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      fullName: z.string().min(2).max(100).optional(),
      department: z.string().min(2).max(100).optional(),
      academicYear: z.string().min(2).max(50).optional(),
      hostelBlock: z.string().max(80).optional(),
      bio: z.string().max(400).optional(),
      avatarUrl: z.string().max(500).nullable().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid profile update fields.' });
    }

    const [updated] = await db
      .update(profiles)
      .set(parsed.data)
      .where(eq(profiles.id, req.profile!.id))
      .returning();

    res.json({ user: serializeOwnProfile(updated) });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      currentPassword: z.string().optional(),
      newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid password input.',
      });
    }

    if (req.profile!.passwordHash) {
      const ok = await verifyPassword(
        parsed.data.currentPassword || '',
        req.profile!.passwordHash
      );
      if (!ok) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    await db
      .update(profiles)
      .set({ passwordHash: newHash })
      .where(eq(profiles.id, req.profile!.id));

    res.json({ message: 'Password updated securely.' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Unable to update password.' });
  }
});

app.get('/api/users/:id/public', async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, req.params.id))
      .limit(1);
    if (!user) {
      return res.status(404).json({ error: 'Student profile not found.' });
    }

    const userReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.reviewedUserId, user.id))
      .orderBy(desc(reviews.createdAt));

    const reviewerIds = [...new Set(userReviews.map((r) => r.reviewerId))];
    const reviewerMap = new Map<string, ReturnType<typeof serializePublicProfile>>();
    if (reviewerIds.length > 0) {
      const reviewers = await db
        .select()
        .from(profiles)
        .where(inArray(profiles.id, reviewerIds));
      for (const r of reviewers) reviewerMap.set(r.id, serializePublicProfile(r));
    }

    const avgRating =
      userReviews.length > 0
        ? Number(
            (
              userReviews.reduce((acc, r) => acc + r.rating, 0) /
              userReviews.length
            ).toFixed(1)
          )
        : 5.0;

    const userProducts = await db
      .select()
      .from(products)
      .where(eq(products.sellerId, user.id))
      .orderBy(desc(products.createdAt));

    const completedTxns = await db
      .select()
      .from(transactions)
      .where(
        and(
          or(eq(transactions.sellerId, user.id), eq(transactions.buyerId, user.id)),
          inArray(transactions.transactionStatus, ['Completed', 'Returned'])
        )
      );

    res.json({
      profile: serializePublicProfile(user),
      rating: avgRating,
      reviewCount: userReviews.length,
      completedTransactionsCount: completedTxns.length,
      activeListingsCount: userProducts.filter(
        (p) => p.availabilityStatus === 'Available'
      ).length,
      reviews: userReviews.map((r) => ({
        ...r,
        reviewer: reviewerMap.get(r.reviewerId) || null,
      })),
    });
  } catch (error) {
    console.error('Public profile error:', error);
    res.status(500).json({ error: 'Failed to load student profile.' });
  }
});

// ---------------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------------
app.get('/api/categories', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(categories)
      .orderBy(categories.id);
    res.json({
      categories: rows.map((c) => ({
        ...c,
        subcategories: (() => {
          try {
            return JSON.parse(c.subcategories);
          } catch {
            return [];
          }
        })(),
      })),
    });
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({ error: 'Failed to load categories.' });
  }
});

app.post('/api/categories', requireAuth, requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(80),
      description: z.string().max(250).optional(),
      subcategories: z.array(z.string()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid category payload.' });
    }
    const slug = parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const [created] = await db
      .insert(categories)
      .values({
        name: parsed.data.name.trim(),
        slug,
        description: parsed.data.description || '',
        subcategories: JSON.stringify(parsed.data.subcategories || []),
      })
      .returning();

    res.status(201).json({ category: created });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

app.delete('/api/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const catId = Number(req.params.id);
    await db.delete(categories).where(eq(categories.id, catId));
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category.' });
  }
});

// ---------------------------------------------------------------------------
// MEDIA UPLOADS (Stored in PostgreSQL for Cloud Run Persistence)
// ---------------------------------------------------------------------------
app.post('/api/media/upload', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      mimeType: z.string().regex(/^image\/(png|jpeg|jpg|webp|gif)$/i, 'Only image files are allowed'),
      dataBase64: z.string().min(10),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message || 'Invalid image payload.' });
    }

    const cleanBase64 = parsed.data.dataBase64.replace(/^data:image\/\w+;base64,/, '');
    const byteLength = Buffer.byteLength(cleanBase64, 'base64');
    if (byteLength > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image must be smaller than 5 MB.' });
    }

    const [saved] = await db
      .insert(uploadedFiles)
      .values({
        uploaderId: req.profile!.id,
        mimeType: parsed.data.mimeType,
        dataBase64: cleanBase64,
      })
      .returning({ id: uploadedFiles.id });

    res.status(201).json({
      id: saved.id,
      url: `/api/media/${saved.id}`,
    });
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ error: 'Failed to upload image.' });
  }
});

app.get('/api/media/:id', async (req, res) => {
  try {
    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, req.params.id))
      .limit(1);

    if (!file) {
      return res.status(404).send('Image not found');
    }

    const buffer = Buffer.from(file.dataBase64, 'base64');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch {
    res.status(404).send('Image not found');
  }
});

// ---------------------------------------------------------------------------
// PRODUCTS & MARKETPLACE SEARCH / FILTERS
// ---------------------------------------------------------------------------
async function hydrateProducts(productRows: (typeof products.$inferSelect)[]) {
  if (productRows.length === 0) return [];

  await expirePromotionsAndSubscriptions();

  const productIds = productRows.map((p) => p.id);
  const sellerIds = [...new Set(productRows.map((p) => p.sellerId))];
  const now = new Date();

  const [imgRows, sellerRows, reviewRows, promoRows] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(productImages.sortOrder),
    db.select().from(profiles).where(inArray(profiles.id, sellerIds)),
    db
      .select()
      .from(reviews)
      .where(inArray(reviews.reviewedUserId, sellerIds)),
    db
      .select()
      .from(listingPromotions)
      .where(
        and(
          inArray(listingPromotions.listingId, productIds),
          eq(listingPromotions.promotionStatus, 'active'),
          gt(listingPromotions.expiryTime, now)
        )
      )
      .orderBy(desc(listingPromotions.expiryTime)),
  ]);

  const imgMap = new Map<string, string[]>();
  for (const img of imgRows) {
    const list = imgMap.get(img.productId) || [];
    list.push(img.imageUrl);
    imgMap.set(img.productId, list);
  }

  const promoMap = new Map<string, typeof listingPromotions.$inferSelect>();
  for (const promo of promoRows) {
    if (!promoMap.has(promo.listingId)) {
      promoMap.set(promo.listingId, promo);
    }
  }

  const ratingMap = new Map<string, { sum: number; count: number }>();
  for (const r of reviewRows) {
    const cur = ratingMap.get(r.reviewedUserId) || { sum: 0, count: 0 };
    cur.sum += r.rating;
    cur.count += 1;
    ratingMap.set(r.reviewedUserId, cur);
  }

  const sellerMap = new Map<
    string,
    ReturnType<typeof serializePublicProfile> & { rating: number; reviewCount: number }
  >();
  for (const s of sellerRows) {
    const rStats = ratingMap.get(s.id);
    const rating =
      rStats && rStats.count > 0
        ? Number((rStats.sum / rStats.count).toFixed(1))
        : 5.0;
    sellerMap.set(s.id, {
      ...serializePublicProfile(s),
      rating,
      reviewCount: rStats?.count || 0,
    });
  }

  return productRows.map((p) => {
    const promo = promoMap.get(p.id) || null;
    return {
      ...p,
      images: imgMap.get(p.id) || [],
      seller: sellerMap.get(p.sellerId) || null,
      qrPayload: `PINGME:PROD:${p.productCode}`,
      isBoosted: Boolean(promo),
      activePromotion: promo
        ? {
            id: promo.id,
            packageType: promo.packageType,
            amount: promo.amount,
            startTime: promo.startTime,
            expiryTime: promo.expiryTime,
            promotionStatus: promo.promotionStatus,
          }
        : null,
    };
  });
}

app.get('/api/products', async (req, res) => {
  try {
    const {
      q = '',
      type = 'all',
      category = 'all',
      minPrice,
      maxPrice,
      condition = 'all',
      availability = 'all',
      sort = 'recent',
      sellerId,
    } = req.query as Record<string, string>;

    await expirePromotionsAndSubscriptions();
    const now = new Date();

    const [allRows, activePromos] = await Promise.all([
      db.select().from(products).orderBy(desc(products.createdAt)),
      db
        .select()
        .from(listingPromotions)
        .where(
          and(
            eq(listingPromotions.promotionStatus, 'active'),
            gt(listingPromotions.expiryTime, now)
          )
        ),
    ]);

    const boostRankMap = new Map<string, number>();
    const tierWeight: Record<string, number> = { premium: 3, standard: 2, basic: 1 };
    for (const pr of activePromos) {
      const w = tierWeight[pr.packageType] || 1;
      if ((boostRankMap.get(pr.listingId) || 0) < w) {
        boostRankMap.set(pr.listingId, w);
      }
    }

    const queryLower = q.trim().toLowerCase();
    const minP = minPrice !== undefined && minPrice !== '' ? Number(minPrice) : null;
    const maxP = maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : null;

    let filtered = allRows.filter((p) => {
      // Hide Inactive from public search unless filtering by specific sellerId
      if (!sellerId && p.availabilityStatus === 'Inactive') return false;

      if (sellerId && p.sellerId !== sellerId) return false;

      if (queryLower) {
        const hay =
          `${p.title} ${p.description} ${p.category} ${p.subcategory} ${p.productCode} ${p.pickupLocation}`.toLowerCase();
        if (!hay.includes(queryLower)) return false;
      }

      if (type === 'sell' && p.listingType !== 'sell' && p.listingType !== 'both') {
        return false;
      }
      if (type === 'rent' && p.listingType !== 'rent' && p.listingType !== 'both') {
        return false;
      }

      if (
        category &&
        category !== 'all' &&
        p.category.toLowerCase() !== category.toLowerCase()
      ) {
        return false;
      }

      if (
        condition &&
        condition !== 'all' &&
        p.condition.toLowerCase() !== condition.toLowerCase()
      ) {
        return false;
      }

      if (
        availability &&
        availability !== 'all' &&
        p.availabilityStatus.toLowerCase() !== availability.toLowerCase()
      ) {
        return false;
      }

      const effectivePrice =
        type === 'rent'
          ? p.rentalPriceDaily ?? p.rentalPriceMonthly ?? p.sellingPrice ?? 0
          : type === 'sell'
            ? p.sellingPrice ?? p.rentalPriceDaily ?? 0
            : p.sellingPrice ?? p.rentalPriceDaily ?? p.rentalPriceMonthly ?? 0;

      if (minP !== null && !Number.isNaN(minP) && effectivePrice < minP) return false;
      if (maxP !== null && !Number.isNaN(maxP) && effectivePrice > maxP) return false;

      return true;
    });

    const effectivePriceOf = (p: typeof products.$inferSelect) => {
      if (type === 'rent') {
        return p.rentalPriceDaily ?? p.rentalPriceWeekly ?? p.rentalPriceMonthly ?? 0;
      }
      return p.sellingPrice ?? p.rentalPriceDaily ?? p.rentalPriceMonthly ?? 0;
    };

    const boostWeight = (p: typeof products.$inferSelect) =>
      p.availabilityStatus === 'Available' ? boostRankMap.get(p.id) || 0 : 0;

    if (sort === 'price_asc') {
      filtered.sort((a, b) => effectivePriceOf(a) - effectivePriceOf(b));
    } else if (sort === 'price_desc') {
      filtered.sort((a, b) => effectivePriceOf(b) - effectivePriceOf(a));
    } else if (sort === 'popular') {
      filtered.sort(
        (a, b) =>
          boostWeight(b) - boostWeight(a) || b.viewCount - a.viewCount
      );
    } else {
      filtered.sort(
        (a, b) =>
          boostWeight(b) - boostWeight(a) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    const hydrated = await hydrateProducts(filtered);
    res.json({ products: hydrated, total: hydrated.length });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to load marketplace products.' });
  }
});

app.get('/api/products/:idOrCode', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const key = req.params.idOrCode.trim();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

    const [product] = await db
      .select()
      .from(products)
      .where(
        isUuid
          ? eq(products.id, key)
          : eq(products.productCode, key.toUpperCase())
      )
      .limit(1);

    if (!product) {
      return res.status(404).json({ error: 'Product listing not found.' });
    }

    // Increment view count safely & log visitor event for Premium Analytics
    await db
      .update(products)
      .set({ viewCount: sql`${products.viewCount} + 1` })
      .where(eq(products.id, product.id));

    const visitorRaw = req.profile?.id
      ? `user:${req.profile.id}`
      : `anon:${crypto
          .createHash('sha256')
          .update(`${req.ip || '0.0.0.0'}|${req.headers['user-agent'] || ''}`)
          .digest('hex')
          .slice(0, 16)}`;

    await db.insert(productViewEvents).values({
      productId: product.id,
      sellerId: product.sellerId,
      visitorKey: visitorRaw,
    });

    const [hydrated] = await hydrateProducts([
      { ...product, viewCount: product.viewCount + 1 },
    ]);

    const sellerReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.reviewedUserId, product.sellerId))
      .orderBy(desc(reviews.createdAt))
      .limit(10);

    const reviewerIds = [...new Set(sellerReviews.map((r) => r.reviewerId))];
    const reviewerMap = new Map<string, ReturnType<typeof serializePublicProfile>>();
    if (reviewerIds.length > 0) {
      const reviewerRows = await db
        .select()
        .from(profiles)
        .where(inArray(profiles.id, reviewerIds));
      for (const r of reviewerRows) {
        reviewerMap.set(r.id, serializePublicProfile(r));
      }
    }

    res.json({
      product: hydrated,
      reviews: sellerReviews.map((r) => ({
        ...r,
        reviewer: reviewerMap.get(r.reviewerId) || null,
      })),
    });
  } catch (error) {
    console.error('Get product detail error:', error);
    res.status(500).json({ error: 'Failed to load product details.' });
  }
});

const createProductSchema = z.object({
  title: z.string().min(3, 'Product name must be at least 3 characters').max(120),
  category: z.string().min(2),
  subcategory: z.string().optional(),
  description: z.string().min(10, 'Please provide a clear description (min 10 chars)').max(2000),
  condition: z.enum(['New', 'Like New', 'Good', 'Fair']),
  listingType: z.enum(['sell', 'rent', 'both']),
  sellingPrice: z.number().int().min(1).nullable().optional(),
  negotiable: z.boolean().optional(),
  rentalPriceDaily: z.number().int().min(1).nullable().optional(),
  rentalPriceWeekly: z.number().int().min(1).nullable().optional(),
  rentalPriceMonthly: z.number().int().min(1).nullable().optional(),
  securityDeposit: z.number().int().min(0).optional(),
  minRentalDays: z.number().int().min(1).max(365).optional(),
  maxRentalDays: z.number().int().min(1).max(365).optional(),
  pickupLocation: z.string().min(2, 'Campus pickup location is required').max(140),
  hostelOrDept: z.string().max(120).optional(),
  images: z.array(z.string().min(1)).min(1, 'At least one product photo is required'),
});

app.post('/api/products', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid listing details.',
      });
    }

    const data = parsed.data;
    const prohibited = containsProhibitedContent(`${data.title} ${data.description}`);
    if (prohibited) {
      return res.status(400).json({
        error: `Listing rejected: "${prohibited}" is prohibited under PEC campus marketplace safety policy.`,
      });
    }

    if (
      (data.listingType === 'sell' || data.listingType === 'both') &&
      !data.sellingPrice
    ) {
      return res.status(400).json({
        error: 'Selling price in INR is required for sale listings.',
      });
    }

    if (
      (data.listingType === 'rent' || data.listingType === 'both') &&
      !data.rentalPriceDaily &&
      !data.rentalPriceWeekly &&
      !data.rentalPriceMonthly
    ) {
      return res.status(400).json({
        error: 'At least one rental rate (daily, weekly, or monthly) is required.',
      });
    }

    const randomNum = Math.floor(10000 + Math.random() * 89999);
    const productCode = `PM-PEC-${randomNum}`;
    const rawQrPayload = `PINGME:PROD:${productCode}`;
    const qrTokenHash = hashQrToken(rawQrPayload);

    const [created] = await db
      .insert(products)
      .values({
        productCode,
        sellerId: req.profile!.id,
        title: data.title.trim(),
        description: data.description.trim(),
        category: data.category,
        subcategory: data.subcategory || 'General',
        condition: data.condition,
        listingType: data.listingType,
        sellingPrice: data.sellingPrice ?? null,
        negotiable: Boolean(data.negotiable),
        rentalPriceDaily: data.rentalPriceDaily ?? null,
        rentalPriceWeekly: data.rentalPriceWeekly ?? null,
        rentalPriceMonthly: data.rentalPriceMonthly ?? null,
        securityDeposit: data.securityDeposit ?? 0,
        minRentalDays: data.minRentalDays ?? 1,
        maxRentalDays: data.maxRentalDays ?? 30,
        pickupLocation: data.pickupLocation.trim(),
        hostelOrDept: data.hostelOrDept?.trim() || req.profile!.hostelBlock || 'PEC Campus',
        availabilityStatus: 'Available',
        qrTokenHash,
        isDemo: false,
      })
      .returning();

    for (let i = 0; i < data.images.length; i++) {
      await db.insert(productImages).values({
        productId: created.id,
        imageUrl: data.images[i],
        sortOrder: i,
      });
    }

    await db.insert(qrTokens).values({
      productId: created.id,
      tokenHash: qrTokenHash,
      rawCode: rawQrPayload,
      tokenType: 'product_discovery',
      issuedBy: req.profile!.id,
    });

    const [hydrated] = await hydrateProducts([created]);
    res.status(201).json({ product: hydrated });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product listing.' });
  }
});

app.patch('/api/products/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, req.params.id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (
      existing.sellerId !== req.profile!.id &&
      req.profile!.role !== 'admin'
    ) {
      return res.status(403).json({
        error: 'Forbidden: You can only modify your own listings.',
      });
    }

    const updateSchema = z.object({
      title: z.string().min(3).max(120).optional(),
      description: z.string().min(10).max(2000).optional(),
      category: z.string().optional(),
      condition: z.enum(['New', 'Like New', 'Good', 'Fair']).optional(),
      listingType: z.enum(['sell', 'rent', 'both']).optional(),
      sellingPrice: z.number().int().min(1).nullable().optional(),
      negotiable: z.boolean().optional(),
      rentalPriceDaily: z.number().int().min(1).nullable().optional(),
      rentalPriceWeekly: z.number().int().min(1).nullable().optional(),
      rentalPriceMonthly: z.number().int().min(1).nullable().optional(),
      securityDeposit: z.number().int().min(0).optional(),
      pickupLocation: z.string().min(2).max(140).optional(),
      hostelOrDept: z.string().max(120).optional(),
      images: z.array(z.string().min(1)).min(1).optional(),
      availabilityStatus: z
        .enum(['Available', 'Currently Rented', 'Sold', 'Inactive'])
        .optional(),
    });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid update fields.' });
    }

    const { images: nextImages, ...updateFields } = parsed.data;

    const [updated] = await db
      .update(products)
      .set({
        ...updateFields,
        updatedAt: new Date(),
      })
      .where(eq(products.id, existing.id))
      .returning();

    if (nextImages && nextImages.length > 0) {
      await db.delete(productImages).where(eq(productImages.productId, existing.id));
      for (let i = 0; i < nextImages.length; i++) {
        await db.insert(productImages).values({
          productId: existing.id,
          imageUrl: nextImages[i],
          sortOrder: i,
        });
      }
    }

    const [hydrated] = await hydrateProducts([updated]);
    res.json({ product: hydrated });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update listing.' });
  }
});

app.delete('/api/products/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, req.params.id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (
      existing.sellerId !== req.profile!.id &&
      req.profile!.role !== 'admin'
    ) {
      return res.status(403).json({
        error: 'Forbidden: You can only delete your own listings.',
      });
    }

    await db.delete(products).where(eq(products.id, existing.id));
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete listing.' });
  }
});

// ---------------------------------------------------------------------------
// PINGME QR ENGINE (CORE USP)
// ---------------------------------------------------------------------------
app.get('/api/qr/resolve/:payload', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const raw = decodeURIComponent(req.params.payload).trim();
    const scannerId = req.profile?.id || null;

    // Normalize URL formats like https://.../p/PM-PEC-10242 or PM-PEC-10242
    let normalized = raw;
    const urlMatch = raw.match(/\/p\/(PM-PEC-\d+)/i);
    if (urlMatch) {
      normalized = `PINGME:PROD:${urlMatch[1].toUpperCase()}`;
    } else if (/^PM-PEC-\d+$/i.test(raw)) {
      normalized = `PINGME:PROD:${raw.toUpperCase()}`;
    }

    // Profile QR check
    if (normalized.startsWith('PINGME:PROFILE:')) {
      const targetStudentId = normalized.replace('PINGME:PROFILE:', '').trim().toUpperCase();
      const [student] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.studentId, targetStudentId))
        .limit(1);

      if (!student) {
        await db.insert(qrScanLogs).values({
          scannerId,
          scanAction: 'profile_discovery',
          status: 'invalid',
          details: `Unknown student profile QR: ${targetStudentId}`,
        });
        return res.status(404).json({ error: 'Invalid PingME student profile QR code.' });
      }

      await db.insert(qrScanLogs).values({
        scannerId,
        scanAction: 'profile_discovery',
        status: 'success',
        details: `Verified student QR for ${student.fullName}`,
      });

      return res.json({
        type: 'profile',
        profile: serializePublicProfile(student),
      });
    }

    // Handover Transaction QR check
    if (normalized.startsWith('PINGME:HANDOVER:')) {
      const tokenHash = hashQrToken(normalized);
      const [qrRecord] = await db
        .select()
        .from(qrTokens)
        .where(eq(qrTokens.tokenHash, tokenHash))
        .limit(1);

      if (!qrRecord || !qrRecord.transactionId) {
        await db.insert(qrScanLogs).values({
          scannerId,
          scanAction: 'handover_lookup',
          status: 'invalid',
          details: 'Invalid handover QR token scanned.',
        });
        return res.status(404).json({ error: 'Invalid or unknown PingME handover QR code.' });
      }

      if (qrRecord.usedAt) {
        await db.insert(qrScanLogs).values({
          scannerId,
          qrTokenId: qrRecord.id,
          transactionId: qrRecord.transactionId,
          scanAction: qrRecord.tokenType,
          status: 'duplicate',
          details: 'Attempted reuse of single-use handover QR token.',
        });
        return res.status(410).json({ error: 'This handover QR code has already been used.' });
      }

      if (qrRecord.expiresAt && new Date(qrRecord.expiresAt) < new Date()) {
        await db.insert(qrScanLogs).values({
          scannerId,
          qrTokenId: qrRecord.id,
          transactionId: qrRecord.transactionId,
          scanAction: qrRecord.tokenType,
          status: 'expired',
          details: 'Attempted scan of expired handover QR token.',
        });
        return res.status(410).json({
          error: 'This handover QR code has expired. Please ask the counterparty to generate a fresh QR.',
        });
      }

      return res.json({
        type: 'handover',
        tokenType: qrRecord.tokenType,
        transactionId: qrRecord.transactionId,
        rawCode: normalized,
      });
    }

    // Product Discovery QR check
    const tokenHash = hashQrToken(normalized);
    const [qrRecord] = await db
      .select()
      .from(qrTokens)
      .where(eq(qrTokens.tokenHash, tokenHash))
      .limit(1);

    let productRow: typeof products.$inferSelect | undefined;
    if (qrRecord?.productId) {
      const [found] = await db
        .select()
        .from(products)
        .where(eq(products.id, qrRecord.productId))
        .limit(1);
      productRow = found;
    } else if (normalized.startsWith('PINGME:PROD:')) {
      const code = normalized.replace('PINGME:PROD:', '').trim().toUpperCase();
      const [found] = await db
        .select()
        .from(products)
        .where(eq(products.productCode, code))
        .limit(1);
      productRow = found;
    }

    if (!productRow) {
      await db.insert(qrScanLogs).values({
        scannerId,
        scanAction: 'product_discovery',
        status: 'invalid',
        details: `Unrecognized QR or Product ID: ${raw.slice(0, 60)}`,
      });
      return res.status(404).json({
        error: 'Invalid or unrecognized PingME QR code / Product ID.',
      });
    }

    await db.insert(qrScanLogs).values({
      scannerId,
      qrTokenId: qrRecord?.id || null,
      productId: productRow.id,
      scanAction: 'product_discovery',
      status: 'success',
      details: `Discovered ${productRow.productCode} (${productRow.title})`,
    });

    const [hydrated] = await hydrateProducts([productRow]);
    res.json({
      type: 'product',
      product: hydrated,
    });
  } catch (error) {
    console.error('QR resolve error:', error);
    res.status(500).json({ error: 'Unable to validate QR code.' });
  }
});

app.post(
  '/api/qr/transaction/:transactionId/issue',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const [txn] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, req.params.transactionId))
        .limit(1);

      if (!txn) {
        return res.status(404).json({ error: 'Transaction not found.' });
      }

      const userId = req.profile!.id;
      if (txn.sellerId !== userId && txn.buyerId !== userId) {
        return res.status(403).json({
          error: 'Unauthorized: You are not a participant in this transaction.',
        });
      }

      let tokenType: 'handover_collect' | 'handover_return';
      if (['Accepted', 'Booked'].includes(txn.transactionStatus)) {
        if (txn.sellerId !== userId) {
          return res.status(403).json({
            error: 'Only the item owner can generate the collection handover QR.',
          });
        }
        tokenType = 'handover_collect';
      } else if (['Collected', 'Return Pending'].includes(txn.transactionStatus)) {
        tokenType = 'handover_return';
      } else {
        return res.status(400).json({
          error: `Cannot generate handover QR while transaction is "${txn.transactionStatus}".`,
        });
      }

      // Invalidate any previous unused handover tokens for this transaction & type
      await db
        .update(qrTokens)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(
          and(
            eq(qrTokens.transactionId, txn.id),
            eq(qrTokens.tokenType, tokenType)
          )
        );

      const secretPart = generateRandomToken(12).toUpperCase();
      const rawCode = `PINGME:HANDOVER:${txn.transactionCode}:${secretPart}`;
      const tokenHash = hashQrToken(rawCode);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      const [createdToken] = await db
        .insert(qrTokens)
        .values({
          productId: txn.productId,
          transactionId: txn.id,
          tokenHash,
          rawCode,
          tokenType,
          issuedBy: userId,
          expiresAt,
        })
        .returning();

      res.status(201).json({
        qrToken: {
          id: createdToken.id,
          rawCode: createdToken.rawCode,
          tokenType: createdToken.tokenType,
          expiresAt: createdToken.expiresAt,
        },
      });
    } catch (error) {
      console.error('Issue handover QR error:', error);
      res.status(500).json({ error: 'Failed to generate handover QR token.' });
    }
  }
);

app.post('/api/qr/transaction/verify', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      rawCode: z.string().min(5, 'QR code token is required'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid handover QR payload.' });
    }

    const rawCode = parsed.data.rawCode.trim();
    const tokenHash = hashQrToken(rawCode);
    const scannerId = req.profile!.id;

    const [qrRecord] = await db
      .select()
      .from(qrTokens)
      .where(eq(qrTokens.tokenHash, tokenHash))
      .limit(1);

    if (!qrRecord || !qrRecord.transactionId) {
      await db.insert(qrScanLogs).values({
        scannerId,
        scanAction: 'handover_verify',
        status: 'invalid',
        details: 'Attempted verification with unknown QR token.',
      });
      return res.status(404).json({ error: 'Invalid transaction handover QR code.' });
    }

    if (qrRecord.usedAt) {
      await db.insert(qrScanLogs).values({
        scannerId,
        qrTokenId: qrRecord.id,
        transactionId: qrRecord.transactionId,
        scanAction: qrRecord.tokenType,
        status: 'duplicate',
        details: 'Duplicate scan rejected: QR token already redeemed.',
      });
      return res
        .status(409)
        .json({ error: 'Duplicate scan blocked: This QR token was already used.' });
    }

    if (qrRecord.expiresAt && new Date(qrRecord.expiresAt) < new Date()) {
      await db.insert(qrScanLogs).values({
        scannerId,
        qrTokenId: qrRecord.id,
        transactionId: qrRecord.transactionId,
        scanAction: qrRecord.tokenType,
        status: 'expired',
        details: 'Expired handover QR token rejected.',
      });
      return res.status(410).json({
        error: 'Expired QR token: Ask the counterparty to generate a new handover QR.',
      });
    }

    const [txn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, qrRecord.transactionId))
      .limit(1);

    if (!txn) {
      return res.status(404).json({ error: 'Associated transaction not found.' });
    }

    // Strict participant & counterparty authorization
    const isParticipant =
      txn.buyerId === scannerId || txn.sellerId === scannerId;
    if (!isParticipant) {
      await db.insert(qrScanLogs).values({
        scannerId,
        qrTokenId: qrRecord.id,
        transactionId: txn.id,
        scanAction: qrRecord.tokenType,
        status: 'unauthorized',
        details: 'Non-participant attempted to verify transaction QR.',
      });
      return res.status(403).json({
        error: 'Forbidden: You are not authorized for this transaction.',
      });
    }

    if (qrRecord.tokenType === 'handover_collect') {
      if (scannerId !== txn.buyerId) {
        await db.insert(qrScanLogs).values({
          scannerId,
          qrTokenId: qrRecord.id,
          transactionId: txn.id,
          scanAction: 'handover_collect',
          status: 'unauthorized',
          details: 'Only the buyer/renter can scan the owner collection QR.',
        });
        return res.status(403).json({
          error: 'Only the receiving student (buyer/renter) can scan the collection QR.',
        });
      }

      const now = new Date();
      await db
        .update(qrTokens)
        .set({ usedAt: now, usedBy: scannerId })
        .where(eq(qrTokens.id, qrRecord.id));

      const nextTxnStatus =
        txn.transactionType === 'buy' ? 'Completed' : 'Collected';
      const nextProductStatus =
        txn.transactionType === 'buy' ? 'Sold' : 'Currently Rented';

      const [updatedTxn] = await db
        .update(transactions)
        .set({
          transactionStatus: nextTxnStatus,
          collectedAt: now,
          updatedAt: now,
        })
        .where(eq(transactions.id, txn.id))
        .returning();

      await db
        .update(products)
        .set({ availabilityStatus: nextProductStatus, updatedAt: now })
        .where(eq(products.id, txn.productId));

      await db.insert(notifications).values([
        {
          userId: txn.sellerId,
          title: 'Item Collection Verified via QR',
          message: `Transaction ${txn.transactionCode} moved to ${nextTxnStatus} after QR verification.`,
          notificationType: 'qr_handover',
          linkUrl: '/app/transactions',
        },
        {
          userId: txn.buyerId,
          title: 'Collection Confirmed',
          message: `You verified collection for ${txn.transactionCode} via PingME QR.`,
          notificationType: 'qr_handover',
          linkUrl: '/app/transactions',
        },
      ]);

      await db.insert(qrScanLogs).values({
        scannerId,
        qrTokenId: qrRecord.id,
        productId: txn.productId,
        transactionId: txn.id,
        scanAction: 'handover_collect',
        status: 'success',
        details: `Collection verified for ${txn.transactionCode}`,
      });

      if (nextTxnStatus === 'Completed') {
        await processReferralCommissionForTransaction(updatedTxn);
      }

      return res.json({
        verified: true,
        action: 'handover_collect',
        transaction: updatedTxn,
      });
    }

    if (qrRecord.tokenType === 'handover_return') {
      // Counterparty check: issuer cannot self-scan their own return token
      if (qrRecord.issuedBy === scannerId) {
        return res.status(403).json({
          error: 'Counterparty verification required: the other student must scan this return QR.',
        });
      }

      const now = new Date();
      await db
        .update(qrTokens)
        .set({ usedAt: now, usedBy: scannerId })
        .where(eq(qrTokens.id, qrRecord.id));

      const [updatedTxn] = await db
        .update(transactions)
        .set({
          transactionStatus: 'Completed',
          returnedAt: now,
          updatedAt: now,
        })
        .where(eq(transactions.id, txn.id))
        .returning();

      await db
        .update(products)
        .set({ availabilityStatus: 'Available', updatedAt: now })
        .where(eq(products.id, txn.productId));

      await db.insert(notifications).values([
        {
          userId: txn.sellerId,
          title: 'Rental Return Verified via QR',
          message: `${txn.transactionCode} is Returned & Completed. Listing is back Available.`,
          notificationType: 'qr_return',
          linkUrl: '/app/transactions',
        },
        {
          userId: txn.buyerId,
          title: 'Return Confirmed & Deposit Released',
          message: `Return verified for ${txn.transactionCode}. You can now leave a rating.`,
          notificationType: 'qr_return',
          linkUrl: '/app/transactions',
        },
      ]);

      await db.insert(qrScanLogs).values({
        scannerId,
        qrTokenId: qrRecord.id,
        productId: txn.productId,
        transactionId: txn.id,
        scanAction: 'handover_return',
        status: 'success',
        details: `Return verified for ${txn.transactionCode}`,
      });

      await processReferralCommissionForTransaction(updatedTxn);

      return res.json({
        verified: true,
        action: 'handover_return',
        transaction: updatedTxn,
      });
    }

    res.status(400).json({ error: 'Unsupported QR token type.' });
  } catch (error) {
    console.error('Verify handover QR error:', error);
    res.status(500).json({ error: 'Failed to verify handover QR.' });
  }
});

app.get('/api/qr/centre', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.profile!.id;

    const myProducts = await db
      .select()
      .from(products)
      .where(eq(products.sellerId, userId))
      .orderBy(desc(products.createdAt));

    const hydratedProducts = await hydrateProducts(myProducts);

    const activeTxns = await db
      .select()
      .from(transactions)
      .where(
        and(
          or(eq(transactions.buyerId, userId), eq(transactions.sellerId, userId)),
          inArray(transactions.transactionStatus, [
            'Accepted',
            'Booked',
            'Collected',
            'Return Pending',
          ])
        )
      )
      .orderBy(desc(transactions.updatedAt));

    const activeTokens =
      activeTxns.length > 0
        ? await db
            .select()
            .from(qrTokens)
            .where(
              inArray(
                qrTokens.transactionId,
                activeTxns.map((t) => t.id)
              )
            )
            .orderBy(desc(qrTokens.createdAt))
        : [];

    const scanHistory = await db
      .select()
      .from(qrScanLogs)
      .where(eq(qrScanLogs.scannerId, userId))
      .orderBy(desc(qrScanLogs.createdAt))
      .limit(30);

    res.json({
      profileQrPayload: `PINGME:PROFILE:${req.profile!.studentId}`,
      myProducts: hydratedProducts,
      activeTransactions: activeTxns.map((t) => ({
        ...t,
        activeToken:
          activeTokens.find(
            (tok) =>
              tok.transactionId === t.id &&
              !tok.usedAt &&
              (!tok.expiresAt || new Date(tok.expiresAt) > new Date())
          ) || null,
      })),
      scanHistory,
    });
  } catch (error) {
    console.error('QR Centre error:', error);
    res.status(500).json({ error: 'Failed to load QR Centre data.' });
  }
});

// ---------------------------------------------------------------------------
// TRANSACTIONS (BUY, RENT, OFFER)
// ---------------------------------------------------------------------------
app.post('/api/transactions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      productId: z.string().uuid(),
      transactionType: z.enum(['buy', 'rent', 'offer']),
      bookingStart: z.string().optional(),
      bookingEnd: z.string().optional(),
      offerAmount: z.number().int().min(1).optional(),
      notes: z.string().max(400).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid transaction request.' });
    }

    const { productId, transactionType, bookingStart, bookingEnd, offerAmount, notes } =
      parsed.data;

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (product.sellerId === req.profile!.id) {
      return res
        .status(400)
        .json({ error: 'You cannot buy or rent your own listing.' });
    }

    if (product.availabilityStatus !== 'Available') {
      return res.status(409).json({
        error: `This item is currently ${product.availabilityStatus.toLowerCase()}.`,
      });
    }

    let totalAmount = 0;
    let depositAmount = 0;
    let parsedStart: Date | null = null;
    let parsedEnd: Date | null = null;

    if (transactionType === 'buy') {
      if (product.listingType === 'rent') {
        return res.status(400).json({ error: 'This item is available for rent only.' });
      }
      totalAmount = product.sellingPrice || 0;
    } else if (transactionType === 'offer') {
      if (!offerAmount) {
        return res.status(400).json({ error: 'Offer amount in INR is required.' });
      }
      totalAmount = offerAmount;
    } else {
      if (product.listingType === 'sell') {
        return res.status(400).json({ error: 'This item is available for sale only.' });
      }
      if (!bookingStart || !bookingEnd) {
        return res
          .status(400)
          .json({ error: 'Start date and return date are required for rentals.' });
      }
      parsedStart = new Date(bookingStart);
      parsedEnd = new Date(bookingEnd);
      if (
        Number.isNaN(parsedStart.getTime()) ||
        Number.isNaN(parsedEnd.getTime()) ||
        parsedEnd <= parsedStart
      ) {
        return res
          .status(400)
          .json({ error: 'Return date must be after start date.' });
      }

      const days = Math.max(
        1,
        Math.ceil(
          (parsedEnd.getTime() - parsedStart.getTime()) / (1000 * 60 * 60 * 24)
        )
      );

      // Check overlapping bookings
      const existingBookings = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.productId, product.id),
            eq(transactions.transactionType, 'rent'),
            inArray(transactions.transactionStatus, [
              'Accepted',
              'Booked',
              'Collected',
              'Return Pending',
            ])
          )
        );

      const hasOverlap = existingBookings.some((b) => {
        if (!b.bookingStart || !b.bookingEnd) return false;
        return parsedStart! < new Date(b.bookingEnd) && parsedEnd! > new Date(b.bookingStart);
      });

      if (hasOverlap) {
        return res.status(409).json({
          error: 'Selected rental dates overlap with an existing confirmed booking.',
        });
      }

      const dailyRate =
        product.rentalPriceDaily ??
        (product.rentalPriceWeekly ? Math.round(product.rentalPriceWeekly / 7) : null) ??
        (product.rentalPriceMonthly ? Math.round(product.rentalPriceMonthly / 30) : 25);

      if (days >= 28 && product.rentalPriceMonthly) {
        const months = Math.floor(days / 30);
        const remDays = days % 30;
        totalAmount = months * product.rentalPriceMonthly + remDays * dailyRate;
      } else if (days >= 7 && product.rentalPriceWeekly) {
        const weeks = Math.floor(days / 7);
        const remDays = days % 7;
        totalAmount = weeks * product.rentalPriceWeekly + remDays * dailyRate;
      } else {
        totalAmount = days * dailyRate;
      }
      depositAmount = product.securityDeposit;
    }

    const txnCode = `TXN-PEC-${Math.floor(1000 + Math.random() * 8999)}`;

    const [created] = await db
      .insert(transactions)
      .values({
        transactionCode: txnCode,
        productId: product.id,
        buyerId: req.profile!.id,
        sellerId: product.sellerId,
        transactionType,
        bookingStart: parsedStart,
        bookingEnd: parsedEnd,
        totalAmount,
        depositAmount,
        offerAmount: offerAmount ?? null,
        notes: notes?.trim() || null,
        transactionStatus: 'Pending',
      })
      .returning();

    await db.insert(notifications).values({
      userId: product.sellerId,
      title:
        transactionType === 'rent'
          ? 'New Rental Request'
          : transactionType === 'offer'
            ? 'New Price Offer Received'
            : 'New Purchase Request',
      message: `${req.profile!.fullName} requested "${product.title}" (₹${totalAmount}).`,
      notificationType: 'transaction_request',
      linkUrl: '/app/transactions',
    });

    res.status(201).json({ transaction: created });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Failed to submit request.' });
  }
});

app.get('/api/transactions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.profile!.id;
    const rows = await db
      .select()
      .from(transactions)
      .where(
        or(eq(transactions.buyerId, userId), eq(transactions.sellerId, userId))
      )
      .orderBy(desc(transactions.createdAt));

    if (rows.length === 0) {
      return res.json({ transactions: [] });
    }

    const productIds = [...new Set(rows.map((r) => r.productId))];
    const userIds = [
      ...new Set(rows.flatMap((r) => [r.buyerId, r.sellerId])),
    ];
    const txnIds = rows.map((r) => r.id);

    const [prodRows, imgRows, userRows, tokenRows, reviewRows] = await Promise.all([
      db.select().from(products).where(inArray(products.id, productIds)),
      db.select().from(productImages).where(inArray(productImages.productId, productIds)),
      db.select().from(profiles).where(inArray(profiles.id, userIds)),
      db.select().from(qrTokens).where(inArray(qrTokens.transactionId, txnIds)),
      db.select().from(reviews).where(inArray(reviews.transactionId, txnIds)),
    ]);

    const prodMap = new Map(prodRows.map((p) => [p.id, p]));
    const imgMap = new Map<string, string>();
    for (const img of imgRows) {
      if (!imgMap.has(img.productId)) imgMap.set(img.productId, img.imageUrl);
    }
    const userMap = new Map(userRows.map((u) => [u.id, serializePublicProfile(u)]));

    const enriched = rows.map((t) => {
      const prod = prodMap.get(t.productId);
      const activeToken = tokenRows.find(
        (tok) =>
          tok.transactionId === t.id &&
          !tok.usedAt &&
          (!tok.expiresAt || new Date(tok.expiresAt) > new Date())
      );
      const alreadyReviewed = reviewRows.some(
        (rv) => rv.transactionId === t.id && rv.reviewerId === userId
      );
      return {
        ...t,
        product: prod
          ? {
              ...prod,
              imageUrl: imgMap.get(prod.id) || null,
            }
          : null,
        buyer: userMap.get(t.buyerId) || null,
        seller: userMap.get(t.sellerId) || null,
        activeQrToken: activeToken
          ? {
              rawCode: activeToken.rawCode,
              tokenType: activeToken.tokenType,
              expiresAt: activeToken.expiresAt,
            }
          : null,
        alreadyReviewed,
      };
    });

    res.json({ transactions: enriched });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to load transactions.' });
  }
});

app.patch('/api/transactions/:id/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      status: z.enum([
        'Accepted',
        'Rejected',
        'Booked',
        'Return Pending',
        'Returned',
        'Completed',
        'Cancelled',
      ]),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid transaction status.' });
    }

    const [txn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, req.params.id))
      .limit(1);

    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const userId = req.profile!.id;
    const nextStatus = parsed.data.status;

    if (txn.buyerId !== userId && txn.sellerId !== userId && req.profile!.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: You cannot modify this transaction.',
      });
    }

    if (['Accepted', 'Rejected', 'Booked'].includes(nextStatus) && txn.sellerId !== userId) {
      return res.status(403).json({
        error: 'Only the seller/owner can accept or reject requests.',
      });
    }

    const finalStatus =
      nextStatus === 'Accepted' && txn.transactionType === 'rent'
        ? 'Booked'
        : nextStatus;

    const [updated] = await db
      .update(transactions)
      .set({ transactionStatus: finalStatus, updatedAt: new Date() })
      .where(eq(transactions.id, txn.id))
      .returning();

    const counterpartyId = txn.sellerId === userId ? txn.buyerId : txn.sellerId;
    await db.insert(notifications).values({
      userId: counterpartyId,
      title: `Transaction ${finalStatus}`,
      message: `${txn.transactionCode} status updated to ${finalStatus}.`,
      notificationType: 'transaction_update',
      linkUrl: '/app/transactions',
    });

    if (['Completed', 'Returned'].includes(finalStatus)) {
      await processReferralCommissionForTransaction(updated);
    }

    res.json({ transaction: updated });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Failed to update transaction status.' });
  }
});

// ---------------------------------------------------------------------------
// WISHLIST, REVIEWS, MESSAGES, NOTIFICATIONS, REPORTS
// ---------------------------------------------------------------------------
app.get('/api/wishlist', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(wishlists)
      .where(eq(wishlists.userId, req.profile!.id))
      .orderBy(desc(wishlists.createdAt));

    if (rows.length === 0) return res.json({ items: [] });

    const prodRows = await db
      .select()
      .from(products)
      .where(
        inArray(
          products.id,
          rows.map((r) => r.productId)
        )
      );

    const hydrated = await hydrateProducts(prodRows);
    res.json({ items: hydrated });
  } catch (error) {
    console.error('Wishlist get error:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist.' });
  }
});

app.post('/api/wishlist/:productId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const existing = await db
      .select()
      .from(wishlists)
      .where(
        and(
          eq(wishlists.userId, req.profile!.id),
          eq(wishlists.productId, req.params.productId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(wishlists).values({
        userId: req.profile!.id,
        productId: req.params.productId,
      });
    }
    res.status(201).json({ saved: true });
  } catch (error) {
    console.error('Wishlist add error:', error);
    res.status(500).json({ error: 'Unable to add to wishlist.' });
  }
});

app.delete('/api/wishlist/:productId', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .delete(wishlists)
      .where(
        and(
          eq(wishlists.userId, req.profile!.id),
          eq(wishlists.productId, req.params.productId)
        )
      );
    res.json({ saved: false });
  } catch (error) {
    console.error('Wishlist remove error:', error);
    res.status(500).json({ error: 'Unable to remove from wishlist.' });
  }
});

app.post('/api/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      transactionId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().min(3).max(600),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Rating (1-5) and comment are required.' });
    }

    const [txn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, parsed.data.transactionId))
      .limit(1);

    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const userId = req.profile!.id;
    if (txn.buyerId !== userId && txn.sellerId !== userId) {
      return res.status(403).json({
        error: 'Only students involved in this transaction can leave a review.',
      });
    }

    if (!['Completed', 'Returned'].includes(txn.transactionStatus)) {
      return res.status(400).json({
        error: 'Reviews can only be submitted after the transaction is completed.',
      });
    }

    const existing = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.transactionId, txn.id),
          eq(reviews.reviewerId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'You already reviewed this transaction.' });
    }

    const reviewedUserId = txn.buyerId === userId ? txn.sellerId : txn.buyerId;
    const [created] = await db
      .insert(reviews)
      .values({
        transactionId: txn.id,
        reviewerId: userId,
        reviewedUserId,
        rating: parsed.data.rating,
        comment: parsed.data.comment.trim(),
      })
      .returning();

    res.status(201).json({ review: created });
  } catch (error) {
    console.error('Review submit error:', error);
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

app.get('/api/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.profile!.id;
    const rows = await db
      .select()
      .from(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)))
      .orderBy(messages.createdAt);

    const userIds = [
      ...new Set(rows.flatMap((m) => [m.senderId, m.receiverId])),
    ];
    const prodIds = [
      ...new Set(rows.map((m) => m.productId).filter(Boolean) as string[]),
    ];

    const [userRows, prodRows] = await Promise.all([
      userIds.length > 0
        ? db.select().from(profiles).where(inArray(profiles.id, userIds))
        : Promise.resolve([]),
      prodIds.length > 0
        ? db.select().from(products).where(inArray(products.id, prodIds))
        : Promise.resolve([]),
    ]);

    const userMap = new Map(userRows.map((u) => [u.id, serializePublicProfile(u)]));
    const prodMap = new Map(prodRows.map((p) => [p.id, p]));

    res.json({
      messages: rows.map((m) => ({
        ...m,
        sender: userMap.get(m.senderId) || null,
        receiver: userMap.get(m.receiverId) || null,
        product: m.productId ? prodMap.get(m.productId) || null : null,
      })),
    });
  } catch (error) {
    console.error('Messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

app.post('/api/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      receiverId: z.string().uuid(),
      productId: z.string().uuid().optional().nullable(),
      messageText: z.string().min(1).max(1000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Message text and recipient are required.' });
    }

    if (parsed.data.receiverId === req.profile!.id) {
      return res.status(400).json({ error: 'Cannot message yourself.' });
    }

    const [created] = await db
      .insert(messages)
      .values({
        senderId: req.profile!.id,
        receiverId: parsed.data.receiverId,
        productId: parsed.data.productId || null,
        messageText: parsed.data.messageText.trim(),
      })
      .returning();

    await db.insert(notifications).values({
      userId: parsed.data.receiverId,
      title: `Message from ${req.profile!.fullName}`,
      message: parsed.data.messageText.trim().slice(0, 100),
      notificationType: 'message',
      linkUrl: '/app/messages',
    });

    res.status(201).json({ message: created });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

app.get('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.profile!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    res.json({ notifications: rows });
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, req.params.id),
          eq(notifications.userId, req.profile!.id)
        )
      );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, req.profile!.id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark notifications read.' });
  }
});

app.post('/api/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      productId: z.string().uuid().optional().nullable(),
      reportedUserId: z.string().uuid().optional().nullable(),
      reason: z.string().min(5).max(500),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please specify a report reason.' });
    }
    const [created] = await db
      .insert(reports)
      .values({
        reporterId: req.profile!.id,
        productId: parsed.data.productId || null,
        reportedUserId: parsed.data.reportedUserId || null,
        reason: parsed.data.reason.trim(),
      })
      .returning();
    res.status(201).json({ report: created });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Failed to submit report.' });
  }
});

// ---------------------------------------------------------------------------
// ADMIN DASHBOARD (RBAC Protected)
// ---------------------------------------------------------------------------
app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [allUsers, allProducts, allTransactions, allScanLogs, allReports, allCats] =
      await Promise.all([
        db.select().from(profiles).orderBy(desc(profiles.createdAt)),
        db.select().from(products).orderBy(desc(products.createdAt)),
        db.select().from(transactions).orderBy(desc(transactions.createdAt)),
        db.select().from(qrScanLogs).orderBy(desc(qrScanLogs.createdAt)).limit(50),
        db.select().from(reports).orderBy(desc(reports.createdAt)),
        db.select().from(categories).orderBy(categories.id),
      ]);

    res.json({
      users: allUsers.map(serializeOwnProfile),
      products: await hydrateProducts(allProducts),
      transactions: allTransactions,
      qrScanLogs: allScanLogs,
      reports: allReports,
      categories: allCats,
      stats: {
        totalUsers: allUsers.length,
        verifiedUsers: allUsers.filter((u) => u.verificationStatus === 'verified').length,
        pendingUsers: allUsers.filter((u) => u.verificationStatus === 'pending').length,
        totalProducts: allProducts.length,
        totalTransactions: allTransactions.length,
        totalQrScans: allScanLogs.length,
        openReports: allReports.filter((r) => r.status === 'open').length,
      },
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to load admin overview.' });
  }
});

app.patch('/api/admin/users/:id/verify', requireAuth, requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      status: z.enum(['verified', 'pending', 'rejected']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid verification status.' });
    }
    const [updated] = await db
      .update(profiles)
      .set({ verificationStatus: parsed.data.status })
      .where(eq(profiles.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'User not found.' });

    await db.insert(notifications).values({
      userId: updated.id,
      title: `Verification ${parsed.data.status === 'verified' ? 'Approved' : 'Updated'}`,
      message:
        parsed.data.status === 'verified'
          ? 'Your PEC student verification badge is now active across PingME.'
          : `Your verification status was updated to ${parsed.data.status}.`,
      notificationType: 'account',
      linkUrl: '/app/profile',
    });

    res.json({ user: serializeOwnProfile(updated) });
  } catch (error) {
    console.error('Admin verify user error:', error);
    res.status(500).json({ error: 'Failed to update user verification.' });
  }
});

app.patch('/api/admin/reports/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      status: z.enum(['open', 'resolved', 'dismissed']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid report status.' });
    }
    const [updated] = await db
      .update(reports)
      .set({ status: parsed.data.status })
      .where(eq(reports.id, req.params.id))
      .returning();
    res.json({ report: updated });
  } catch (error) {
    console.error('Admin report update error:', error);
    res.status(500).json({ error: 'Failed to update report.' });
  }
});

// ---------------------------------------------------------------------------
// EATERIES & TAKEAWAY MODULE
// ---------------------------------------------------------------------------
async function recalculateShopRating(shopId: string) {
  const allRevs = await db
    .select()
    .from(shopReviews)
    .where(eq(shopReviews.shopId, shopId));
  const counted = allRevs.filter((r) => r.moderationStatus !== 'hidden');
  const count = counted.length;
  const avg =
    count > 0
      ? Number(
          (counted.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1)
        )
      : 0;
  await db
    .update(shops)
    .set({ averageRating: avg, reviewCount: count })
    .where(eq(shops.id, shopId));
  return { averageRating: avg, reviewCount: count };
}

async function expireStaleRestrictions(studentId?: string) {
  const now = new Date();
  const activeRows = studentId
    ? await db
        .select()
        .from(accountRestrictions)
        .where(
          and(
            eq(accountRestrictions.studentId, studentId),
            eq(accountRestrictions.restrictionStatus, 'active')
          )
        )
    : await db
        .select()
        .from(accountRestrictions)
        .where(eq(accountRestrictions.restrictionStatus, 'active'));

  for (const r of activeRows) {
    if (r.expiresAt && new Date(r.expiresAt) <= now) {
      await db
        .update(accountRestrictions)
        .set({ restrictionStatus: 'expired' })
        .where(eq(accountRestrictions.id, r.id));
    }
  }
}

const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  Pending: ['Accepted', 'Rejected'],
  Accepted: ['Preparing', 'Rejected'],
  Preparing: ['Ready for Pickup'],
  'Ready for Pickup': ['Collected'],
};

app.get('/api/shops', async (_req, res) => {
  try {
    const [allShops, allMenu] = await Promise.all([
      db.select().from(shops).orderBy(shops.name),
      db.select().from(menuItems),
    ]);

    const menuStats = new Map<string, { total: number; available: number }>();
    for (const m of allMenu) {
      const cur = menuStats.get(m.shopId) || { total: 0, available: 0 };
      cur.total += 1;
      if (m.isAvailable) cur.available += 1;
      menuStats.set(m.shopId, cur);
    }

    res.json({
      shops: allShops.map((s) => ({
        ...s,
        menuCount: menuStats.get(s.id)?.total || 0,
        availableItemCount: menuStats.get(s.id)?.available || 0,
      })),
    });
  } catch (error) {
    console.error('Get shops error:', error);
    res.status(500).json({ error: 'Failed to load campus eateries.' });
  }
});

app.get('/api/shops/:idOrSlug', async (req, res) => {
  try {
    const key = req.params.idOrSlug.trim();
    const sort = (req.query.sort as string) || 'newest';
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

    const [shop] = await db
      .select()
      .from(shops)
      .where(isUuid ? eq(shops.id, key) : eq(shops.slug, key.toLowerCase()))
      .limit(1);

    if (!shop) {
      return res.status(404).json({ error: 'Campus eatery not found.' });
    }

    const [items, rawReviews] = await Promise.all([
      db
        .select()
        .from(menuItems)
        .where(eq(menuItems.shopId, shop.id))
        .orderBy(menuItems.category, menuItems.name),
      db
        .select()
        .from(shopReviews)
        .where(eq(shopReviews.shopId, shop.id))
        .orderBy(desc(shopReviews.createdAt)),
    ]);

    const publicReviews = rawReviews.filter((r) => r.moderationStatus !== 'hidden');
    if (sort === 'highest') {
      publicReviews.sort(
        (a, b) =>
          b.rating - a.rating ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    const studentIds = [...new Set(publicReviews.map((r) => r.studentId))];
    const studentMap = new Map<string, ReturnType<typeof serializePublicProfile>>();
    if (studentIds.length > 0) {
      const students = await db
        .select()
        .from(profiles)
        .where(inArray(profiles.id, studentIds));
      for (const st of students) {
        studentMap.set(st.id, serializePublicProfile(st));
      }
    }

    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of publicReviews) {
      if (distribution[r.rating] !== undefined) {
        distribution[r.rating] += 1;
      }
    }

    res.json({
      shop,
      menuItems: items,
      reviews: publicReviews.map((r) => ({
        ...r,
        student: studentMap.get(r.studentId) || null,
      })),
      ratingDistribution: distribution,
      hiddenReviewCount: rawReviews.length - publicReviews.length,
    });
  } catch (error) {
    console.error('Get shop detail error:', error);
    res.status(500).json({ error: 'Failed to load eatery menu and reviews.' });
  }
});

// Place takeaway order (server validates items, availability, restrictions, idempotency & pricing)
app.post('/api/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      shopId: z.string().uuid('Valid eatery selection is required'),
      items: z
        .array(
          z.object({
            menuItemId: z.string().uuid(),
            quantity: z.number().int().min(1).max(20),
          })
        )
        .min(1, 'Cart cannot be empty'),
      notes: z.string().max(300).optional(),
      idempotencyKey: z.string().min(6).max(120).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid takeaway order payload.',
      });
    }

    const userId = req.profile!.id;
    const { shopId, items: requestedItems, notes, idempotencyKey } = parsed.data;

    // 1. Check active unexpired restrictions for this student
    await expireStaleRestrictions(userId);
    const activeRestrictions = await db
      .select()
      .from(accountRestrictions)
      .where(
        and(
          eq(accountRestrictions.studentId, userId),
          eq(accountRestrictions.restrictionStatus, 'active')
        )
      )
      .limit(1);

    if (activeRestrictions.length > 0) {
      const rest = activeRestrictions[0];
      const expiryMsg = rest.expiresAt
        ? ` until ${new Date(rest.expiresAt).toLocaleDateString('en-IN')}`
        : '';
      return res.status(403).json({
        error: `Ordering temporarily restricted${expiryMsg}: ${rest.reason}. You may submit an appeal from My Food Orders.`,
        restriction: rest,
      });
    }

    // 2. Prevent duplicate order submission via idempotencyKey
    if (idempotencyKey) {
      const [existingByKey] = await db
        .select()
        .from(orders)
        .where(eq(orders.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existingByKey) {
        return res.status(409).json({
          error: 'Duplicate order submission detected. Your order has already been placed.',
          order: existingByKey,
        });
      }
    }

    // 3. Validate shop exists and is currently open/active
    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, shopId))
      .limit(1);

    if (!shop) {
      return res.status(404).json({ error: 'Selected eatery not found.' });
    }
    if (!shop.isActive) {
      return res.status(400).json({
        error: `${shop.name} is currently closed and not accepting takeaway orders.`,
      });
    }

    // 4. Validate all items belong to shop, are available, and calculate total strictly from DB prices
    const requestedIds = [...new Set(requestedItems.map((i) => i.menuItemId))];
    const dbItems = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.shopId, shop.id), inArray(menuItems.id, requestedIds)));

    const itemMap = new Map(dbItems.map((i) => [i.id, i]));
    const aggregatedQty = new Map<string, number>();
    for (const reqItem of requestedItems) {
      aggregatedQty.set(
        reqItem.menuItemId,
        (aggregatedQty.get(reqItem.menuItemId) || 0) + reqItem.quantity
      );
    }

    const snapshotItems: OrderSnapshotItem[] = [];
    let totalAmount = 0;

    for (const [menuItemId, quantity] of aggregatedQty.entries()) {
      const dbItem = itemMap.get(menuItemId);
      if (!dbItem) {
        return res.status(400).json({
          error: 'One or more items do not belong to the selected eatery.',
        });
      }
      if (!dbItem.isAvailable) {
        return res.status(400).json({
          error: `"${dbItem.name}" is currently unavailable. Please remove it from your cart.`,
        });
      }
      if (quantity < 1 || quantity > 20) {
        return res.status(400).json({
          error: `Quantity for "${dbItem.name}" must be between 1 and 20.`,
        });
      }
      const subtotal = dbItem.price * quantity;
      totalAmount += subtotal;
      snapshotItems.push({
        menuItemId: dbItem.id,
        name: dbItem.name,
        price: dbItem.price,
        quantity,
        subtotal,
        dietaryLabel: dbItem.dietaryLabel,
      });
    }

    const orderCode = `ORD-PEC-${Math.floor(1000 + Math.random() * 8999)}`;

    const [createdOrder] = await db
      .insert(orders)
      .values({
        orderCode,
        studentId: userId,
        shopId: shop.id,
        items: snapshotItems,
        totalAmount,
        status: 'Pending',
        notes: notes?.trim() || null,
        idempotencyKey: idempotencyKey || null,
      })
      .returning();

    await db.insert(notifications).values({
      userId: shop.ownerId,
      title: `New Takeaway Order ${orderCode}`,
      message: `${req.profile!.fullName} placed a takeaway order worth ₹${totalAmount} (${snapshotItems.length} item${snapshotItems.length > 1 ? 's' : ''}).`,
      notificationType: 'eatery_order',
      linkUrl: '/app/shop-dashboard',
    });

    res.status(201).json({ order: createdOrder, shop });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Unable to place takeaway order.' });
  }
});

app.get('/api/orders/mine', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.profile!.id;
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.studentId, userId))
      .orderBy(desc(orders.createdAt));

    if (rows.length === 0) {
      return res.json({ orders: [] });
    }

    const shopIds = [...new Set(rows.map((o) => o.shopId))];
    const orderIds = rows.map((o) => o.id);

    const [shopRows, reviewRows] = await Promise.all([
      db.select().from(shops).where(inArray(shops.id, shopIds)),
      db.select().from(shopReviews).where(inArray(shopReviews.orderId, orderIds)),
    ]);

    const shopMap = new Map(shopRows.map((s) => [s.id, s]));
    const reviewedSet = new Set(reviewRows.map((r) => r.orderId));

    res.json({
      orders: rows.map((o) => ({
        ...o,
        shop: shopMap.get(o.shopId) || null,
        alreadyReviewed: reviewedSet.has(o.id),
      })),
    });
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({ error: 'Failed to load your food orders.' });
  }
});

app.patch('/api/orders/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      cancellationReason: z
        .string()
        .min(3, 'Please provide a brief reason for cancellation')
        .max(300),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Cancellation reason is required.',
      });
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, req.params.id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.studentId !== req.profile!.id) {
      return res
        .status(403)
        .json({ error: 'Forbidden: You can only cancel your own orders.' });
    }
    if (!['Pending', 'Accepted', 'Preparing'].includes(order.status)) {
      return res.status(400).json({
        error: `Cannot cancel order once status is "${order.status}".`,
      });
    }

    const [updated] = await db
      .update(orders)
      .set({
        status: 'Cancelled',
        cancellationReason: parsed.data.cancellationReason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id))
      .returning();

    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, order.shopId))
      .limit(1);

    if (shop) {
      await db.insert(notifications).values({
        userId: shop.ownerId,
        title: `Order ${order.orderCode} Cancelled`,
        message: `${req.profile!.fullName} cancelled ${order.orderCode}: ${parsed.data.cancellationReason.trim()}`,
        notificationType: 'eatery_order_update',
        linkUrl: '/app/shop-dashboard',
      });
    }

    res.json({ order: updated });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Unable to cancel order.' });
  }
});

app.post('/api/shop-reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      orderId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(600).optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Please select a star rating between 1 and 5.' });
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, parsed.data.orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.studentId !== req.profile!.id) {
      return res
        .status(403)
        .json({ error: 'Forbidden: Only the ordering student can review this order.' });
    }
    if (order.status !== 'Collected') {
      return res.status(400).json({
        error: 'Verified reviews can only be submitted after your order is Collected.',
      });
    }

    const [existingReview] = await db
      .select()
      .from(shopReviews)
      .where(eq(shopReviews.orderId, order.id))
      .limit(1);

    if (existingReview) {
      return res
        .status(409)
        .json({ error: 'You have already submitted a review for this order.' });
    }

    const [created] = await db
      .insert(shopReviews)
      .values({
        shopId: order.shopId,
        studentId: req.profile!.id,
        orderId: order.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment.trim(),
        moderationStatus: 'visible',
      })
      .returning();

    const stats = await recalculateShopRating(order.shopId);

    res.status(201).json({ review: created, shopStats: stats });
  } catch (error) {
    console.error('Submit shop review error:', error);
    res.status(500).json({ error: 'Failed to submit shop review.' });
  }
});

app.get('/api/restrictions/mine', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.profile!.id;
    await expireStaleRestrictions(userId);
    const rows = await db
      .select()
      .from(accountRestrictions)
      .where(eq(accountRestrictions.studentId, userId))
      .orderBy(desc(accountRestrictions.createdAt));

    const shopIds = [
      ...new Set(rows.map((r) => r.shopId).filter(Boolean) as string[]),
    ];
    const shopRows =
      shopIds.length > 0
        ? await db.select().from(shops).where(inArray(shops.id, shopIds))
        : [];
    const shopMap = new Map(shopRows.map((s) => [s.id, s.name]));

    res.json({
      restrictions: rows.map((r) => ({
        ...r,
        shopName: r.shopId ? shopMap.get(r.shopId) || 'Campus Eatery' : 'Campus Eateries',
      })),
    });
  } catch (error) {
    console.error('Get my restrictions error:', error);
    res.status(500).json({ error: 'Failed to load account reliability notices.' });
  }
});

app.post('/api/restrictions/:id/appeal', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      appealNote: z
        .string()
        .min(10, 'Please explain your appeal clearly (min 10 characters)')
        .max(600),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Appeal explanation is required.',
      });
    }

    const [restriction] = await db
      .select()
      .from(accountRestrictions)
      .where(eq(accountRestrictions.id, req.params.id))
      .limit(1);

    if (!restriction) {
      return res.status(404).json({ error: 'Restriction record not found.' });
    }
    if (restriction.studentId !== req.profile!.id) {
      return res
        .status(403)
        .json({ error: 'Forbidden: You can only appeal your own account notices.' });
    }
    if (!['pending_review', 'active'].includes(restriction.restrictionStatus)) {
      return res
        .status(400)
        .json({ error: 'Only pending or active restrictions can be appealed.' });
    }
    if (restriction.appealStatus === 'submitted') {
      return res
        .status(409)
        .json({ error: 'An appeal has already been submitted for this notice.' });
    }

    const [updated] = await db
      .update(accountRestrictions)
      .set({
        appealStatus: 'submitted',
        appealNote: parsed.data.appealNote.trim(),
      })
      .where(eq(accountRestrictions.id, restriction.id))
      .returning();

    await db.insert(moderationLogs).values({
      actorId: req.profile!.id,
      targetStudentId: req.profile!.id,
      targetShopId: restriction.shopId,
      action: 'student_appeal_submitted',
      reason: parsed.data.appealNote.trim(),
    });

    const admins = await db
      .select()
      .from(profiles)
      .where(eq(profiles.role, 'admin'));
    for (const adm of admins) {
      await db.insert(notifications).values({
        userId: adm.id,
        title: 'Restriction Appeal Submitted',
        message: `${req.profile!.fullName} (${maskStudentId(req.profile!.studentId)}) appealed an eatery restriction.`,
        notificationType: 'moderation',
        linkUrl: '/app/admin',
      });
    }

    res.json({ restriction: updated });
  } catch (error) {
    console.error('Appeal error:', error);
    res.status(500).json({ error: 'Unable to submit appeal.' });
  }
});

// ---------------------------------------------------------------------------
// SHOP OWNER DASHBOARD (RBAC + Per-Shop Isolation)
// ---------------------------------------------------------------------------
async function resolveOwnerShop(
  req: AuthRequest,
  requestedShopId?: string | null
): Promise<
  | { shop: typeof shops.$inferSelect; ownedShops: (typeof shops.$inferSelect)[]; error?: undefined }
  | { shop?: undefined; ownedShops?: undefined; status: number; error: string }
> {
  const user = req.profile!;
  const ownedShops =
    user.role === 'admin'
      ? await db.select().from(shops).orderBy(shops.name)
      : await db
          .select()
          .from(shops)
          .where(eq(shops.ownerId, user.id))
          .orderBy(shops.name);

  if (ownedShops.length === 0) {
    return {
      status: 404,
      error: 'No participating campus eatery is assigned to this account.',
    };
  }

  if (requestedShopId) {
    const match = ownedShops.find((s) => s.id === requestedShopId);
    if (!match) {
      return {
        status: 403,
        error: 'Forbidden: You may only manage your own campus eatery.',
      };
    }
    return { shop: match, ownedShops };
  }

  return { shop: ownedShops[0], ownedShops };
}

app.get(
  '/api/shop-dashboard',
  requireAuth,
  requireShopOwner,
  async (req: AuthRequest, res) => {
    try {
      const requestedShopId = (req.query.shopId as string) || null;
      const resolved = await resolveOwnerShop(req, requestedShopId);
      if (resolved.error || !resolved.shop) {
        return res.status(resolved.status || 403).json({ error: resolved.error });
      }

      const shop = resolved.shop;
      await expireStaleRestrictions();

      const [shopMenu, shopOrders, rawReviews, shopRestrictions] =
        await Promise.all([
          db
            .select()
            .from(menuItems)
            .where(eq(menuItems.shopId, shop.id))
            .orderBy(menuItems.category, menuItems.name),
          db
            .select()
            .from(orders)
            .where(eq(orders.shopId, shop.id))
            .orderBy(desc(orders.createdAt)),
          db
            .select()
            .from(shopReviews)
            .where(eq(shopReviews.shopId, shop.id))
            .orderBy(desc(shopReviews.createdAt)),
          db
            .select()
            .from(accountRestrictions)
            .where(eq(accountRestrictions.shopId, shop.id))
            .orderBy(desc(accountRestrictions.createdAt)),
        ]);

      const studentIds = [
        ...new Set([
          ...shopOrders.map((o) => o.studentId),
          ...rawReviews.map((r) => r.studentId),
          ...shopRestrictions.map((r) => r.studentId),
        ]),
      ];

      const studentRows =
        studentIds.length > 0
          ? await db
              .select()
              .from(profiles)
              .where(inArray(profiles.id, studentIds))
          : [];
      const studentMap = new Map(
        studentRows.map((s) => [s.id, serializePublicProfile(s)])
      );

      // Compute per-student order reliability summary at this shop (private to owner/admin)
      const reliabilityMap = new Map<
        string,
        {
          totalOrders: number;
          collectedCount: number;
          incidentCount: number;
          incidentCodes: string[];
        }
      >();
      for (const o of shopOrders) {
        const cur = reliabilityMap.get(o.studentId) || {
          totalOrders: 0,
          collectedCount: 0,
          incidentCount: 0,
          incidentCodes: [],
        };
        cur.totalOrders += 1;
        if (o.status === 'Collected') cur.collectedCount += 1;
        if (['Cancelled', 'Rejected'].includes(o.status)) {
          cur.incidentCount += 1;
          cur.incidentCodes.push(`${o.orderCode} (${o.status})`);
        }
        reliabilityMap.set(o.studentId, cur);
      }

      const visibleReviews = rawReviews.filter(
        (r) => r.moderationStatus !== 'hidden'
      );
      const distribution: Record<number, number> = {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      };
      for (const r of visibleReviews) {
        if (distribution[r.rating] !== undefined) distribution[r.rating] += 1;
      }

      res.json({
        shop,
        ownedShops: resolved.ownedShops,
        menuItems: shopMenu,
        orders: shopOrders.map((o) => ({
          ...o,
          student: studentMap.get(o.studentId) || null,
          studentReliability: reliabilityMap.get(o.studentId) || {
            totalOrders: 0,
            collectedCount: 0,
            incidentCount: 0,
            incidentCodes: [],
          },
        })),
        reviews: visibleReviews.map((r) => ({
          ...r,
          student: studentMap.get(r.studentId) || null,
        })),
        ratingDistribution: distribution,
        flaggedAccounts: shopRestrictions.map((r) => ({
          ...r,
          student: studentMap.get(r.studentId) || null,
          reliability: reliabilityMap.get(r.studentId) || null,
        })),
      });
    } catch (error) {
      console.error('Shop dashboard error:', error);
      res.status(500).json({ error: 'Failed to load shop owner dashboard.' });
    }
  }
);

app.patch(
  '/api/shop-dashboard/shop',
  requireAuth,
  requireShopOwner,
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        shopId: z.string().uuid().optional(),
        isActive: z.boolean().optional(),
        openingHours: z.string().min(3).max(80).optional(),
        prepTime: z.string().min(2).max(50).optional(),
        paymentProcessNote: z.string().min(5).max(300).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid shop settings payload.' });
      }
      const { shopId, ...updates } = parsed.data;
      const resolved = await resolveOwnerShop(req, shopId);
      if (resolved.error || !resolved.shop) {
        return res.status(resolved.status || 403).json({ error: resolved.error });
      }

      const [updated] = await db
        .update(shops)
        .set(updates)
        .where(eq(shops.id, resolved.shop.id))
        .returning();
      res.json({ shop: updated });
    } catch (error) {
      console.error('Update shop settings error:', error);
      res.status(500).json({ error: 'Failed to update shop settings.' });
    }
  }
);

app.post(
  '/api/shop-dashboard/menu',
  requireAuth,
  requireShopOwner,
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        shopId: z.string().uuid().optional(),
        name: z.string().min(2, 'Item name is required').max(100),
        description: z.string().min(4, 'Item description is required').max(400),
        price: z.number().int().min(1, 'Price in INR must be positive').max(5000),
        category: z.enum(['Snacks', 'Meals', 'Beverages', 'Other items']),
        dietaryLabel: z.string().max(30).optional().default('Veg'),
        imageUrl: z.string().min(1).optional(),
        isAvailable: z.boolean().optional().default(true),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Invalid menu item payload.',
        });
      }

      const { shopId, ...fields } = parsed.data;
      const resolved = await resolveOwnerShop(req, shopId);
      if (resolved.error || !resolved.shop) {
        return res.status(resolved.status || 403).json({ error: resolved.error });
      }

      const defaultImage =
        fields.category === 'Beverages'
          ? '/src/assets/images/food_beverages_coffee_1794617819150.jpg'
          : fields.category === 'Meals'
            ? '/src/assets/images/food_meals_thali_1794617819553.jpg'
            : '/src/assets/images/food_snacks_combo_1794617818371.jpg';

      const [created] = await db
        .insert(menuItems)
        .values({
          shopId: resolved.shop.id,
          name: fields.name.trim(),
          description: fields.description.trim(),
          price: fields.price,
          category: fields.category,
          dietaryLabel: fields.dietaryLabel || 'Veg',
          imageUrl: fields.imageUrl?.trim() || defaultImage,
          isAvailable: fields.isAvailable,
        })
        .returning();

      res.status(201).json({ menuItem: created });
    } catch (error) {
      console.error('Create menu item error:', error);
      res.status(500).json({ error: 'Failed to create menu item.' });
    }
  }
);

app.patch(
  '/api/shop-dashboard/menu/:id',
  requireAuth,
  requireShopOwner,
  async (req: AuthRequest, res) => {
    try {
      const [existing] = await db
        .select()
        .from(menuItems)
        .where(eq(menuItems.id, req.params.id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: 'Menu item not found.' });
      }

      const resolved = await resolveOwnerShop(req, existing.shopId);
      if (resolved.error) {
        return res.status(resolved.status || 403).json({ error: resolved.error });
      }

      const schema = z.object({
        name: z.string().min(2).max(100).optional(),
        description: z.string().min(4).max(400).optional(),
        price: z.number().int().min(1).max(5000).optional(),
        category: z.enum(['Snacks', 'Meals', 'Beverages', 'Other items']).optional(),
        dietaryLabel: z.string().max(30).optional(),
        imageUrl: z.string().min(1).optional(),
        isAvailable: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid menu update payload.' });
      }

      const [updated] = await db
        .update(menuItems)
        .set({
          ...parsed.data,
          updatedAt: new Date(),
        })
        .where(eq(menuItems.id, existing.id))
        .returning();

      res.json({ menuItem: updated });
    } catch (error) {
      console.error('Update menu item error:', error);
      res.status(500).json({ error: 'Failed to update menu item.' });
    }
  }
);

app.delete(
  '/api/shop-dashboard/menu/:id',
  requireAuth,
  requireShopOwner,
  async (req: AuthRequest, res) => {
    try {
      const [existing] = await db
        .select()
        .from(menuItems)
        .where(eq(menuItems.id, req.params.id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: 'Menu item not found.' });
      }

      const resolved = await resolveOwnerShop(req, existing.shopId);
      if (resolved.error) {
        return res.status(resolved.status || 403).json({ error: resolved.error });
      }

      await db.delete(menuItems).where(eq(menuItems.id, existing.id));
      res.json({ deleted: true });
    } catch (error) {
      console.error('Delete menu item error:', error);
      res.status(500).json({ error: 'Failed to remove menu item.' });
    }
  }
);

app.patch(
  '/api/shop-dashboard/orders/:id/status',
  requireAuth,
  requireShopOwner,
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        status: z.enum([
          'Accepted',
          'Preparing',
          'Ready for Pickup',
          'Collected',
          'Rejected',
        ]),
        cancellationReason: z.string().max(300).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid order status update.' });
      }

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, req.params.id))
        .limit(1);

      if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      const resolved = await resolveOwnerShop(req, order.shopId);
      if (resolved.error || !resolved.shop) {
        return res.status(resolved.status || 403).json({ error: resolved.error });
      }

      const allowedNext = VALID_ORDER_TRANSITIONS[order.status] || [];
      if (!allowedNext.includes(parsed.data.status)) {
        return res.status(400).json({
          error: `Invalid order transition from "${order.status}" to "${parsed.data.status}".`,
        });
      }

      if (
        parsed.data.status === 'Rejected' &&
        (!parsed.data.cancellationReason || parsed.data.cancellationReason.trim().length < 3)
      ) {
        return res.status(400).json({
          error: 'Please provide a clear rejection reason for the student.',
        });
      }

      const [updated] = await db
        .update(orders)
        .set({
          status: parsed.data.status,
          cancellationReason:
            parsed.data.status === 'Rejected'
              ? parsed.data.cancellationReason!.trim()
              : order.cancellationReason,
          pickupConfirmedAt:
            parsed.data.status === 'Collected' ? new Date() : order.pickupConfirmedAt,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id))
        .returning();

      await db.insert(notifications).values({
        userId: order.studentId,
        title: `Order ${order.orderCode}: ${parsed.data.status}`,
        message:
          parsed.data.status === 'Ready for Pickup'
            ? `Your takeaway order from ${resolved.shop.name} is ready for pickup at ${resolved.shop.location}.`
            : parsed.data.status === 'Rejected'
              ? `${resolved.shop.name} rejected order ${order.orderCode}: ${parsed.data.cancellationReason?.trim()}`
              : parsed.data.status === 'Collected'
                ? `Order ${order.orderCode} collected. You can now leave a verified review for ${resolved.shop.name}.`
                : `${resolved.shop.name} updated your order ${order.orderCode} to ${parsed.data.status}.`,
        notificationType: 'eatery_order_update',
        linkUrl: '/app/orders',
      });

      res.json({ order: updated });
    } catch (error) {
      console.error('Shop order status error:', error);
      res.status(500).json({ error: 'Failed to update order status.' });
    }
  }
);

app.post(
  '/api/shop-dashboard/restrictions/flag',
  requireAuth,
  requireShopOwner,
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        shopId: z.string().uuid().optional(),
        studentId: z.string().uuid(),
        reason: z
          .string()
          .min(10, 'Provide a documented reason (min 10 characters)')
          .max(500),
        evidenceReference: z
          .string()
          .min(3, 'Reference specific Order IDs as evidence')
          .max(300),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Invalid flag payload.',
        });
      }

      const resolved = await resolveOwnerShop(req, parsed.data.shopId);
      if (resolved.error || !resolved.shop) {
        return res.status(resolved.status || 403).json({ error: resolved.error });
      }

      // Check documented incident count at this shop: NEVER allow flagging after 1 incident
      const studentOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.shopId, resolved.shop.id),
            eq(orders.studentId, parsed.data.studentId)
          )
        );

      const documentedIncidents = studentOrders.filter(
        (o) =>
          o.status === 'Cancelled' ||
          o.status === 'Rejected' ||
          (o.status === 'Ready for Pickup' &&
            Date.now() - new Date(o.updatedAt).getTime() > 2 * 60 * 60 * 1000)
      );

      if (documentedIncidents.length < 2) {
        return res.status(400).json({
          error:
            'Cannot flag a student account after a single incident. At least 2 documented cancelled, rejected, or uncollected orders at your shop are required.',
        });
      }

      // Check if an open pending_review or active restriction already exists for this shop & student
      const existingOpen = await db
        .select()
        .from(accountRestrictions)
        .where(
          and(
            eq(accountRestrictions.studentId, parsed.data.studentId),
            eq(accountRestrictions.shopId, resolved.shop.id),
            inArray(accountRestrictions.restrictionStatus, ['pending_review', 'active'])
          )
        )
        .limit(1);

      if (existingOpen.length > 0) {
        return res.status(409).json({
          error:
            'An open review or active restriction already exists for this student at your shop.',
        });
      }

      // Requires Admin review before becoming an active restriction
      const [created] = await db
        .insert(accountRestrictions)
        .values({
          studentId: parsed.data.studentId,
          shopId: resolved.shop.id,
          flaggedBy: req.profile!.id,
          reason: parsed.data.reason.trim(),
          evidenceReference: parsed.data.evidenceReference.trim(),
          restrictionStatus: 'pending_review',
          appealStatus: 'none',
        })
        .returning();

      await db.insert(moderationLogs).values({
        actorId: req.profile!.id,
        targetStudentId: parsed.data.studentId,
        targetShopId: resolved.shop.id,
        action: 'shop_flagged_student',
        reason: `${parsed.data.reason.trim()} | Evidence: ${parsed.data.evidenceReference.trim()}`,
      });

      const admins = await db
        .select()
        .from(profiles)
        .where(eq(profiles.role, 'admin'));
      for (const adm of admins) {
        await db.insert(notifications).values({
          userId: adm.id,
          title: 'Account Flagged for Admin Review',
          message: `${resolved.shop.name} flagged a student account (${documentedIncidents.length} incidents) for review.`,
          notificationType: 'moderation',
          linkUrl: '/app/admin',
        });
      }

      await db.insert(notifications).values({
        userId: parsed.data.studentId,
        title: 'Account Order Reliability Notice',
        message: `${resolved.shop.name} flagged repeated order issues for admin review. You can view details or submit an explanation in My Food Orders.`,
        notificationType: 'moderation',
        linkUrl: '/app/orders',
      });

      res.status(201).json({ restriction: created });
    } catch (error) {
      console.error('Flag student error:', error);
      res.status(500).json({ error: 'Failed to submit student account flag.' });
    }
  }
);

// ---------------------------------------------------------------------------
// ADMIN EATERIES MODERATION & AUDIT LOGS
// ---------------------------------------------------------------------------
app.get('/api/admin/eateries', requireAuth, requireAdmin, async (_req, res) => {
  try {
    await expireStaleRestrictions();

    const [allRestrictions, allReviews, allLogs, allShops, allProfiles] =
      await Promise.all([
        db
          .select()
          .from(accountRestrictions)
          .orderBy(desc(accountRestrictions.createdAt)),
        db.select().from(shopReviews).orderBy(desc(shopReviews.createdAt)),
        db.select().from(moderationLogs).orderBy(desc(moderationLogs.timestamp)).limit(100),
        db.select().from(shops),
        db.select().from(profiles),
      ]);

    const shopMap = new Map(allShops.map((s) => [s.id, s]));
    const profileMap = new Map(allProfiles.map((p) => [p.id, serializeOwnProfile(p)]));

    res.json({
      restrictions: allRestrictions.map((r) => ({
        ...r,
        student: profileMap.get(r.studentId) || null,
        shopName: r.shopId ? shopMap.get(r.shopId)?.name || 'Campus Eatery' : 'Campus Eateries',
        flaggedByUser: profileMap.get(r.flaggedBy) || null,
        reviewedByUser: r.reviewedBy ? profileMap.get(r.reviewedBy) || null : null,
      })),
      shopReviews: allReviews.map((rv) => ({
        ...rv,
        shopName: shopMap.get(rv.shopId)?.name || 'Campus Eatery',
        student: profileMap.get(rv.studentId) || null,
      })),
      moderationLogs: allLogs.map((log) => ({
        ...log,
        actor: profileMap.get(log.actorId) || null,
        targetStudent: log.targetStudentId
          ? profileMap.get(log.targetStudentId) || null
          : null,
        targetShopName: log.targetShopId
          ? shopMap.get(log.targetShopId)?.name || null
          : null,
      })),
    });
  } catch (error) {
    console.error('Admin eateries moderation error:', error);
    res.status(500).json({ error: 'Failed to load eateries moderation data.' });
  }
});

app.patch(
  '/api/admin/restrictions/:id',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        action: z.enum([
          'approve_restriction',
          'dismiss_restriction',
          'approve_appeal',
          'reject_appeal',
        ]),
        expiryDays: z.number().int().min(1).max(180).optional().default(7),
        adminNote: z.string().min(3).max(400).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid restriction moderation action.' });
      }

      const [restriction] = await db
        .select()
        .from(accountRestrictions)
        .where(eq(accountRestrictions.id, req.params.id))
        .limit(1);

      if (!restriction) {
        return res.status(404).json({ error: 'Restriction record not found.' });
      }

      const { action, expiryDays, adminNote } = parsed.data;
      let nextStatus = restriction.restrictionStatus;
      let nextAppealStatus = restriction.appealStatus;
      let nextExpiresAt = restriction.expiresAt;

      if (action === 'approve_restriction') {
        nextStatus = 'active';
        nextExpiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
      } else if (action === 'dismiss_restriction') {
        nextStatus = 'dismissed';
      } else if (action === 'approve_appeal') {
        nextStatus = 'dismissed';
        nextAppealStatus = 'approved';
      } else if (action === 'reject_appeal') {
        nextAppealStatus = 'rejected';
      }

      const [updated] = await db
        .update(accountRestrictions)
        .set({
          restrictionStatus: nextStatus,
          appealStatus: nextAppealStatus,
          expiresAt: nextExpiresAt,
          reviewedBy: req.profile!.id,
        })
        .where(eq(accountRestrictions.id, restriction.id))
        .returning();

      await db.insert(moderationLogs).values({
        actorId: req.profile!.id,
        targetStudentId: restriction.studentId,
        targetShopId: restriction.shopId,
        action: `admin_${action}`,
        reason:
          adminNote?.trim() ||
          `Admin executed ${action} (expiry: ${expiryDays} days)`,
      });

      await db.insert(notifications).values({
        userId: restriction.studentId,
        title: 'Account Moderation Decision',
        message:
          action === 'approve_restriction'
            ? `Admin approved a temporary takeaway ordering restriction until ${nextExpiresAt?.toLocaleDateString('en-IN')}. You may submit an appeal in My Food Orders.`
            : action === 'approve_appeal'
              ? 'Your eatery restriction appeal was approved and your ordering access is restored.'
              : action === 'reject_appeal'
                ? 'Your restriction appeal was reviewed and declined by the campus administrator.'
                : 'A flagged order notice on your account was dismissed after admin review.',
        notificationType: 'moderation',
        linkUrl: '/app/orders',
      });

      res.json({ restriction: updated });
    } catch (error) {
      console.error('Admin restriction update error:', error);
      res.status(500).json({ error: 'Failed to update account restriction.' });
    }
  }
);

app.patch(
  '/api/admin/reviews/:id',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        moderationStatus: z.enum(['visible', 'flagged', 'hidden']),
        reason: z.string().min(3, 'Moderation reason is required').max(300),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Invalid review moderation input.',
        });
      }

      const [review] = await db
        .select()
        .from(shopReviews)
        .where(eq(shopReviews.id, req.params.id))
        .limit(1);

      if (!review) {
        return res.status(404).json({ error: 'Shop review not found.' });
      }

      const [updated] = await db
        .update(shopReviews)
        .set({ moderationStatus: parsed.data.moderationStatus })
        .where(eq(shopReviews.id, review.id))
        .returning();

      await recalculateShopRating(review.shopId);

      await db.insert(moderationLogs).values({
        actorId: req.profile!.id,
        targetStudentId: review.studentId,
        targetShopId: review.shopId,
        action: `admin_review_${parsed.data.moderationStatus}`,
        reason: parsed.data.reason.trim(),
      });

      res.json({ review: updated });
    } catch (error) {
      console.error('Admin moderate review error:', error);
      res.status(500).json({ error: 'Failed to moderate shop review.' });
    }
  }
);

// ---------------------------------------------------------------------------
// MONETIZATION, BOOSTS, PREMIUM MEMBERSHIP & PAYMENT GATEWAY ROUTES
// ---------------------------------------------------------------------------
app.get('/api/payments/config', async (_req, res) => {
  try {
    const settings = await getPlatformSettings();
    const gateway = getGatewayStatus();
    res.json({ gateway, settings });
  } catch (error) {
    console.error('Payment config error:', error);
    res.status(500).json({ error: 'Failed to load payment configuration.' });
  }
});

app.get('/api/promotions/mine', requireAuth, async (req: AuthRequest, res) => {
  try {
    await expirePromotionsAndSubscriptions();
    const rows = await db
      .select()
      .from(listingPromotions)
      .where(eq(listingPromotions.sellerId, req.profile!.id))
      .orderBy(desc(listingPromotions.createdAt));

    res.json({ promotions: rows });
  } catch (error) {
    console.error('My promotions error:', error);
    res.status(500).json({ error: 'Failed to load listing promotions.' });
  }
});

app.post('/api/payments/checkout', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      purpose: z.enum(['listing_boost', 'premium_membership']),
      listingId: z.string().uuid().optional(),
      packageType: z.enum(['basic', 'standard', 'premium']).optional(),
      paymentMethod: z.enum(['upi', 'card', 'netbanking']).default('upi'),
      idempotencyKey: z.string().min(6).max(120),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid checkout request.',
      });
    }

    const user = req.profile!;
    const { purpose, listingId, packageType, paymentMethod, idempotencyKey } =
      parsed.data;

    // Duplicate/idempotent checkout guard
    const [existingPayment] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existingPayment) {
      if (existingPayment.userId !== user.id) {
        return res.status(403).json({ error: 'Unauthorized idempotency key.' });
      }
      if (existingPayment.status === 'succeeded') {
        return res.status(409).json({
          error: 'This payment has already been processed.',
          paymentTransaction: existingPayment,
        });
      }
      if (existingPayment.status === 'pending') {
        return res.json({
          idempotent: true,
          paymentTransaction: existingPayment,
          gateway: getGatewayStatus(),
        });
      }
    }

    const settings = await getPlatformSettings();
    await expirePromotionsAndSubscriptions();

    let amountInr = 0;
    let referenceId = '';
    let receipt = '';
    const notes: Record<string, string> = { userId: user.id, purpose };

    if (purpose === 'listing_boost') {
      if (user.boostSuspended) {
        return res.status(403).json({
          error: 'Listing promotions are currently suspended on your account by campus administration.',
        });
      }
      if (!listingId || !packageType) {
        return res.status(400).json({
          error: 'Listing ID and boost package tier are required.',
        });
      }

      const [listing] = await db
        .select()
        .from(products)
        .where(eq(products.id, listingId))
        .limit(1);

      if (!listing) {
        return res.status(404).json({ error: 'Listing not found.' });
      }
      if (listing.sellerId !== user.id) {
        return res.status(403).json({
          error: 'Forbidden: You may only boost your own active listings.',
        });
      }
      if (listing.availabilityStatus !== 'Available') {
        return res.status(400).json({
          error: 'Only Available listings can be boosted.',
        });
      }

      const [activeExistingBoost] = await db
        .select()
        .from(listingPromotions)
        .where(
          and(
            eq(listingPromotions.listingId, listing.id),
            eq(listingPromotions.promotionStatus, 'active'),
            gt(listingPromotions.expiryTime, new Date())
          )
        )
        .limit(1);

      if (activeExistingBoost) {
        return res.status(409).json({
          error: 'This listing already has an active promotional boost.',
        });
      }

      amountInr =
        packageType === 'basic'
          ? settings.boostBasicPrice
          : packageType === 'standard'
            ? settings.boostStandardPrice
            : settings.boostPremiumPrice;

      const [promo] = await db
        .insert(listingPromotions)
        .values({
          listingId: listing.id,
          sellerId: user.id,
          packageType,
          amount: amountInr,
          paymentStatus: 'pending',
          promotionStatus: 'pending',
        })
        .returning();

      referenceId = promo.id;
      receipt = `boost_${listing.productCode}`;
      notes.listingId = listing.id;
      notes.packageType = packageType;
    } else {
      amountInr = settings.premiumPrice;
      const [sub] = await db
        .insert(premiumSubscriptions)
        .values({
          userId: user.id,
          planPrice: amountInr,
          durationDays: settings.premiumDurationDays,
          paymentStatus: 'pending',
          subscriptionStatus: 'pending',
        })
        .returning();

      referenceId = sub.id;
      receipt = `prem_${user.studentId}`;
      notes.durationDays = String(settings.premiumDurationDays);
    }

    const gatewayOrder = await createGatewayOrder({
      amountInr,
      receipt,
      notes,
    });

    const [payTxn] = await db
      .insert(paymentTransactions)
      .values({
        userId: user.id,
        purpose,
        referenceId,
        amount: amountInr,
        currency: 'INR',
        gateway: gatewayOrder.gateway,
        gatewayOrderId: gatewayOrder.gatewayOrderId,
        idempotencyKey,
        paymentMethod,
        status: 'pending',
        metadata: notes,
      })
      .returning();

    if (purpose === 'listing_boost') {
      await db
        .update(listingPromotions)
        .set({ paymentTransactionId: payTxn.id })
        .where(eq(listingPromotions.id, referenceId));
    } else {
      await db
        .update(premiumSubscriptions)
        .set({ paymentTransactionId: payTxn.id })
        .where(eq(premiumSubscriptions.id, referenceId));
    }

    res.status(201).json({
      paymentTransaction: payTxn,
      gatewayOrder,
      gateway: getGatewayStatus(),
    });
  } catch (error) {
    console.error('Payment checkout error:', error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Failed to initialize payment checkout.',
    });
  }
});

app.post('/api/payments/verify', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      paymentTransactionId: z.string().uuid(),
      gatewayOrderId: z.string().min(4),
      gatewayPaymentId: z.string().optional(),
      gatewaySignature: z.string().optional(),
      simulateFailure: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payment verification payload.' });
    }

    const user = req.profile!;
    const {
      paymentTransactionId,
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature,
      simulateFailure,
    } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const [payTxn] = await tx
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.id, paymentTransactionId))
        .limit(1);

      if (!payTxn) {
        return { status: 404 as const, body: { error: 'Payment record not found.' } };
      }
      if (payTxn.userId !== user.id) {
        return {
          status: 403 as const,
          body: { error: 'Forbidden: Payment does not belong to your account.' },
        };
      }
      if (payTxn.gatewayOrderId !== gatewayOrderId) {
        return {
          status: 400 as const,
          body: { error: 'Gateway order ID mismatch.' },
        };
      }

      // Idempotent duplicate verification safeguard
      if (payTxn.status === 'succeeded') {
        return {
          status: 200 as const,
          body: {
            verified: true,
            idempotent: true,
            paymentTransaction: payTxn,
          },
        };
      }

      if (payTxn.status === 'failed') {
        return {
          status: 409 as const,
          body: {
            error:
              payTxn.failureReason ||
              'This payment attempt already failed. Please initiate a fresh checkout.',
          },
        };
      }

      const verification = verifyGatewayPayment({
        gateway: payTxn.gateway === 'razorpay' ? 'razorpay' : 'sandbox',
        gatewayOrderId: payTxn.gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature,
        simulateFailure,
      });

      const now = new Date();
      if (!verification.verified) {
        const [failedPay] = await tx
          .update(paymentTransactions)
          .set({
            status: 'failed',
            gatewayPaymentId: verification.gatewayPaymentId || null,
            failureReason: verification.failureReason || 'Payment failed.',
            updatedAt: now,
          })
          .where(eq(paymentTransactions.id, payTxn.id))
          .returning();

        if (payTxn.purpose === 'listing_boost') {
          await tx
            .update(listingPromotions)
            .set({ paymentStatus: 'failed', promotionStatus: 'cancelled' })
            .where(eq(listingPromotions.id, payTxn.referenceId));
        } else {
          await tx
            .update(premiumSubscriptions)
            .set({ paymentStatus: 'failed', subscriptionStatus: 'cancelled' })
            .where(eq(premiumSubscriptions.id, payTxn.referenceId));
        }

        return {
          status: 402 as const,
          body: {
            verified: false,
            error: verification.failureReason || 'Payment verification failed.',
            paymentTransaction: failedPay,
          },
        };
      }

      // Payment verified -> activate promotion or subscription atomically
      const [succeededPay] = await tx
        .update(paymentTransactions)
        .set({
          status: 'succeeded',
          gatewayPaymentId: verification.gatewayPaymentId,
          updatedAt: now,
        })
        .where(eq(paymentTransactions.id, payTxn.id))
        .returning();

      const settings = await getPlatformSettings();

      if (payTxn.purpose === 'listing_boost') {
        const [promo] = await tx
          .select()
          .from(listingPromotions)
          .where(eq(listingPromotions.id, payTxn.referenceId))
          .limit(1);

        if (!promo) {
          throw new Error('Linked promotion record missing.');
        }

        const durationHours =
          promo.packageType === 'basic'
            ? settings.boostBasicHours
            : promo.packageType === 'standard'
              ? settings.boostStandardHours
              : settings.boostPremiumHours;

        const expiryTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

        const [activatedPromo] = await tx
          .update(listingPromotions)
          .set({
            paymentStatus: 'paid',
            promotionStatus: 'active',
            startTime: now,
            expiryTime,
          })
          .where(eq(listingPromotions.id, promo.id))
          .returning();

        await tx.insert(notifications).values({
          userId: user.id,
          title: 'Listing Boost Activated!',
          message: `Your ${promo.packageType.toUpperCase()} boost (₹${promo.amount}) is now live for ${durationHours} hours.`,
          notificationType: 'promotion',
          linkUrl: '/app/my-listings',
        });

        return {
          status: 200 as const,
          body: {
            verified: true,
            paymentTransaction: succeededPay,
            promotion: activatedPromo,
          },
        };
      } else {
        const [sub] = await tx
          .select()
          .from(premiumSubscriptions)
          .where(eq(premiumSubscriptions.id, payTxn.referenceId))
          .limit(1);

        if (!sub) {
          throw new Error('Linked subscription record missing.');
        }

        // If user already has an active unexpired subscription, stack from its expiry date
        const [existingActive] = await tx
          .select()
          .from(premiumSubscriptions)
          .where(
            and(
              eq(premiumSubscriptions.userId, user.id),
              eq(premiumSubscriptions.subscriptionStatus, 'active'),
              gt(premiumSubscriptions.expiryDate, now)
            )
          )
          .orderBy(desc(premiumSubscriptions.expiryDate))
          .limit(1);

        const anchorDate =
          existingActive?.expiryDate && new Date(existingActive.expiryDate) > now
            ? new Date(existingActive.expiryDate)
            : now;

        const expiryDate = new Date(
          anchorDate.getTime() + sub.durationDays * 24 * 60 * 60 * 1000
        );

        const [activatedSub] = await tx
          .update(premiumSubscriptions)
          .set({
            paymentStatus: 'paid',
            subscriptionStatus: 'active',
            startDate: now,
            expiryDate,
          })
          .where(eq(premiumSubscriptions.id, sub.id))
          .returning();

        await tx
          .update(profiles)
          .set({ isPremium: true })
          .where(eq(profiles.id, user.id));

        await tx.insert(notifications).values({
          userId: user.id,
          title: 'PingME Premium Activated!',
          message: `Your Premium Membership (₹${sub.planPrice}) is active until ${expiryDate.toLocaleDateString('en-IN')}. Explore your analytics dashboard now.`,
          notificationType: 'premium',
          linkUrl: '/app/premium-analytics',
        });

        return {
          status: 200 as const,
          body: {
            verified: true,
            paymentTransaction: succeededPay,
            subscription: activatedSub,
          },
        };
      }
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Payment verify error:', error);
    res.status(500).json({ error: 'Payment verification encountered an error.' });
  }
});

app.post('/api/payments/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const rawBody = JSON.stringify(req.body || {});
    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    const event = req.body?.event as string | undefined;
    const paymentEntity = req.body?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id as string | undefined;
    const paymentId = paymentEntity?.id as string | undefined;

    if (!orderId) {
      return res.json({ received: true });
    }

    const [payTxn] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.gatewayOrderId, orderId))
      .limit(1);

    if (!payTxn || payTxn.status === 'succeeded') {
      return res.json({ received: true, idempotent: true });
    }

    const now = new Date();
    if (event === 'payment.captured') {
      await db
        .update(paymentTransactions)
        .set({ status: 'succeeded', gatewayPaymentId: paymentId || null, updatedAt: now })
        .where(eq(paymentTransactions.id, payTxn.id));
    } else if (event === 'payment.failed') {
      await db
        .update(paymentTransactions)
        .set({
          status: 'failed',
          failureReason: paymentEntity?.error_description || 'Webhook payment failure',
          updatedAt: now,
        })
        .where(eq(paymentTransactions.id, payTxn.id));
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing error.' });
  }
});

app.get('/api/payments/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const allRows = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.userId, req.profile!.id))
      .orderBy(desc(paymentTransactions.createdAt));

    const total = allRows.length;
    const items = allRows.slice((page - 1) * limit, page * limit);
    res.json({
      payments: items,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({ error: 'Failed to load payment history.' });
  }
});

// ---------------------------------------------------------------------------
// PREMIUM MEMBERSHIP & SELLER ANALYTICS ROUTES
// ---------------------------------------------------------------------------
app.get('/api/premium/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const settings = await getPlatformSettings();
    const activeSubscription = await getActiveSubscriptionForUser(req.profile!.id);
    const history = await db
      .select()
      .from(premiumSubscriptions)
      .where(eq(premiumSubscriptions.userId, req.profile!.id))
      .orderBy(desc(premiumSubscriptions.createdAt))
      .limit(10);

    res.json({
      isPremium: Boolean(activeSubscription),
      activeSubscription,
      history,
      plan: {
        price: settings.premiumPrice,
        durationDays: settings.premiumDurationDays,
      },
    });
  } catch (error) {
    console.error('Premium status error:', error);
    res.status(500).json({ error: 'Failed to load membership status.' });
  }
});

app.get('/api/analytics/premium', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.profile!.id;
    const activeSub = await getActiveSubscriptionForUser(userId);
    if (!activeSub && req.profile!.role !== 'admin') {
      return res.status(403).json({
        error: 'Active PingME Premium Membership is required to access advanced seller analytics.',
        requiresPremium: true,
      });
    }

    const range = (req.query.range as string) || 'daily';

    const [sellerProducts, viewEvents, sellerTxns, sellerMessages, activePromos] =
      await Promise.all([
        db
          .select()
          .from(products)
          .where(eq(products.sellerId, userId))
          .orderBy(desc(products.createdAt)),
        db
          .select()
          .from(productViewEvents)
          .where(eq(productViewEvents.sellerId, userId))
          .orderBy(productViewEvents.viewedAt),
        db
          .select()
          .from(transactions)
          .where(eq(transactions.sellerId, userId))
          .orderBy(desc(transactions.createdAt)),
        db
          .select()
          .from(messages)
          .where(eq(messages.receiverId, userId)),
        db
          .select()
          .from(listingPromotions)
          .where(
            and(
              eq(listingPromotions.sellerId, userId),
              eq(listingPromotions.promotionStatus, 'active'),
              gt(listingPromotions.expiryTime, new Date())
            )
          ),
      ]);

    const uniqueVisitors = new Set(viewEvents.map((v) => v.visitorKey)).size;
    const totalListingViews = Math.max(
      sellerProducts.reduce((sum, p) => sum + p.viewCount, 0),
      viewEvents.length
    );

    const enquiryThreads = new Set(
      sellerMessages.map((m) => `${m.senderId}:${m.productId || 'general'}`)
    ).size;

    const totalOrders = sellerTxns.length;
    const completedTxns = sellerTxns.filter((t) =>
      ['Completed', 'Returned', 'Collected'].includes(t.transactionStatus)
    );
    const completedSalesCount = completedTxns.length;
    const totalRevenue = completedTxns.reduce((sum, t) => sum + t.totalAmount, 0);
    const conversionRate =
      totalListingViews > 0
        ? Number(((completedSalesCount / totalListingViews) * 100).toFixed(2))
        : 0;

    // Product-wise comparison
    const productBreakdown = sellerProducts.map((p) => {
      const pEvents = viewEvents.filter((e) => e.productId === p.id);
      const pUnique = new Set(pEvents.map((e) => e.visitorKey)).size;
      const pViews = Math.max(p.viewCount, pEvents.length);
      const pEnquiries = new Set(
        sellerMessages.filter((m) => m.productId === p.id).map((m) => m.senderId)
      ).size;
      const pTxns = sellerTxns.filter((t) => t.productId === p.id);
      const pCompleted = pTxns.filter((t) =>
        ['Completed', 'Returned', 'Collected'].includes(t.transactionStatus)
      );
      const pRevenue = pCompleted.reduce((sum, t) => sum + t.totalAmount, 0);
      const pConv =
        pViews > 0 ? Number(((pCompleted.length / pViews) * 100).toFixed(2)) : 0;
      const isBoosted = activePromos.some((pr) => pr.listingId === p.id);

      return {
        productId: p.id,
        productCode: p.productCode,
        title: p.title,
        category: p.category,
        listingType: p.listingType,
        availabilityStatus: p.availabilityStatus,
        isBoosted,
        views: pViews,
        uniqueVisitors: pUnique,
        enquiries: pEnquiries,
        orders: pTxns.length,
        completedSales: pCompleted.length,
        revenue: pRevenue,
        conversionRate: pConv,
      };
    });

    productBreakdown.sort(
      (a, b) =>
        b.revenue - a.revenue ||
        b.completedSales - a.completedSales ||
        b.views - a.views
    );

    const bestPerformingProduct = productBreakdown[0] || null;

    // Interactive time-series trends (daily: 14 days, weekly: 8 weeks, monthly: 6 months)
    const now = new Date();
    const trendSeries: Array<{
      label: string;
      views: number;
      uniqueVisitors: number;
      enquiries: number;
      sales: number;
      revenue: number;
    }> = [];

    if (range === 'monthly') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        const bucketViews = viewEvents.filter(
          (v) => new Date(v.viewedAt) >= start && new Date(v.viewedAt) < end
        );
        const bucketMsg = sellerMessages.filter(
          (m) => new Date(m.createdAt) >= start && new Date(m.createdAt) < end
        );
        const bucketSales = completedTxns.filter(
          (t) => new Date(t.createdAt) >= start && new Date(t.createdAt) < end
        );
        trendSeries.push({
          label,
          views: bucketViews.length,
          uniqueVisitors: new Set(bucketViews.map((v) => v.visitorKey)).size,
          enquiries: bucketMsg.length,
          sales: bucketSales.length,
          revenue: bucketSales.reduce((s, t) => s + t.totalAmount, 0),
        });
      }
    } else if (range === 'weekly') {
      for (let i = 7; i >= 0; i--) {
        const end = new Date(now.getTime() - i * 7 * 86400000);
        const start = new Date(end.getTime() - 7 * 86400000);
        const label = `Wk ${8 - i}`;
        const bucketViews = viewEvents.filter(
          (v) => new Date(v.viewedAt) >= start && new Date(v.viewedAt) <= end
        );
        const bucketMsg = sellerMessages.filter(
          (m) => new Date(m.createdAt) >= start && new Date(m.createdAt) <= end
        );
        const bucketSales = completedTxns.filter(
          (t) => new Date(t.createdAt) >= start && new Date(t.createdAt) <= end
        );
        trendSeries.push({
          label,
          views: bucketViews.length,
          uniqueVisitors: new Set(bucketViews.map((v) => v.visitorKey)).size,
          enquiries: bucketMsg.length,
          sales: bucketSales.length,
          revenue: bucketSales.reduce((s, t) => s + t.totalAmount, 0),
        });
      }
    } else {
      for (let i = 13; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 86400000);
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const end = new Date(start.getTime() + 86400000);
        const label = day.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        });
        const bucketViews = viewEvents.filter(
          (v) => new Date(v.viewedAt) >= start && new Date(v.viewedAt) < end
        );
        const bucketMsg = sellerMessages.filter(
          (m) => new Date(m.createdAt) >= start && new Date(m.createdAt) < end
        );
        const bucketSales = completedTxns.filter(
          (t) => new Date(t.createdAt) >= start && new Date(t.createdAt) < end
        );
        trendSeries.push({
          label,
          views: bucketViews.length,
          uniqueVisitors: new Set(bucketViews.map((v) => v.visitorKey)).size,
          enquiries: bucketMsg.length,
          sales: bucketSales.length,
          revenue: bucketSales.reduce((s, t) => s + t.totalAmount, 0),
        });
      }
    }

    res.json({
      subscription: activeSub,
      range,
      summary: {
        totalListingViews,
        uniqueVisitors,
        totalEnquiries: enquiryThreads,
        totalOrders,
        completedSales: completedSalesCount,
        revenueGenerated: totalRevenue,
        conversionRate,
        activeListingsCount: sellerProducts.filter(
          (p) => p.availabilityStatus === 'Available'
        ).length,
        activeBoostsCount: activePromos.length,
      },
      bestPerformingProduct,
      productBreakdown,
      trendSeries,
    });
  } catch (error) {
    console.error('Premium analytics error:', error);
    res.status(500).json({ error: 'Failed to load seller analytics.' });
  }
});

app.get('/api/support/tickets', requireAuth, async (req: AuthRequest, res) => {
  try {
    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, req.profile!.id))
      .orderBy(desc(supportTickets.createdAt));
    res.json({ tickets });
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to load support tickets.' });
  }
});

app.post('/api/support/tickets', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      subject: z.string().min(4, 'Subject is required').max(120),
      message: z.string().min(10, 'Describe your issue clearly').max(1000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid support request.',
      });
    }

    const activeSub = await getActiveSubscriptionForUser(req.profile!.id);
    const [created] = await db
      .insert(supportTickets)
      .values({
        userId: req.profile!.id,
        subject: parsed.data.subject.trim(),
        message: parsed.data.message.trim(),
        isPriority: Boolean(activeSub),
        status: 'open',
      })
      .returning();

    res.status(201).json({ ticket: created });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Failed to submit support ticket.' });
  }
});

// ---------------------------------------------------------------------------
// STUDENT REFERRAL PROGRAMME & REWARD WITHDRAWALS
// ---------------------------------------------------------------------------
app.get('/api/referrals/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.profile!.id;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));

    await settleMaturedReferralRewards(userId);
    const settings = await getPlatformSettings();

    const [myReferrals, myCommissionRows, myWithdrawals] = await Promise.all([
      db
        .select()
        .from(referrals)
        .where(eq(referrals.referrerId, userId))
        .orderBy(desc(referrals.createdAt)),
      db
        .select()
        .from(referralTransactions)
        .where(eq(referralTransactions.referrerId, userId))
        .orderBy(desc(referralTransactions.createdAt)),
      db
        .select()
        .from(rewardWithdrawals)
        .where(eq(rewardWithdrawals.studentId, userId))
        .orderBy(desc(rewardWithdrawals.createdAt)),
    ]);

    const referredUserIds = myReferrals.map((r) => r.referredUserId);
    const txnIds = myCommissionRows.map((c) => c.transactionId);

    const [referredProfiles, relatedTxns] = await Promise.all([
      referredUserIds.length > 0
        ? db.select().from(profiles).where(inArray(profiles.id, referredUserIds))
        : Promise.resolve([]),
      txnIds.length > 0
        ? db.select().from(transactions).where(inArray(transactions.id, txnIds))
        : Promise.resolve([]),
    ]);

    const profileMap = new Map(referredProfiles.map((p) => [p.id, p]));
    const txnMap = new Map(relatedTxns.map((t) => [t.id, t]));

    const creditedTotal = myCommissionRows
      .filter((r) => r.rewardStatus === 'credited')
      .reduce((sum, r) => sum + r.commissionAmount, 0);
    const pendingTotal = myCommissionRows
      .filter((r) => r.rewardStatus === 'pending')
      .reduce((sum, r) => sum + r.commissionAmount, 0);
    const withdrawnTotal = myWithdrawals
      .filter((w) => ['pending', 'approved', 'paid'].includes(w.status))
      .reduce((sum, w) => sum + w.amount, 0);
    const withdrawableBalance = Math.max(0, creditedTotal - withdrawnTotal);

    // Privacy-first referral history: mask referred users' Student IDs and never expose emails
    const referralHistoryAll = myReferrals.map((r) => {
      const refUser = profileMap.get(r.referredUserId);
      const userCommissions = myCommissionRows.filter(
        (c) => c.referredUserId === r.referredUserId
      );
      const rewardEarned = userCommissions
        .filter((c) => c.rewardStatus === 'credited' || c.rewardStatus === 'pending')
        .reduce((sum, c) => sum + c.commissionAmount, 0);

      return {
        id: r.id,
        maskedStudentId: refUser ? maskStudentId(refUser.studentId) : 'PEC-****',
        department: refUser?.department || 'PEC Student',
        academicYear: refUser?.academicYear || '',
        verificationStatus: refUser?.verificationStatus || 'pending',
        registrationDate: r.createdAt,
        transactionsCount: userCommissions.length,
        rewardEarned,
        status: r.status,
      };
    });

    const commissionLedgerAll = myCommissionRows.map((c) => {
      const t = txnMap.get(c.transactionId);
      const refUser = profileMap.get(c.referredUserId);
      return {
        ...c,
        transactionCode: t?.transactionCode || 'TXN',
        maskedStudentId: refUser ? maskStudentId(refUser.studentId) : 'PEC-****',
      };
    });

    res.json({
      referralCode: req.profile!.referralCode || `PEC-${req.profile!.studentId}`,
      referralSuspended: Boolean(req.profile!.referralSuspended),
      rules: {
        commissionRatePct: settings.referralCommissionPct,
        minOrderAmount: settings.referralMinOrderAmount,
        disputeWindowHours: settings.referralDisputeWindowHours,
      },
      summary: {
        totalReferrals: myReferrals.length,
        verifiedReferrals: myReferrals.filter((r) => r.status === 'verified').length,
        successfulTransactions: myCommissionRows.filter(
          (c) => !['rejected', 'reversed'].includes(c.rewardStatus)
        ).length,
        totalCommissionEarned: creditedTotal + pendingTotal,
        creditedBalance: creditedTotal,
        pendingRewards: pendingTotal,
        withdrawnAmount: withdrawnTotal,
        withdrawableBalance,
      },
      referralHistory: referralHistoryAll.slice((page - 1) * limit, page * limit),
      commissionLedger: commissionLedgerAll.slice((page - 1) * limit, page * limit),
      withdrawals: myWithdrawals,
      pagination: {
        page,
        limit,
        totalReferrals: referralHistoryAll.length,
        totalCommissions: commissionLedgerAll.length,
        totalPages: Math.max(
          1,
          Math.ceil(
            Math.max(referralHistoryAll.length, commissionLedgerAll.length) / limit
          )
        ),
      },
    });
  } catch (error) {
    console.error('Referral dashboard error:', error);
    res.status(500).json({ error: 'Failed to load referral rewards dashboard.' });
  }
});

app.post('/api/referrals/withdraw', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      amount: z.number().int().min(10, 'Minimum withdrawal amount is ₹10'),
      upiId: z
        .string()
        .min(5, 'Valid UPI ID is required (e.g. name@upi)')
        .max(80)
        .regex(/^[\w.\-_]{2,}@[a-zA-Z]{2,}$/, 'Enter a valid UPI ID (e.g. student@okaxis)'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid withdrawal request.',
      });
    }

    const user = req.profile!;
    if (user.referralSuspended) {
      return res.status(403).json({
        error: 'Referral payouts are suspended on this account.',
      });
    }

    await settleMaturedReferralRewards(user.id);

    const [handle, bank] = parsed.data.upiId.trim().split('@');
    const maskedUpi =
      handle.length <= 2
        ? `**@${bank}`
        : `${handle.slice(0, 2)}***${handle.slice(-1)}@${bank}`;

    const outcome = await db.transaction(async (tx) => {
      const credits = await tx
        .select()
        .from(referralTransactions)
        .where(
          and(
            eq(referralTransactions.referrerId, user.id),
            eq(referralTransactions.rewardStatus, 'credited')
          )
        );
      const withdrawals = await tx
        .select()
        .from(rewardWithdrawals)
        .where(eq(rewardWithdrawals.studentId, user.id));

      const creditedTotal = credits.reduce((s, c) => s + c.commissionAmount, 0);
      const reservedTotal = withdrawals
        .filter((w) => ['pending', 'approved', 'paid'].includes(w.status))
        .reduce((s, w) => s + w.amount, 0);
      const available = Math.max(0, creditedTotal - reservedTotal);

      if (parsed.data.amount > available) {
        return {
          status: 400 as const,
          body: {
            error: `Insufficient withdrawable balance. Available: ₹${available}.`,
          },
        };
      }

      const [created] = await tx
        .insert(rewardWithdrawals)
        .values({
          studentId: user.id,
          amount: parsed.data.amount,
          payoutMethod: 'UPI',
          payoutDestinationMasked: maskedUpi,
          status: 'pending',
        })
        .returning();

      return { status: 201 as const, body: { withdrawal: created } };
    });

    res.status(outcome.status).json(outcome.body);
  } catch (error) {
    console.error('Referral withdraw error:', error);
    res.status(500).json({ error: 'Unable to submit withdrawal request.' });
  }
});

// ---------------------------------------------------------------------------
// ADMIN MONETIZATION & REFERRAL CONTROL PANEL (RBAC)
// ---------------------------------------------------------------------------
app.get('/api/admin/monetization', requireAuth, requireAdmin, async (req, res) => {
  try {
    await expirePromotionsAndSubscriptions();
    await settleMaturedReferralRewards();

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));

    const [
      settings,
      allPayments,
      allPromos,
      allSubs,
      allReferrals,
      allRefTxns,
      allWithdrawals,
      allProfiles,
      allProducts,
    ] = await Promise.all([
      getPlatformSettings(),
      db.select().from(paymentTransactions).orderBy(desc(paymentTransactions.createdAt)),
      db.select().from(listingPromotions).orderBy(desc(listingPromotions.createdAt)),
      db.select().from(premiumSubscriptions).orderBy(desc(premiumSubscriptions.createdAt)),
      db.select().from(referrals).orderBy(desc(referrals.createdAt)),
      db.select().from(referralTransactions).orderBy(desc(referralTransactions.createdAt)),
      db.select().from(rewardWithdrawals).orderBy(desc(rewardWithdrawals.createdAt)),
      db.select().from(profiles),
      db.select().from(products),
    ]);

    const profileMap = new Map(allProfiles.map((p) => [p.id, serializeOwnProfile(p)]));
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    const succeededPayments = allPayments.filter((p) => p.status === 'succeeded');
    const boostRevenue = succeededPayments
      .filter((p) => p.purpose === 'listing_boost')
      .reduce((s, p) => s + p.amount, 0);
    const premiumRevenue = succeededPayments
      .filter((p) => p.purpose === 'premium_membership')
      .reduce((s, p) => s + p.amount, 0);
    const referralCommissionLiability = allRefTxns
      .filter((r) => ['pending', 'credited'].includes(r.rewardStatus))
      .reduce((s, r) => s + r.commissionAmount, 0);

    // Detect suspicious repeated referrer-referred loops (>= 3 commissions between same pair)
    const pairCount = new Map<string, number>();
    for (const rt of allRefTxns) {
      const k = `${rt.referrerId}:${rt.referredUserId}`;
      pairCount.set(k, (pairCount.get(k) || 0) + 1);
    }

    res.json({
      settings,
      metrics: {
        boostRevenue,
        premiumRevenue,
        totalMonetizationRevenue: boostRevenue + premiumRevenue,
        activePromotionsCount: allPromos.filter((p) => p.promotionStatus === 'active').length,
        activeSubscribersCount: allSubs.filter((s) => s.subscriptionStatus === 'active').length,
        totalReferrals: allReferrals.length,
        referralCommissionLiability,
        pendingWithdrawalsCount: allWithdrawals.filter((w) => w.status === 'pending').length,
      },
      payments: allPayments.slice((page - 1) * limit, page * limit).map((p) => ({
        ...p,
        user: profileMap.get(p.userId) || null,
      })),
      promotions: allPromos.slice((page - 1) * limit, page * limit).map((pr) => ({
        ...pr,
        seller: profileMap.get(pr.sellerId) || null,
        listing: productMap.get(pr.listingId) || null,
      })),
      subscriptions: allSubs.slice((page - 1) * limit, page * limit).map((s) => ({
        ...s,
        user: profileMap.get(s.userId) || null,
      })),
      referralTransactions: allRefTxns.slice((page - 1) * limit, page * limit).map((rt) => ({
        ...rt,
        referrer: profileMap.get(rt.referrerId) || null,
        referredUser: profileMap.get(rt.referredUserId) || null,
        suspiciousPairCount: pairCount.get(`${rt.referrerId}:${rt.referredUserId}`) || 1,
      })),
      withdrawals: allWithdrawals.map((w) => ({
        ...w,
        student: profileMap.get(w.studentId) || null,
      })),
    });
  } catch (error) {
    console.error('Admin monetization error:', error);
    res.status(500).json({ error: 'Failed to load monetization overview.' });
  }
});

app.patch(
  '/api/admin/monetization/settings',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const schema = z.object({
        boostBasicPrice: z.number().int().min(1).max(5000).optional(),
        boostBasicHours: z.number().int().min(1).max(720).optional(),
        boostStandardPrice: z.number().int().min(1).max(5000).optional(),
        boostStandardHours: z.number().int().min(1).max(720).optional(),
        boostPremiumPrice: z.number().int().min(1).max(5000).optional(),
        boostPremiumHours: z.number().int().min(1).max(720).optional(),
        premiumPrice: z.number().int().min(1).max(10000).optional(),
        premiumDurationDays: z.number().int().min(1).max(365).optional(),
        referralCommissionPct: z.number().min(0.5).max(50).optional(),
        referralMinOrderAmount: z.number().int().min(0).max(10000).optional(),
        referralDisputeWindowHours: z.number().int().min(0).max(336).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid monetization settings input.' });
      }

      const current = await getPlatformSettings();
      const [updated] = await db
        .update(platformSettings)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(platformSettings.id, current.id))
        .returning();

      res.json({ settings: updated });
    } catch (error) {
      console.error('Update monetization settings error:', error);
      res.status(500).json({ error: 'Failed to update monetization settings.' });
    }
  }
);

app.patch(
  '/api/admin/monetization/withdrawals/:id',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        status: z.enum(['approved', 'paid', 'rejected']),
        adminNote: z.string().max(300).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid withdrawal status.' });
      }

      const [existing] = await db
        .select()
        .from(rewardWithdrawals)
        .where(eq(rewardWithdrawals.id, req.params.id))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'Withdrawal request not found.' });
      }

      const [updated] = await db
        .update(rewardWithdrawals)
        .set({
          status: parsed.data.status,
          adminNote: parsed.data.adminNote?.trim() || existing.adminNote,
          reviewedBy: req.profile!.id,
          processedAt: new Date(),
        })
        .where(eq(rewardWithdrawals.id, existing.id))
        .returning();

      await db.insert(notifications).values({
        userId: existing.studentId,
        title: `Reward Withdrawal ${parsed.data.status.toUpperCase()}`,
        message: `Your referral payout request of ₹${existing.amount} (${existing.payoutDestinationMasked}) was marked ${parsed.data.status}.`,
        notificationType: 'referral_payout',
        linkUrl: '/app/referrals',
      });

      res.json({ withdrawal: updated });
    } catch (error) {
      console.error('Admin withdrawal update error:', error);
      res.status(500).json({ error: 'Failed to update withdrawal request.' });
    }
  }
);

app.patch(
  '/api/admin/monetization/users/:id/suspend',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const schema = z.object({
        referralSuspended: z.boolean().optional(),
        boostSuspended: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid suspension payload.' });
      }

      const [updated] = await db
        .update(profiles)
        .set(parsed.data)
        .where(eq(profiles.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: 'User not found.' });

      res.json({ user: serializeOwnProfile(updated) });
    } catch (error) {
      console.error('Admin user monetization suspend error:', error);
      res.status(500).json({ error: 'Failed to update user monetization status.' });
    }
  }
);

app.patch(
  '/api/admin/monetization/promotions/:id',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const schema = z.object({
        promotionStatus: z.enum(['active', 'suspended', 'cancelled', 'expired']),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid promotion status.' });
      }

      const [updated] = await db
        .update(listingPromotions)
        .set({ promotionStatus: parsed.data.promotionStatus })
        .where(eq(listingPromotions.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Promotion not found.' });

      res.json({ promotion: updated });
    } catch (error) {
      console.error('Admin promotion update error:', error);
      res.status(500).json({ error: 'Failed to update promotion status.' });
    }
  }
);

app.patch(
  '/api/admin/monetization/referrals/:id',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const schema = z.object({
        rewardStatus: z.enum(['pending', 'credited', 'rejected', 'reversed']),
        adminNote: z.string().max(300).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid referral ledger status.' });
      }

      const [updated] = await db
        .update(referralTransactions)
        .set({
          rewardStatus: parsed.data.rewardStatus,
          adminNote: parsed.data.adminNote?.trim() || null,
          creditedAt:
            parsed.data.rewardStatus === 'credited' ? new Date() : undefined,
        })
        .where(eq(referralTransactions.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Referral transaction not found.' });

      res.json({ referralTransaction: updated });
    } catch (error) {
      console.error('Admin referral update error:', error);
      res.status(500).json({ error: 'Failed to update referral transaction.' });
    }
  }
);


// ---------------------------------------------------------------------------
// VITE DEV SERVER OR STATIC PRODUCTION SERVING
// ---------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PingME PEC Campus Marketplace running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
