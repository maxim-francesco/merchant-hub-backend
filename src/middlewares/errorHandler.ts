import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

interface AppError extends Error {
  statusCode?: number;
  status?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Centralized Prisma Error Mapping
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        status: 'error',
        message: 'A record with this slug already exists in this workspace.',
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        status: 'error',
        message: 'Record not found.',
      });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({
        status: 'error',
        message: 'Operation blocked: the record is referenced by other data.',
      });
      return;
    }
  }

  const statusCode = err.statusCode ?? 500;
  const isProd = process.env['NODE_ENV'] === 'production';

  // Log full error server-side; never leak stack traces to clients in production
  console.error(`[ERROR] ${err.message}`, isProd ? '' : err.stack);

  res.status(statusCode).json({
    status: 'error',
    message: isProd && statusCode === 500 ? 'An internal server error occurred.' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
}
