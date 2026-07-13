import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../utils/prismaClient';
import { AppError } from '../utils/AppError';

// ── Validation ────────────────────────────────────────────────────────────────
const createMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password cannot exceed 72 characters (bcrypt limit)'),
  role: z.enum(['OWNER', 'ADMIN', 'STAFF']).default('ADMIN'),
});

/**
 * GET /api/v1/team
 * Fetch all TenantMember records for req.tenantId, including the related User data.
 */
export async function getTeamMembers(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId;

  if (!tenantId) {
    res.status(400).json({
      status: 'error',
      message: 'Tenant context missing.',
    });
    return;
  }

  try {
    const members = await prisma.tenantMember.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            globalRole: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        role: 'asc',
      },
    });

    res.status(200).json({
      status: 'success',
      data: { members },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to retrieve team members.',
    });
  }
}

// ── POST /api/v1/team/invite ──────────────────────────────────────────────────
/**
 * Create a team account.
 * - NEW email: creates User with owner-set password + TenantMember.
 * - EXISTING email, not yet a member: adds TenantMember only (password NOT touched).
 * - EXISTING email, already a member: 409 ALREADY_MEMBER.
 * Password is NEVER returned in the response.
 */
export async function createMember(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId;

  if (!tenantId) {
    res.status(400).json({
      status: 'error',
      message: 'Tenant context missing.',
    });
    return;
  }

  const parsed = createMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      issues: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, password, role } = parsed.data;

  try {
    // 1. Check if user already exists
    let user = await prisma.user.findUnique({ where: { email } });
    let addedExisting = false;

    if (user) {
      // 2a. Check if already a member of this tenant
      const existingMember = await prisma.tenantMember.findUnique({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId,
          },
        },
      });

      if (existingMember) {
        throw new AppError(409, 'ALREADY_MEMBER', 'This user is already a member of this workspace.');
      }

      // 2b. Existing user, not yet a member — add membership only; do NOT touch their password
      addedExisting = true;
    } else {
      // 3. New user — create with owner-supplied password
      const BCRYPT_ROUNDS = 10;
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          globalRole: 'USER',
        },
      });
    }

    // 4. Create TenantMember linking the User to this tenant
    const tenantMember = await prisma.tenantMember.create({
      data: {
        userId: user.id,
        tenantId,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            globalRole: true,
            createdAt: true,
          },
        },
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        member: tenantMember,
        addedExisting,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to create member.',
    });
  }
}


// ── DELETE /api/v1/team/:id ───────────────────────────────────────────────────
/**
 * Remove a member from the tenant.
 * - OWNER role cannot be removed.
 * - Cannot remove the last member of the tenant (CANNOT_REMOVE_LAST_MEMBER).
 * - Scoped to req.tenantId — cannot remove members from other tenants.
 */
export async function removeMember(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!tenantId) {
    res.status(400).json({
      status: 'error',
      message: 'Tenant context missing.',
    });
    return;
  }

  if (!id || typeof id !== 'string') {
    res.status(400).json({
      status: 'error',
      message: 'Member ID parameter is required and must be a string.',
    });
    return;
  }

  try {
    // Fetch the target membership record
    const member = await prisma.tenantMember.findUnique({
      where: { id },
    });

    // Tenant scope guard — only operate within req.tenantId
    if (!member || member.tenantId !== tenantId) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Team member record not found.');
    }

    // Block self-removal
    if (member.userId === req.user?.userId) {
      throw new AppError(403, 'CANNOT_REMOVE_SELF', 'You cannot remove yourself from the workspace.');
    }

    // Block OWNER removal
    if (member.role === 'OWNER') {
      res.status(400).json({
        status: 'error',
        message: 'Cannot remove the OWNER of the workspace.',
      });
      return;
    }

    // Last-member guard: count all members in this tenant
    const memberCount = await prisma.tenantMember.count({
      where: { tenantId },
    });

    if (memberCount <= 1) {
      throw new AppError(
        409,
        'CANNOT_REMOVE_LAST_MEMBER',
        'Cannot remove the last member of this workspace.',
      );
    }

    // Delete TenantMember and check/clean up orphan User account in a transaction
    const userDeleted = await prisma.$transaction(async (tx) => {
      await tx.tenantMember.delete({
        where: { id },
      });

      const remainingMembershipsCount = await tx.tenantMember.count({
        where: { userId: member.userId },
      });

      if (remainingMembershipsCount === 0) {
        await tx.user.delete({
          where: { id: member.userId },
        });
        return true;
      }
      return false;
    });

    res.status(200).json({
      status: 'success',
      message: 'Team member removed successfully.',
      removed: true,
      userDeleted,
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to remove member.',
    });
  }
}
