import { Router } from 'express';
import { tenantContext } from '../middlewares/tenantContext';
import {
  getPublicCategories,
  getPublicProducts,
  processCheckout,
  resolveTenantBySlug,
} from '../controllers/storefrontController';

const router = Router();

// Public route to resolve tenant by slug (does not require x-tenant-id header)
router.get('/resolve/:slug', resolveTenantBySlug);

// Apply ONLY tenantContext middleware. No authentication required for public store.
router.use(tenantContext);

// GET /api/v1/storefront/categories
router.get('/categories', getPublicCategories);

// GET /api/v1/storefront/products
router.get('/products', getPublicProducts);

// POST /api/v1/storefront/checkout
router.post('/checkout', processCheckout);

export default router;
