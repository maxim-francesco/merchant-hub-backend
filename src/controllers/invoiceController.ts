import type { Request, Response } from 'express';
import { prisma } from '../utils/prismaClient';
import { generateInvoiceBuffer } from '../utils/pdfGenerator';
import { AppError } from '../utils/AppError';

export async function downloadInvoice(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  if (!id || typeof id !== 'string') {
    throw new AppError(400, 'INVALID_ORDER_ID', 'Invalid order ID parameter.');
  }

  // 1. Fetch the Order from database, ensuring it belongs to tenantId
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!order || order.tenantId !== tenantId) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found or access denied.');
  }

  // 2. Fetch Tenant details for the store name
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  // 3. Generate PDF Buffer using utility
  const pdfBuffer = await generateInvoiceBuffer(order, tenant);

  // 4. Set headers for PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Invoice-${order.id.substring(0, 8)}.pdf"`
  );

  // 5. Send PDF buffer
  res.send(pdfBuffer);
}
