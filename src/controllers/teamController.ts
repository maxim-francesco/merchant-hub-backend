import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../utils/prismaClient';

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'STAFF']),
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

/**
 * POST /api/v1/team/invite
 * Invite a member by email. Creates a User with temp password if they don't exist.
 */
export async function inviteMember(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId;

  if (!tenantId) {
    res.status(400).json({
      status: 'error',
      message: 'Tenant context missing.',
    });
    return;
  }

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, role } = parsed.data;

  try {
    // 1. Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // 2. Check if they are already a member of this tenant
      const existingMember = await prisma.tenantMember.findUnique({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId,
          },
        },
      });

      if (existingMember) {
        res.status(400).json({
          status: 'error',
          message: 'User is already a member of this tenant.',
        });
        return;
      }
    } else {
      // 3. User does not exist, create a new User with default temp password
      const BCRYPT_ROUNDS = 10;
      const defaultPasswordHash = await bcrypt.hash('changeme123', BCRYPT_ROUNDS);

      user = await prisma.user.create({
        data: {
          email,
          passwordHash: defaultPasswordHash,
          globalRole: 'USER',
        },
      });
    }

    // 4. Create TenantMember linking the User to req.tenantId with specified role
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
      data: { member: tenantMember },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to invite member.',
    });
  }
}

/**
 * DELETE /api/v1/team/:id
 * Remove a member from the tenant. OWNER cannot be removed.
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
    const member = await prisma.tenantMember.findUnique({
      where: { id },
    });

    if (!member) {
      res.status(404).json({
        status: 'error',
        message: 'Team member record not found.',
      });
      return;
    }

    if (member.tenantId !== tenantId) {
      res.status(403).json({
        status: 'error',
        message: 'Unauthorized: Member does not belong to this tenant.',
      });
      return;
    }

    if (member.role === 'OWNER') {
      res.status(400).json({
        status: 'error',
        message: 'Cannot remove the OWNER of the workspace.',
      });
      return;
    }

    await prisma.tenantMember.delete({
      where: { id },
    });

    res.status(200).json({
      status: 'success',
      message: 'Team member removed successfully.',
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to remove team member.',
    });
  }
}
