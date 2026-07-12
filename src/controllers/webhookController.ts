import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../utils/prismaClient';
import { generateInvoiceBuffer } from '../utils/pdfGenerator';
import { sendReceiptEmail } from '../utils/mailer';

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const { tenantId } = req.params;

  if (!tenantId || typeof tenantId !== 'string') {
    res.status(400).json({
      status: 'error',
      message: 'Tenant ID is required and must be a string.',
    });
    return;
  }

  try {
    // 1. Fetch Tenant from database to get the webhook secret
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

    const settings = (tenant.settings as Record<string, any>) || {};
    const webhookSecret = settings.stripeWebhookSecret;

    if (!webhookSecret) {
      res.status(400).json({
        status: 'error',
        message: 'Store payment webhook not configured.',
      });
      return;
    }

    // 2. Extract signature and parse raw body
    const signature = req.headers['stripe-signature'] as string;
    const bodyString = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;

    let event: Stripe.Event;

    // 3. Signature verification (support offline mock fallback)
    if (webhookSecret.startsWith('whsec_test_mock')) {
      // Mock mode
      try {
        event = JSON.parse(bodyString);
      } catch (err: any) {
        res.status(400).json({
          status: 'error',
          message: `Mock signature parsing failed: ${err.message}`,
        });
        return;
      }
    } else {
      if (!signature) {
        res.status(400).json({
          status: 'error',
          message: 'Missing stripe-signature header.',
        });
        return;
      }
      try {
        event = Stripe.webhooks.constructEvent(bodyString, signature, webhookSecret);
      } catch (err: any) {
        res.status(400).json({
          status: 'error',
          message: `Webhook signature verification failed: ${err.message}`,
        });
        return;
      }
    }

    // 4. Handle events
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.client_reference_id;

      if (orderId) {
        // Update order status to PAID and fetch the full order details (items and products)
        const order = await prisma.order.update({
          where: { id: orderId },
          data: { status: 'PAID' },
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
        console.log(`[Webhook] Order ${orderId} successfully marked as PAID for tenant ${tenantId}.`);

        try {
          // Generate PDF invoice buffer
          const pdfBuffer = await generateInvoiceBuffer(order, tenant);

          // Send automated receipt email with the invoice attached
          await sendReceiptEmail(order.customerEmail, order, tenant, pdfBuffer);
          console.log(`[Webhook] Invoice receipt successfully sent/logged for order ${orderId}.`);
        } catch (emailErr: any) {
          console.error(`[Webhook] Failed to send receipt email for order ${orderId}:`, emailErr.message || emailErr);
        }
      } else {
        console.warn('[Webhook] checkout.session.completed missing client_reference_id.');
      }
    }

    // Return 200 OK immediately to Stripe
    res.status(200).json({ received: true });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error.message || 'Webhook processing failed.',
    });
  }
}
