import { prisma } from '../utils/prismaClient';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { SETTINGS_KEYS } from '../constants/settingsKeys';

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
      data: { tenant: maskTenant(tenant) },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to retrieve current tenant settings.',
    });
  }
}

function maskTenant(tenant: any) {
  if (!tenant || !tenant.settings) return tenant;

  const settings = { ...tenant.settings };
  const stripeSecretKey = settings[SETTINGS_KEYS.STRIPE_SECRET_KEY];
  const stripeWebhookSecret = settings[SETTINGS_KEYS.STRIPE_WEBHOOK_SECRET];

  settings.stripeSecretKeyLast4 = stripeSecretKey && stripeSecretKey.length > 4
    ? stripeSecretKey.slice(-4)
    : null;

  settings.stripeWebhookSecretLast4 = stripeWebhookSecret && stripeWebhookSecret.length > 4
    ? stripeWebhookSecret.slice(-4)
    : null;

  delete settings[SETTINGS_KEYS.STRIPE_SECRET_KEY];
  delete settings[SETTINGS_KEYS.STRIPE_WEBHOOK_SECRET];
  delete settings.paymentGatewayApiKey;

  return {
    ...tenant,
    settings,
  };
}

// ── PUT /api/v1/tenants/current ──────────────────────────────────────────────
const updateTenantSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only')
    .optional(),
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
      data: { tenant: maskTenant(updatedTenant) },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update tenant settings.',
    });
  }
}

