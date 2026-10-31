import { openDatabase } from '../src/server/infrastructure/database.js';
import { migrate } from '../src/server/infrastructure/migrations.js';

const db = await openDatabase();
try {
  const applied = await migrate(db.pool);
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database schema is up to date');
} finally { await db.close(); }
