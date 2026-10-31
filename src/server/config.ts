import 'dotenv/config';
import path from 'node:path';

function integer(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Invalid port in ${name}`);
  }
  return value;
}

export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: integer('PORT', 3000),
  localPgPort: integer('LOCAL_PG_PORT', 55432),
  dataDir: path.resolve(process.env.DATA_DIR || '.local'),
  databaseUrl: process.env.DATABASE_URL,
};
