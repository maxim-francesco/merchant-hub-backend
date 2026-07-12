import { Router } from 'express';
import { handleStripeWebhook } from '../controllers/webhookController';

const router = Router();

// POST /api/v1/webhooks/stripe/:tenantId
router.post('/stripe/:tenantId', handleStripeWebhook);

export default router;
