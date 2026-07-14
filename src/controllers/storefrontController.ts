import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../utils/prismaClient';
import { checkoutSchema } from '../validation/orderSchemas';
import { AppError } from '../utils/AppError';
import { getPublicBaseUrl } from '../utils/getPublicBaseUrl';
import { SETTINGS_KEYS } from '../constants/settingsKeys';

// ── GET /api/v1/storefront/categories ────────────────────────────────────────
export async function getPublicCategories(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  try {
    const categories = await prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { categories },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to retrieve categories.',
    });
  }
}

// ── GET /api/v1/storefront/products ──────────────────────────────────────────
export async function getPublicProducts(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  try {
    const products = await prisma.product.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        stock: true,
        attributes: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: { products },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to retrieve products.',
    });
  }
}

// ── POST /api/v1/storefront/checkout ─────────────────────────────────────────
interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

export async function processCheckout(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssueMessage = parsed.error.issues[0]?.message || 'Validation failed';
    const flattenedErrors = parsed.error.flatten().fieldErrors;
    res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: firstIssueMessage,
      issues: flattenedErrors,
    });
    return;
  }

  const { customerName, customerEmail, items, customerType, companyName, cui, regCom } = parsed.data;

  // 1. Fetch Tenant to verify Stripe payment settings
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant not found.');
  }

  const settings = (tenant.settings as Record<string, any>) || {};
  const stripeSecretKey = settings[SETTINGS_KEYS.STRIPE_SECRET_KEY];

  if (!stripeSecretKey) {
    throw new AppError(400, 'PAYMENT_NOT_CONFIGURED', 'Store payment gateway not configured.');
  }

  // 2. Fetch products and calculate total price inside database transaction
  const { createdOrder, lineItems } = await prisma.$transaction(async (tx) => {
    const productIds = items.map((item) => item.productId);
    const dbProducts = await tx.product.findMany({
      where: {
        id: { in: productIds },
        tenantId,
      },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));
    let calculatedTotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new AppError(
          400,
          'PRODUCT_NOT_FOUND',
          `Product with ID ${item.productId} was not found or is inactive.`
        );
      }

      const qty = item.quantity;
      if (qty <= 0 || !Number.isInteger(qty)) {
        throw new AppError(
          400,
          'INVALID_QUANTITY',
          `Invalid quantity for product: ${product.name}.`
        );
      }

      // Soft check at storefront checkout: reject if requested quantity exceeds current stock
      if (product.stock < qty) {
        throw new AppError(
          409,
          'INSUFFICIENT_STOCK',
          'Insufficient stock for one or more products.'
        );
      }

      const priceNum = Number(product.price);
      calculatedTotal += priceNum * qty;

      orderItemsData.push({
        productId: product.id,
        quantity: qty,
        price: product.price,
      });
    }

    // Create the storefront Order
    const order = await tx.order.create({
      data: {
        tenantId,
        customerName,
        customerEmail,
        totalAmount: calculatedTotal,
        status: 'PENDING',
        customerType,
        companyName: customerType === 'B2B' ? (companyName || null) : null,
        cui: customerType === 'B2B' ? (cui || null) : null,
        regCom: customerType === 'B2B' ? (regCom || null) : null,
        items: {
          create: orderItemsData.map((oi) => ({
            productId: oi.productId,
            quantity: oi.quantity,
            price: oi.price,
          })),
        },
      },
    });

    // Map items for Stripe
    const lineItems = orderItemsData.map((oi) => {
      const product = productMap.get(oi.productId)!;
      return {
        price_data: {
          currency: 'ron',
          product_data: {
            name: product.name,
            metadata: {
              productId: product.id,
              slug: product.slug,
            },
          },
          unit_amount: Math.round(Number(product.price) * 100), // convert to cents
        },
        quantity: oi.quantity,
      };
    });

    return { createdOrder: order, lineItems };
  });

  // 3. Create Stripe Checkout Session (outside the transaction)
  let sessionUrl = '';
  const base = getPublicBaseUrl();

  if (stripeSecretKey.startsWith('sk_test_mock') || stripeSecretKey === 'sk_test_placeholder') {
    // Simulated redirect URL for testing
    sessionUrl = `${base}/store/${tenant.slug}/success?order_id=mock_cs_${createdOrder.id}`;
  } else {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16' as any,
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      client_reference_id: createdOrder.id,
      success_url: `${base}/store/${tenant.slug}/success?order_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/store/${tenant.slug}`,
    });

    sessionUrl = session.url!;
  }

  res.status(201).json({
    status: 'success',
    data: { url: sessionUrl },
  });
}

// ── GET /api/v1/storefront/resolve/:slug ─────────────────────────────────────
export async function resolveTenantBySlug(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;

  if (!slug || typeof slug !== 'string') {
    res.status(400).json({
      status: 'error',
      message: 'Slug parameter is required and must be a string.',
    });
    return;
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        settings: true,
      },
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
      message: error.message || 'Failed to resolve tenant.',
    });
  }
}

