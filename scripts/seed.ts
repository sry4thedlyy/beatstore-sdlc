import path from 'node:path';
import { config } from '../src/server/config.js';
import { openDatabase } from '../src/server/infrastructure/database.js';
import { seedCatalog } from '../src/server/demo/seed.js';

const db = await openDatabase();
try {
  await seedCatalog(db.pool, path.join(config.dataDir, 'storage'));
  const result = await db.pool.query('SELECT type, count(*)::int AS count FROM products GROUP BY type ORDER BY type');
  console.log('Demo catalog:', result.rows);
} finally { await db.close(); }
