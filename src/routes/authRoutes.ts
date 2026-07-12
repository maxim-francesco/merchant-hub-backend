import { Router } from 'express';
import { login, getMyTenants } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// POST /api/v1/auth/login — Authenticate a user and return a JWT
router.post('/login', login);

// GET /api/v1/auth/me/tenants — Fetch tenants the user belongs to
router.get('/me/tenants', authMiddleware, getMyTenants);

export default router;
