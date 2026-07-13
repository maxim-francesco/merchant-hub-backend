import type { Request, Response } from 'express';
import { prisma } from '../utils/prismaClient';
import { createOrderSchema } from '../validation/orderSchemas';
import { AppError } from '../utils/AppError';

// ── GET /api/v1/orders ────────────────────────────────────────────────────────
export async function getOrders(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  const orders = await prisma.order.findMany({
    where: { tenantId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              price: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({
    status: 'success',
    data: { orders },
  });
}

// ── POST /api/v1/orders ───────────────────────────────────────────────────────
export async function createOrder(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  const parsed = createOrderSchema.safeParse(req.body);
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

  const { customerName, customerEmail, items } = parsed.data;

  // Execute everything in a safe database transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Fetch matching products to get official database prices (prevent price spoofing)
    const productIds = items.map((item) => item.productId);
    const dbProducts = await tx.product.findMany({
      where: {
        id: { in: productIds },
        tenantId,
      },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // 2. Validate products existence and calculate total
    let calculatedTotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new AppError(
          400,
          'PRODUCT_NOT_FOUND',
          `Product with ID ${item.productId} not found or belongs to another tenant.`
        );
      }

      const qty = item.quantity;
      if (qty <= 0 || !Number.isInteger(qty)) {
        throw new AppError(
          400,
          'INVALID_QUANTITY',
          `Invalid quantity for product ${product.name}.`
        );
      }

      const priceNum = Number(product.price);
      calculatedTotal += priceNum * qty;

      orderItemsData.push({
        productId: product.id,
        quantity: qty,
        price: product.price, // Locked price from the database
      });
    }

    // 3. Create the Order with nested OrderItems
    const createdOrder = await tx.order.create({
      data: {
        tenantId,
        customerName,
        customerEmail,
        totalAmount: calculatedTotal,
        items: {
          create: orderItemsData.map((oi) => ({
            productId: oi.productId,
            quantity: oi.quantity,
            price: oi.price,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return createdOrder;
  });

  res.status(201).json({
    status: 'success',
    data: { order: result },
  });
}
