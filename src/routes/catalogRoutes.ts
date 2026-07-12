import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { tenantContext } from '../middlewares/tenantContext';
import { requireMembership } from '../middlewares/requireMembership';
import { getCategories, getProducts, createProduct, createCategory, updateCategory, deleteCategory, updateProduct, deleteProduct } from '../controllers/catalogController';

const router = Router();

// All catalog routes require:
//   1. a valid Bearer JWT   (authMiddleware)
//   2. an x-tenant-id header (tenantContext)
//   3. membership in the tenant (requireMembership)
router.use(authMiddleware);
router.use(tenantContext);
router.use(requireMembership);

// GET /api/v1/catalog/categories
router.get('/categories', getCategories);

// POST /api/v1/catalog/categories
router.post('/categories', createCategory);

// PUT /api/v1/catalog/categories/:id
router.put('/categories/:id', updateCategory);

// DELETE /api/v1/catalog/categories/:id
router.delete('/categories/:id', deleteCategory);

// GET /api/v1/catalog/products
router.get('/products', getProducts);

// POST /api/v1/catalog/products
router.post('/products', createProduct);

// PUT /api/v1/catalog/products/:id
router.put('/products/:id', updateProduct);

// DELETE /api/v1/catalog/products/:id
router.delete('/products/:id', deleteProduct);

export default router;
