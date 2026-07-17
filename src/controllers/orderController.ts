import type { Request, Response } from 'express';
import { prisma } from '../utils/prismaClient';
import { createOrderSchema, editOrderSchema } from '../validation/orderSchemas';
import { AppError } from '../utils/AppError';
import { z } from 'zod';
import { ORDER_STATUSES, ALLOWED_TRANSITIONS, EDITABLE_STATUSES } from '../constants/orderStatus';
import type { OrderStatus } from '../constants/orderStatus';
import { decrementStockForOrder, restockForOrder } from '../utils/stockOps';

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

  const { customerName, customerEmail, items, customerType, companyName, cui, regCom, phone, deliveryAddress } = parsed.data;

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
    // Note: Admin orders are created as PENDING with stockDecremented=false.
    // No stock decrement happens at creation; it is deferred until status transition to PAID.
    const createdOrder = await tx.order.create({
      data: {
        tenantId,
        customerName,
        customerEmail,
        phone,
        deliveryAddress,
        totalAmount: calculatedTotal,
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

// ── PATCH /api/v1/orders/:id/status ──────────────────────────────────────────
const statusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    throw new AppError(400, 'INVALID_ORDER_ID', 'Invalid order ID parameter.');
  }

  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: 'error',
      code: 'INVALID_ORDER_STATUS',
      message: parsed.error.issues[0]?.message || 'Invalid order status value.',
    });
    return;
  }

  const { status } = parsed.data;

  // 1. Verify the order exists and belongs to the tenant
  const order = await prisma.order.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }

  const currentStatus = order.status as OrderStatus;
  const requestedStatus = status as OrderStatus;

  // Gating rules:
  if (requestedStatus === currentStatus) {
    throw new AppError(400, 'SAME_STATUS', `Order is already in status ${requestedStatus}.`);
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(requestedStatus)) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `Cannot change status from ${currentStatus} to ${requestedStatus}.`
    );
  }

  // 2. Update status and handle stock transitions atomically inside a transaction
  const updatedOrder = await prisma.$transaction(async (tx) => {
    // If transitioning INTO PAID or CONFIRMED (and it hasn't been decremented yet)
    if (requestedStatus === 'PAID' || requestedStatus === 'CONFIRMED') {
      if (!order.stockDecremented) {
        await decrementStockForOrder(tx, order);
        return await tx.order.update({
          where: { id },
          data: {
            status: requestedStatus,
            stockDecremented: true,
          },
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
        });
      }
    }
    // If transitioning INTO CANCELLED (and it has previously decremented stock)
    else if (requestedStatus === 'CANCELLED') {
      if (order.stockDecremented) {
        await restockForOrder(tx, order);
        return await tx.order.update({
          where: { id },
          data: {
            status: requestedStatus,
            stockDecremented: false,
          },
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
        });
      }
    }

    // Default transition (e.g. SHIPPED, DELIVERED, or other statuses that do not alter stock)
    return await tx.order.update({
      where: { id },
      data: { status: requestedStatus },
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
    });
  });

  res.status(200).json({
    status: 'success',
    data: { order: updatedOrder },
  });
}

// ── GET /api/v1/orders/:id ───────────────────────────────────────────────────
export async function getOrderById(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    throw new AppError(400, 'INVALID_ORDER_ID', 'Invalid order ID parameter.');
  }

  const order = await prisma.order.findFirst({
    where: {
      id,
      tenantId,
    },
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
  });

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }

  res.status(200).json({
    status: 'success',
    data: { order },
  });
}

// ── PUT /api/v1/orders/:id ───────────────────────────────────────────────────
export async function updateOrder(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    throw new AppError(400, 'INVALID_ORDER_ID', 'Invalid order ID parameter.');
  }

  // 1. Fetch the order matching id and tenantId
  const order = await prisma.order.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }

  // 2. Gate: if order status not in EDITABLE_STATUSES
  // Note: Only PENDING orders are editable. Since PENDING orders have not decremented stock,
  // editing the order items here does not require any stock adjustments.
  if (!EDITABLE_STATUSES.includes(order.status as OrderStatus)) {
    throw new AppError(
      409,
      'ORDER_NOT_EDITABLE',
      `Only pending orders can be edited. This order is ${order.status}.`
    );
  }

  // 3. Validate body with editOrderSchema
  const parsed = editOrderSchema.safeParse(req.body);
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

  const { customerName, customerEmail, items, customerType, companyName, cui, regCom, phone, deliveryAddress } = parsed.data;

  // Execute updates in a database transaction
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

    // 3. Delete existing OrderItems for this order
    await tx.orderItem.deleteMany({
      where: { orderId: id },
    });

    // 4. Update the order fields and recreate items
    const updatedOrder = await tx.order.update({
      where: { id },
      data: {
        customerName,
        customerEmail,
        phone,
        deliveryAddress,
        totalAmount: calculatedTotal,
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
    });

    return updatedOrder;
  });

  res.status(200).json({
    status: 'success',
    data: { order: result },
  });
}



