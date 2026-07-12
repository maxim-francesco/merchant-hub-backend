import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// ── Type definitions ────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  globalRole: string;
}

// Augment the Express Request interface globally
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ── Middleware ───────────────────────────────────────────────────────────────

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Missing or malformed Authorization header.',
    });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "
  const secret = process.env['JWT_SECRET'];

  if (!secret) {
    // Guard against missing env var — this is a server misconfiguration
    res.status(500).json({
      status: 'error',
      message: 'Server misconfiguration: JWT secret not set.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Invalid or expired token.',
    });
  }
}
