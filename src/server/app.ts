import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from './db/connection';
import { seedIfEmpty } from './db/seed';
import { createAuthMiddleware } from './auth/security';
import { createAuthRoutes } from './routes/authRoutes';
import { createWorkerRoutes } from './routes/workerRoutes';
import { createAdminRoutes } from './routes/adminRoutes';
import { createAndonRoutes } from './routes/andonRoutes';

export function createApp(customDbPath?: string): Express {
  const db = openDatabase(customDbPath);
  seedIfEmpty(db);

  const uploadsDir =
    customDbPath && customDbPath !== ':memory:'
      ? path.join(path.dirname(customDbPath), 'uploads')
      : path.resolve(process.cwd(), 'data', 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const app = express();
  app.locals.db = db;
  app.disable('x-powered-by');
  app.use(express.json({ limit: '12mb' }));
  app.use('/uploads', express.static(uploadsDir));

  app.use(createAuthMiddleware(db));

  app.get('/api/v1/health', (_req, res) => {
    res.json({ ok: true, service: 'GCCK Thắng Lợi Lean MES API', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1', createAuthRoutes(db));
  app.use('/api/v1', createWorkerRoutes(db, uploadsDir));
  app.use('/api/v1', createAdminRoutes(db));
  app.use('/api/v1', createAndonRoutes(db));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Serve built Vite SPA in production / Playwright E2E mode when dist/client exists
  const clientDistDir = path.resolve(process.cwd(), 'dist', 'client');
  const indexHtmlPath = path.join(clientDistDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    app.use(express.static(clientDistDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        next();
        return;
      }
      res.sendFile(indexHtmlPath);
    });
  }

  return app;
}
