import express from 'express';
import helmet from 'helmet';
import type pg from 'pg';
import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { config } from './config.js';
import { getProduct, getPublicFile, listProducts } from './catalog/repository.js';
import { normalizeSearch } from './catalog/model.js';

export function createApp(pool: pg.Pool, storageRoot = path.join(config.dataDir, 'storage')) {
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
  app.get('/api/products', async (req, res) => {
    const q = req.query.q ?? '';
    const type = req.query.type;
    if (typeof q !== 'string' || q.length > 140 || (type !== undefined && type !== 'beat' && type !== 'drumkit')) {
      res.status(400).json({ error: 'Некорректный поисковый запрос или тип товара' });
      return;
    }
    const items = await listProducts(pool, normalizeSearch(q), type);
    res.json({ items, total: items.length });
  });
  app.get('/api/products/:slug', async (req, res) => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(req.params.slug) || req.params.slug.length > 120) {
      res.status(404).json({ error: 'Товар не найден' }); return;
    }
    const product = await getProduct(pool, req.params.slug);
    if (!product) { res.status(404).json({ error: 'Товар не найден' }); return; }
    res.json(product);
  });
  app.get('/api/media/:id', async (req, res) => {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.id)) {
      res.status(404).json({ error: 'Файл не найден' }); return;
    }
    const file = await getPublicFile(pool, req.params.id);
    if (!file) { res.status(404).json({ error: 'Файл не найден' }); return; }
    let root: string;
    let relative: string;
    try {
      root = await realpath(storageRoot);
      const target = await realpath(path.resolve(root, file.storage_key));
      relative = path.relative(root, target);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid file path');
    } catch {
      res.status(404).json({ error: 'Файл не найден' }); return;
    }
    res.type(file.media_type).sendFile(relative, { root, dotfiles: 'deny', maxAge: 0 });
  });
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Маршрут не найден' }); });
  const clientRoot = path.resolve('dist/client');
  app.use('/assets', express.static(path.join(clientRoot, 'assets'), { index: false, dotfiles: 'deny', immutable: true, maxAge: '1y' }));
  app.get('/favicon.svg', (_req, res) => { res.sendFile(path.join(clientRoot, 'favicon.svg')); });
  app.get(['/', '/products/:slug'], (_req, res) => { res.sendFile(path.join(clientRoot, 'index.html')); });
  const errors: express.ErrorRequestHandler = (_error, _req, res, _next) => {
    if (res.headersSent) { res.destroy(); return; }
    res.status(503).json({ error: 'Сервис временно недоступен. Попробуйте ещё раз.' });
  };
  app.use(errors);
  return app;
}
