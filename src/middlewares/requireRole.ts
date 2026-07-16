import type { Request, Response, NextFunction } from 'express';

export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.membershipRole;

    if (role === 'SUPER_ADMIN') {
      next();
      return;
    }

    if (role && allowed.includes(role)) {
      next();
      return;
    }

    res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN_INSUFFICIENT_ROLE',
      message: 'Forbidden: your role does not permit this action.',
    });
  };
}

export const PRIVILEGED = ['OWNER', 'ADMIN'];
