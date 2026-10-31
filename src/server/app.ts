import express from 'express';
import helmet from 'helmet';
import type pg from 'pg';

export function createApp(pool: pg.Pool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.get('/api/health', async (_req, res) => {
    try {
      const result = await pool.query<{ version: string }>('SELECT version() AS version');
      res.json({ status: 'ok', database: 'PostgreSQL', version: result.rows[0]!.version.split(' ').slice(0, 2).join(' ') });
    } catch {
      res.status(503).json({ status: 'unavailable', error: 'База данных недоступна' });
    }
  });
  return app;
}
