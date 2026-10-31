import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import { openDatabase } from '../../src/server/infrastructure/database.js';
import { migrate } from '../../src/server/infrastructure/migrations.js';

export async function isolatedDatabase() {
  const database = await openDatabase();
  const schema = `verification_${randomUUID().replaceAll('-', '')}`;
  assert(/^verification_[a-f0-9]{32}$/.test(schema));
  await database.pool.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    ...database.pool.options,
    password: database.pool.options.password,
    connectionString: database.pool.options.connectionString,
    options: `-c search_path=${schema}`, max: 4,
  });
  try {
    const result = await pool.query('SHOW search_path');
    assert.equal(result.rows[0].search_path, schema);
    await migrate(pool);
  } catch (error) {
    await pool.end();
    await database.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await database.close();
    throw error;
  }
  return {
    pool,
    async close() {
      await pool.end();
      await database.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.close();
    },
  };
}
