import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prismaClient';

// ── Validation schema ────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ── Controller ───────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response): Promise<void> {
  // 1. Validate request body
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, password } = parsed.data;

  // 2. Fetch user by email — use a generic message to avoid user enumeration
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      globalRole: true,
      createdAt: true,
    },
  });

  if (!user) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid email or password.',
    });
    return;
  }

  // 3. Compare password against stored bcrypt hash
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid email or password.',
    });
    return;
  }

  // 4. Sign JWT
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    res.status(500).json({
      status: 'error',
      message: 'Server misconfiguration: JWT secret not set.',
    });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, globalRole: user.globalRole },
    secret,
    { expiresIn: '1d' },
  );

  // 5. Return token and safe user info (no passwordHash)
  res.status(200).json({
    status: 'success',
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        globalRole: user.globalRole,
        createdAt: user.createdAt,
      },
    },
  });
}

// ── GET /api/v1/auth/me/tenants ──────────────────────────────────────────────
export async function getMyTenants(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({
      status: 'error',
      message: 'Unauthorized: User context missing.',
    });
    return;
  }

  try {
    const memberships = await prisma.tenantMember.findMany({
      where: { userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            settings: true,
          },
        },
      },
    });

    const tenants = memberships.map((m) => m.tenant);

    res.status(200).json({
      status: 'success',
      data: { tenants },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to fetch tenants.',
    });
  }
}

