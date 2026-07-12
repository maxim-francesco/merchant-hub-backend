import { Router } from 'express';
import { uploadImage } from '../middlewares/uploadMiddleware';
import { uploadMedia } from '../controllers/mediaController';
import { tenantContext } from '../middlewares/tenantContext';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireMembership } from '../middlewares/requireMembership';

const router = Router();

// Secure the route with auth and tenant context
router.post('/upload', authMiddleware, tenantContext, requireMembership, uploadImage.single('file'), uploadMedia);

export default router;
