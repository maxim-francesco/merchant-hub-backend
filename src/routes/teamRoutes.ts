import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { tenantContext } from '../middlewares/tenantContext';
import { requireMembership } from '../middlewares/requireMembership';
import { getTeamMembers, createMember, removeMember } from '../controllers/teamController';
import { requireRole, PRIVILEGED } from '../middlewares/requireRole';

const router = Router();

// Apply auth middleware and tenant context to all team routes
router.use(authMiddleware);
router.use(tenantContext);
router.use(requireMembership);

// GET /api/v1/team — List workspace team members
router.get('/', getTeamMembers);

// POST /api/v1/team/invite — Create a new member account
router.post('/invite', requireRole(...PRIVILEGED), createMember);

// DELETE /api/v1/team/:id — Remove a member from the workspace
router.delete('/:id', requireRole(...PRIVILEGED), removeMember);

export default router;
