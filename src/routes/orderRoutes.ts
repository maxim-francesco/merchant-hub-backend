import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { tenantContext } from '../middlewares/tenantContext';
import { requireMembership } from '../middlewares/requireMembership';
import { getOrders, createOrder, updateOrderStatus, getOrderById } from '../controllers/orderController';
import { downloadInvoice } from '../controllers/invoiceController';

const router = Router();

// Protect all order routes
router.use(authMiddleware);
router.use(tenantContext);
router.use(requireMembership);

// GET /api/v1/orders
router.get('/', getOrders);

// POST /api/v1/orders
router.post('/', createOrder);

// PATCH /api/v1/orders/:id/status
router.patch('/:id/status', updateOrderStatus);

// GET /api/v1/orders/:id/invoice — Download order PDF invoice
router.get('/:id/invoice', downloadInvoice);

// GET /api/v1/orders/:id — Retrieve order by ID
router.get('/:id', getOrderById);

export default router;
