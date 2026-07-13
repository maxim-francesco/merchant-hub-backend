import { Router } from 'express';
import { login, getMyTenants, getMe } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// POST /api/v1/auth/login — Authenticate a user and return a JWT
router.post('/login', login);

// GET /api/v1/auth/me — Fetch current logged-in user profile
router.get('/me', authMiddleware, getMe);

// GET /api/v1/auth/me/tenants — Fetch tenants the user belongs to
router.get('/me/tenants', authMiddleware, getMyTenants);

export default router;

