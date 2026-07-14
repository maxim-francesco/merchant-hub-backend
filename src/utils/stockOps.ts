import { Prisma } from '@prisma/client';
import { AppError } from './AppError';

/**
 * Decrements the stock of all products in the given order atomically.
 * If stock is insufficient for any item, throws AppError with INSUFFICIENT_STOCK code.
 */
export async function decrementStockForOrder(
  tx: Omit<Prisma.TransactionClient, '$transaction' | '$on' | '$connect' | '$disconnect' | '$use'>,
  order: { id: string; tenantId: string }
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId: order.id },
  });

  for (const item of items) {
    const result = await tx.product.updateMany({
      where: {
        id: item.productId,
        tenantId: order.tenantId,
        stock: { gte: item.quantity },
      },
      data: {
        stock: { decrement: item.quantity },
      },
    });

    if (result.count === 0) {
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        `Insufficient stock for product ID ${item.productId}.`
      );
    }
  }
}

/**
 * Restocks all products in the given order.
 */
export async function restockForOrder(
  tx: Omit<Prisma.TransactionClient, '$transaction' | '$on' | '$connect' | '$disconnect' | '$use'>,
  order: { id: string; tenantId: string }
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId: order.id },
  });

  for (const item of items) {
    await tx.product.updateMany({
      where: {
        id: item.productId,
        tenantId: order.tenantId,
      },
      data: {
        stock: { increment: item.quantity },
      },
    });
  }
}
