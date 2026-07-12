import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prismaClient';

// Extend the Express Request type declaration globally
declare global {
  namespace Express {
    interface Request {
      membershipRole?: string;
    }
  }
}

export async function requireMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.userId;
  const globalRole = req.user?.globalRole;
  const tenantId = req.tenantId;

  if (!userId || !tenantId) {
    res.status(500).json({
      status: 'error',
      message: 'Middleware misconfiguration: user or tenant context missing.',
    });
    return;
  }

  if (globalRole === 'SUPER_ADMIN') {
    req.membershipRole = 'SUPER_ADMIN';
    next();
    return;
  }

  try {
    const membership = await prisma.tenantMember.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
    });

    if (!membership) {
      res.status(403).json({
        status: 'error',
        message: 'Forbidden: you are not a member of this workspace.',
      });
      return;
    }

    req.membershipRole = membership.role;
    next();
  } catch (error) {
    next(error);
  }
}
