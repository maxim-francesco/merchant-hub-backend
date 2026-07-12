import type { Request, Response, NextFunction } from 'express';

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
