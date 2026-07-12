import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { tenantContext } from '../middlewares/tenantContext';
import { requireMembership } from '../middlewares/requireMembership';
import { getTeamMembers, inviteMember, removeMember } from '../controllers/teamController';

const router = Router();

// Apply auth middleware and tenant context to all team routes
router.use(authMiddleware);
router.use(tenantContext);
router.use(requireMembership);

// GET /api/v1/team — List workspace team members
router.get('/', getTeamMembers);

// POST /api/v1/team/invite — Invite a new member
router.post('/invite', inviteMember);

// DELETE /api/v1/team/:id — Remove a member from the workspace
router.delete('/:id', removeMember);

export default router;
