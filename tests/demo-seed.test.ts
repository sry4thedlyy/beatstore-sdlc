import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { config } from '../src/server/config.js';
import { seedCatalog } from '../src/server/demo/seed.js';
import { isolatedDatabase } from './helpers/database.js';

let db: Awaited<ReturnType<typeof isolatedDatabase>>;
const storageRoot = path.resolve(config.dataDir, `test-assets-${randomUUID()}`);
before(async () => {
  db = await isolatedDatabase();
  await seedCatalog(db.pool, storageRoot);
});
after(async () => {
  if (db) await db.close();
  const relative = path.relative(config.dataDir, storageRoot);
  assert(relative.startsWith('test-assets-') && !relative.includes(path.sep));
  await rm(storageRoot, { recursive: true, force: true });
});

test('seed creates three beats, two drumkits and fourteen complete variants', async () => {
  const result = await db.pool.query(`SELECT type,count(*)::int AS count FROM products WHERE publication_status='published' GROUP BY type ORDER BY type`);
  assert.deepEqual(result.rows, [{ type: 'beat', count: 3 }, { type: 'drumkit', count: 2 }]);
  const count = await db.pool.query('SELECT count(*)::int AS count FROM purchase_variants');
  assert.equal(count.rows[0].count, 14);
});
test('repeating seed does not duplicate or change product records', async () => {
  const before = await db.pool.query('SELECT id,sha256 FROM product_files ORDER BY id');
  await seedCatalog(db.pool, storageRoot);
  const after = await db.pool.query('SELECT id,sha256 FROM product_files ORDER BY id');
  assert.deepEqual(after.rows, before.rows);
  assert.equal(after.rowCount, 24);
});
test('assets match their MIME types, hashes and selected file bundles', async () => {
  const result = await db.pool.query(`SELECT v.kind,f.* FROM purchase_variants v JOIN variant_files vf ON vf.variant_id=v.id JOIN product_files f ON f.id=vf.file_id`);
  for (const row of result.rows) {
    const bytes = await readFile(path.join(storageRoot, row.storage_key));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
    assert.equal(bytes.length, Number(row.byte_size));
    if (row.kind === 'wav') assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    if (row.kind === 'mp3') assert(bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0);
    if (row.kind === 'trackout') {
      const contents = unzipSync(bytes);
      assert.equal(Object.keys(contents).length, 3);
      assert(Object.keys(contents).every((name) => name.endsWith('.wav')));
      for (const file of Object.values(contents)) assert.equal(Buffer.from(file).toString('ascii', 0, 4), 'RIFF');
    }
    if (row.kind === 'exclusive') {
      const contents = unzipSync(bytes);
      const project = JSON.parse(Buffer.from(contents['project.json']!).toString());
      assert.equal(project.format, 'beatstore-demo-project-v1');
      assert.equal(project.tracks.length, 3);
      assert(project.tracks.every((track: string) => contents[track]));
    }
    if (row.kind === 'drumkit') assert.deepEqual(Object.keys(unzipSync(bytes)).sort(), ['hat.wav', 'kick.wav', 'snare.wav']);
  }
});
