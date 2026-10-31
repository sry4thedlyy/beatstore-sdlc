import assert from 'node:assert/strict';
import { createApp } from '../src/server/app.js';
import { openDatabase } from '../src/server/infrastructure/database.js';

const db = await openDatabase();
const server = createApp(db.pool).listen(0, '127.0.0.1');
try {
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.status, 'ok');
  assert.equal(result.database, 'PostgreSQL');
  console.log(`DEV-01 passed: ${result.version}, HTTP health = 200`);
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.close();
}
