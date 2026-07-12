import type { Request, Response } from 'express';
import { prisma } from '../utils/prismaClient';

// ── GET /api/v1/orders ────────────────────────────────────────────────────────
export async function getOrders(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  try {
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
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to retrieve orders.',
    });
  }
}

// ── POST /api/v1/orders ───────────────────────────────────────────────────────
interface OrderItemInput {
  productId: string;
  quantity: number;
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware
  const { customerName, customerEmail, items } = req.body;

  if (!customerName || !customerEmail || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({
      status: 'error',
      message: 'Missing or invalid fields: customerName, customerEmail, and a non-empty items array are required.',
    });
    return;
  }

  try {
    // Execute everything in a safe database transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch matching products to get official database prices (prevent price spoofing)
      const productIds = items.map((item: OrderItemInput) => item.productId);
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
          throw new Error(`Product with ID ${item.productId} not found or belongs to another tenant.`);
        }

        const qty = Number(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Invalid quantity for product ${product.name}.`);
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
  } catch (error: any) {
    res.status(error.message?.includes('not found') || error.message?.includes('Invalid quantity') ? 400 : 500).json({
      status: 'error',
      message: error.message || 'Failed to create order.',
    });
  }
}
