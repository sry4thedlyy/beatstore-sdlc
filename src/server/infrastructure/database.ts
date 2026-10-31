import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { config } from '../config.js';
import { startLocalPostgres } from './local-postgres.js';

export interface Database {
  pool: pg.Pool;
  mode: 'external' | 'local';
  close(): Promise<void>;
}

interface LocalSettings { port: number; user: string; password: string }

export async function openDatabase(): Promise<Database> {
  if (config.databaseUrl) {
    const pool = new pg.Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 5000 });
    await pool.query('SELECT 1');
    return { pool, mode: 'external', close: () => pool.end() };
  }

  await mkdir(config.dataDir, { recursive: true });
  const settingsPath = path.join(config.dataDir, 'database-settings.json');
  let settings: LocalSettings;
  try {
    settings = JSON.parse(await readFile(settingsPath, 'utf8')) as LocalSettings;
    if (settings.port !== config.localPgPort || settings.user !== 'beatstore' || !settings.password) {
      throw new Error('Local database settings do not match LOCAL_PG_PORT');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    settings = { port: config.localPgPort, user: 'beatstore', password: randomBytes(24).toString('hex') };
    await writeFile(settingsPath, JSON.stringify(settings), { flag: 'wx', mode: 0o600 });
  }
  const connection = { host: '127.0.0.1', ...settings, database: 'postgres', connectionTimeoutMillis: 5000 };
  const probe = new pg.Client(connection);
  let owned: { stop(): Promise<void> } | undefined;
  try {
    await probe.connect();
    await probe.end();
  } catch (error) {
    await probe.end().catch(() => undefined);
    if (!['ECONNREFUSED', 'ECONNRESET'].includes((error as NodeJS.ErrnoException).code || '')) throw error;
    owned = await startLocalPostgres({ dataDir: config.dataDir, ...settings });
  }
  const admin = new pg.Client(connection);
  await admin.connect();
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', ['beatstore']);
    if (!existing.rowCount) await admin.query('CREATE DATABASE beatstore');
  } finally { await admin.end(); }
  const pool = new pg.Pool({ ...connection, database: 'beatstore', max: 8 });
  await pool.query('SELECT 1');
  return {
    pool,
    mode: 'local',
    async close() {
      await pool.end();
      if (owned) await owned.stop();
    },
  };
}
