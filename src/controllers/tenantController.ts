import { prisma } from '../utils/prismaClient';
import type { Request, Response } from 'express';
import { z } from 'zod';

const createTenantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only'),
});

export async function createTenant(req: Request, res: Response): Promise<void> {
  const parsed = createTenantSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { name, slug } = parsed.data;

  const tenant = await prisma.tenant.create({
    data: { name, slug },
  });

  res.status(201).json({
    status: 'success',
    data: tenant,
  });
}

// ── GET /api/v1/tenants/current ──────────────────────────────────────────────
export async function getCurrentTenant(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      res.status(404).json({
        status: 'error',
        message: 'Tenant not found.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: { tenant },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to retrieve current tenant settings.',
    });
  }
}

// ── PUT /api/v1/tenants/current ──────────────────────────────────────────────
const updateTenantSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only')
    .optional(),
  settings: z.record(z.string(), z.any()).optional(),
});

export async function updateCurrentTenant(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  const parsed = updateTenantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { name, slug, settings } = parsed.data;

  try {
    const currentTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!currentTenant) {
      res.status(404).json({
        status: 'error',
        message: 'Tenant not found.',
      });
      return;
    }

    // Check slug conflict
    if (slug && slug !== currentTenant.slug) {
      const slugConflict = await prisma.tenant.findUnique({
        where: { slug },
      });
      if (slugConflict) {
        res.status(400).json({
          status: 'error',
          message: 'Slug is already in use by another store.',
        });
        return;
      }
    }

    // Merge settings if present
    const existingSettings = (currentTenant.settings as Record<string, any>) || {};
    const mergedSettings = settings ? { ...existingSettings, ...settings } : existingSettings;

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: name ?? currentTenant.name,
        slug: slug ?? currentTenant.slug,
        settings: mergedSettings,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { tenant: updatedTenant },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update tenant settings.',
    });
  }
}

