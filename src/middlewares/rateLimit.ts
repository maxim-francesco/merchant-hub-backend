import rateLimit from 'express-rate-limit';

// Strict limiter for auth login: brute-force protection.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Please try again later.' },
});

// Lenient global limiter for the rest of the API. Skips the Stripe webhook path.
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/v1/webhooks'),
  message: { status: 'error', code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please slow down.' },
});
