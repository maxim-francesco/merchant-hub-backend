import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';

interface CustomError extends Error {
  statusCode?: number;
  status?: string;
  code?: string;
}

export function errorHandler(
  err: CustomError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Centralized Custom Application Error Mapping
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
    });
    return;
  }

  // Centralized Prisma Error Mapping
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        status: 'error',
        code: 'DUPLICATE_RECORD',
        message: 'A record with this slug already exists in this workspace.',
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        status: 'error',
        code: 'RECORD_NOT_FOUND',
        message: 'Record not found.',
      });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({
        status: 'error',
        code: 'RECORD_REFERENCED',
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
    code: 'INTERNAL_ERROR',
    message: isProd && statusCode === 500 ? 'An internal server error occurred.' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
}
