import { createApp } from './app.js';
import { config } from './config.js';
import { openDatabase } from './infrastructure/database.js';

const db = await openDatabase();
const server = createApp(db.pool).listen(config.port, config.host, () => {
  console.log(`Beatstore: http://${config.host}:${config.port} (PostgreSQL: ${db.mode})`);
});
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.close();
}
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
server.once('error', async () => {
  console.error('Не удалось запустить HTTP-сервер. Проверьте HOST и PORT.');
  await db.close();
  process.exitCode = 1;
});
