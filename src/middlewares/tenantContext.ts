import type { Request, Response, NextFunction } from 'express';

// Extend Express Request to carry tenantId
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

export function tenantContext(req: Request, res: Response, next: NextFunction): void {
  const tenantId = req.headers['x-tenant-id'];

  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    res.status(400).json({
      status: 'error',
      code: 'TENANT_HEADER_MISSING',
      message: 'Missing required header: x-tenant-id',
    });
    return;
  }

  req.tenantId = tenantId.trim();
  next();
}
