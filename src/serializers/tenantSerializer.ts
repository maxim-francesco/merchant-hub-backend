import { SETTINGS_KEYS } from '../constants/settingsKeys';

// Admin-facing: strips secret values, exposes last4. (moved verbatim from tenantController)
export function maskTenant(tenant: any) {
  if (!tenant || !tenant.settings) return tenant;
  const settings = { ...tenant.settings };
  const stripeSecretKey = settings[SETTINGS_KEYS.STRIPE_SECRET_KEY];
  const stripeWebhookSecret = settings[SETTINGS_KEYS.STRIPE_WEBHOOK_SECRET];
  settings.stripeSecretKeyLast4 = stripeSecretKey && stripeSecretKey.length > 4 ? stripeSecretKey.slice(-4) : null;
  settings.stripeWebhookSecretLast4 = stripeWebhookSecret && stripeWebhookSecret.length > 4 ? stripeWebhookSecret.slice(-4) : null;
  delete settings[SETTINGS_KEYS.STRIPE_SECRET_KEY];
  delete settings[SETTINGS_KEYS.STRIPE_WEBHOOK_SECRET];
  delete settings.paymentGatewayApiKey;
  return { ...tenant, settings };
}

// Public storefront: strict allowlist. NEVER exposes secrets or last4.
export function toPublicStorefrontTenant(tenant: any) {
  const s = (tenant && tenant.settings) || {};
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    settings: {
      currency: s.currency ?? 'RON',
      timezone: s.timezone ?? null,
      features: s.features ?? null,
      enableB2B: s.enableB2B ?? null,
      enableB2C: s.enableB2C ?? null,
      billingMode: s.billingMode ?? null,
      paymentGateways: {
        stripe: {
          enabled: s.paymentGateways?.stripe?.enabled ?? false,
          publicKey: s.paymentGateways?.stripe?.publicKey ?? null,
        },
        paypal: {
          enabled: s.paymentGateways?.paypal?.enabled ?? false,
        },
      },
    },
  };
}
