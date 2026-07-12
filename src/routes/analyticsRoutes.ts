import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { tenantContext } from '../middlewares/tenantContext';
import { requireMembership } from '../middlewares/requireMembership';
import { getDashboardMetrics } from '../controllers/analyticsController';

const router = Router();

// Apply security controls
router.use(authMiddleware);
router.use(tenantContext);
router.use(requireMembership);

// GET /api/v1/analytics
router.get('/', getDashboardMetrics);

export default router;
