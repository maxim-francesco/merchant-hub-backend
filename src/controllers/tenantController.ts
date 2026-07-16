import { prisma } from '../utils/prismaClient';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { SETTINGS_KEYS } from '../constants/settingsKeys';
import { maskTenant } from '../serializers/tenantSerializer';

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
      data: {
        tenant: maskTenant(tenant),
        myRole: req.membershipRole,
      },
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
  settings: z
    .object({
      stripeSecretKey: z
        .string()
        .regex(/^sk_[A-Za-z0-9_]+$/, 'Invalid Stripe Secret Key format')
        .or(z.literal(''))
        .optional(),
      stripeWebhookSecret: z
        .string()
        .regex(/^whsec_[A-Za-z0-9_]+$/, 'Invalid Stripe Webhook Secret format')
        .or(z.literal(''))
        .optional(),
      enableB2B: z.boolean().optional(),
      enableB2C: z.boolean().optional(),
    })
    .optional(),
});

export async function updateCurrentTenant(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  const parsed = updateTenantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      code: 'SETTINGS_VALIDATION_ERROR',
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { settings } = parsed.data;

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

    // Merge settings if present
    const existingSettings = (currentTenant.settings as Record<string, any>) || {};
    const mergedSettings = { ...existingSettings };

    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        if (value === '') {
          delete mergedSettings[key];
        } else if (value !== undefined) {
          mergedSettings[key] = value;
        }
      }
    }

    // Force settings.currency = 'RON' on every update
    mergedSettings[SETTINGS_KEYS.CURRENCY] = 'RON';

    // name and slug are immutable — always keep the current values
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: currentTenant.name,
        slug: currentTenant.slug,
        settings: mergedSettings,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { tenant: maskTenant(updatedTenant) },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update tenant settings.',
    });
  }
}

