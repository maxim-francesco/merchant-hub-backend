import { Router } from 'express';
import { createTenant, getCurrentTenant, updateCurrentTenant } from '../controllers/tenantController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { tenantContext } from '../middlewares/tenantContext';
import { requireMembership } from '../middlewares/requireMembership';

const router = Router();

// POST /api/v1/tenants — Create a new tenant
router.post('/', createTenant);

// GET /api/v1/tenants/current — Get current tenant settings
router.get('/current', authMiddleware, tenantContext, requireMembership, getCurrentTenant);

// PUT /api/v1/tenants/current — Update current tenant settings
router.put('/current', authMiddleware, tenantContext, requireMembership, updateCurrentTenant);

export default router;
