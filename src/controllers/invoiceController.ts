import type { Request, Response } from 'express';
import { prisma } from '../utils/prismaClient';
import { generateInvoiceBuffer } from '../utils/pdfGenerator';

export async function downloadInvoice(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const tenantId = req.tenantId!; // guaranteed by tenantContext middleware

  if (!id || typeof id !== 'string') {
    res.status(400).json({
      status: 'error',
      message: 'Invalid order ID parameter.',
    });
    return;
  }

  try {
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
      res.status(404).json({
        status: 'error',
        message: 'Order not found or access denied.',
      });
      return;
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
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to generate invoice PDF.',
    });
  }
}
