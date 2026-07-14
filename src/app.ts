import 'dotenv/config';
import express from 'express'; // restarted for prisma client reload
import cors from 'cors';
import helmet from 'helmet';

import { errorHandler } from './middlewares/errorHandler';
import { globalLimiter } from './middlewares/rateLimit';
import tenantRoutes from './routes/tenantRoutes';
import authRoutes from './routes/authRoutes';
import catalogRoutes from './routes/catalogRoutes';
import orderRoutes from './routes/orderRoutes';
import storefrontRoutes from './routes/storefrontRoutes';
import webhookRoutes from './routes/webhookRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import teamRoutes from './routes/teamRoutes';
import mediaRoutes from './routes/mediaRoutes';

const app = express();

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// Place helmet as one of the very first middlewares
app.use(helmet());

// ── Global middlewares ───────────────────────────────────────────────────────
app.use(cors());

// Mount raw body webhook routes before parsing JSON globally and before global rate limiting
app.use('/api/v1/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// Apply global rate limiting for all subsequent JSON/API routes
app.use(globalLimiter);

app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/storefront', storefrontRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/team', teamRoutes);
app.use('/api/v1/media', mediaRoutes);

// ── Global error handler (must be last) ──────────────────────────────────────
// Express 5 natively propagates async errors, so no express-async-errors needed.
app.use(errorHandler);

export default app;

