import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { profiles } from '../db/schema.ts';
import { adminAuth } from './firebase-admin.ts';

const JWT_SECRET =
  process.env.JWT_SECRET || 'pingme-pec-campus-exchange-dev-secret-2026';

export type ProfileRow = typeof profiles.$inferSelect;

export interface SafeProfile {
  id: string;
  studentId: string;
  maskedStudentId: string;
  fullName: string;
  institutionalEmail: string;
  department: string;
  academicYear: string;
  role: string;
  verificationStatus: string;
  avatarUrl: string | null;
  hostelBlock: string | null;
  bio: string | null;
  referralCode: string;
  isPremium: boolean;
  referralSuspended: boolean;
  boostSuspended: boolean;
  createdAt: Date;
}

export interface PublicProfile {
  id: string;
  maskedStudentId: string;
  fullName: string;
  department: string;
  academicYear: string;
  verificationStatus: string;
  avatarUrl: string | null;
  hostelBlock: string | null;
  bio: string | null;
  isPremium: boolean;
  createdAt: Date;
}

export function generateReferralCode(studentId: string): string {
  const clean = studentId.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10);
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `PEC-${clean}-${rand}`;
}

export function maskStudentId(studentId: string): string {
  if (!studentId) return '****';
  if (studentId.length <= 4) return `${studentId[0]}***`;
  return `${studentId.slice(0, 4)}****${studentId.slice(-2)}`;
}

export function serializeOwnProfile(profile: ProfileRow): SafeProfile {
  return {
    id: profile.id,
    studentId: profile.studentId,
    maskedStudentId: maskStudentId(profile.studentId),
    fullName: profile.fullName,
    institutionalEmail: profile.institutionalEmail,
    department: profile.department,
    academicYear: profile.academicYear,
    role: profile.role,
    verificationStatus: profile.verificationStatus,
    avatarUrl: profile.avatarUrl,
    hostelBlock: profile.hostelBlock,
    bio: profile.bio,
    referralCode: profile.referralCode || `PEC-${profile.studentId}`,
    isPremium: Boolean(profile.isPremium),
    referralSuspended: Boolean(profile.referralSuspended),
    boostSuspended: Boolean(profile.boostSuspended),
    createdAt: profile.createdAt,
  };
}

export function serializePublicProfile(profile: ProfileRow): PublicProfile {
  return {
    id: profile.id,
    maskedStudentId: maskStudentId(profile.studentId),
    fullName: profile.fullName,
    department: profile.department,
    academicYear: profile.academicYear,
    verificationStatus: profile.verificationStatus,
    avatarUrl: profile.avatarUrl,
    hostelBlock: profile.hostelBlock,
    bio: profile.bio,
    isPremium: Boolean(profile.isPremium),
    createdAt: profile.createdAt,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string | null
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export function signSessionToken(profile: ProfileRow): string {
  return jwt.sign(
    {
      sub: profile.id,
      studentId: profile.studentId,
      role: profile.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function hashQrToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateRandomToken(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export interface AuthRequest extends Request {
  profile?: ProfileRow;
}

export async function resolveAuthProfile(
  req: Request
): Promise<ProfileRow | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub?: string };
    if (decoded?.sub) {
      const [user] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, decoded.sub))
        .limit(1);
      if (user) return user;
    }
  } catch {
    // Fallback to Firebase ID token verification
  }

  try {
    const decodedFirebase = await adminAuth.verifyIdToken(token);
    const [existing] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.firebaseUid, decodedFirebase.uid))
      .limit(1);
    if (existing) return existing;
  } catch {
    return null;
  }

  return null;
}

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const profile = await resolveAuthProfile(req);
    if (profile) {
      req.profile = profile;
    }
  } catch {
    // Ignore optional auth failures
  }
  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = await resolveAuthProfile(req);
    if (!profile) {
      return res
        .status(401)
        .json({ error: 'Authentication required. Please sign in to PingME.' });
    }
    req.profile = profile;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.profile) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.profile.role !== 'admin') {
    return res
      .status(403)
      .json({ error: 'Administrator privileges required.' });
  }
  next();
};

export const requireShopOwner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.profile) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.profile.role !== 'shop_owner' && req.profile.role !== 'admin') {
    return res
      .status(403)
      .json({ error: 'Authorized campus shop owner privileges required.' });
  }
  next();
};
