import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { Server } from 'node:http';
import { config } from '../src/server/config.js';
import { createApp } from '../src/server/app.js';
import { normalizeSearch } from '../src/server/catalog/model.js';
import { seedCatalog } from '../src/server/demo/seed.js';
import { isolatedDatabase } from './helpers/database.js';
import type { CatalogResponse, Product } from '../src/shared/catalog.js';

let db: Awaited<ReturnType<typeof isolatedDatabase>>;
let server: Server;
let base: string;
const storageRoot = path.resolve(config.dataDir, `test-api-${randomUUID()}`);
before(async () => {
  db = await isolatedDatabase();
  await seedCatalog(db.pool, storageRoot);
  server = createApp(db.pool, storageRoot).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  if (db) await db.close();
  const relative = path.relative(config.dataDir, storageRoot);
  assert(relative.startsWith('test-api-') && !relative.includes(path.sep));
  await rm(storageRoot, { recursive: true, force: true });
});
async function catalog(query = ''): Promise<CatalogResponse> {
  const res = await fetch(`${base}/api/products${query}`);
  assert.equal(res.status, 200);
  return res.json();
}

test('catalog returns five published products and filters three beats / two drumkits', async () => {
  assert.equal((await catalog()).total, 5);
  assert.equal((await catalog('?type=beat')).total, 3);
  assert.equal((await catalog('?type=drumkit')).total, 2);
  assert.equal((await catalog('?q=NIGHT')).items[0]?.slug, 'night-drive');
  assert.equal((await catalog('?q=not-a-song')).total, 0);
});
test('Unicode title search is normalized, SQL metacharacters remain literal', async () => {
  await db.pool.query("UPDATE products SET title=$1,title_search=$2 WHERE slug='night-drive'", ['Ночной бит', normalizeSearch('Ночной бит')]);
  try {
    assert.equal((await catalog(`?q=${encodeURIComponent(' НОЧНОЙ ')}`)).total, 1);
    assert.equal((await catalog(`?q=${encodeURIComponent("' OR 1=1 --")}`)).total, 0);
    assert.equal((await catalog('?q=%25')).total, 0);
  } finally {
    await db.pool.query("UPDATE products SET title='Night Drive',title_search='night drive' WHERE slug='night-drive'");
  }
});
test('invalid query shapes and overlong queries return 400', async () => {
  for (const query of ['?type=admin', '?q=a&q=b', `?q=${'x'.repeat(141)}`]) {
    assert.equal((await fetch(`${base}/api/products${query}`)).status, 400);
  }
});
test('card exposes format and exact prices but no private file metadata', async () => {
  const response = await fetch(`${base}/api/products/night-drive`);
  const product: Product = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(product.variants.map(v => v.kind), ['mp3', 'wav', 'trackout', 'exclusive']);
  assert.equal(product.variants[1]?.bundle, 'WAV-файл');
  assert.equal(product.variants[0]?.price, '1490.00');
  const serialized = JSON.stringify(product);
  for (const forbidden of ['storage_key', 'private/', 'sha256', 'original_name', 'template_version']) assert(!serialized.includes(forbidden));
});
test('draft, archived and incomplete products are hidden with their public media', async () => {
  const item = (await catalog('?q=night')).items[0]!;
  for (const state of ['draft', 'archived']) {
    await db.pool.query('UPDATE products SET publication_status=$1 WHERE id=$2', [state, item.id]);
    assert.equal((await catalog()).total, 4);
    assert.equal((await fetch(`${base}/api/products/night-drive`)).status, 404);
    assert.equal((await fetch(base + item.demoUrl)).status, 404);
  }
  await db.pool.query("UPDATE products SET publication_status='published' WHERE id=$1", [item.id]);
  const relation = await db.pool.query('DELETE FROM variant_files WHERE variant_id=(SELECT id FROM purchase_variants WHERE product_id=$1 AND kind=\'wav\') RETURNING *', [item.id]);
  assert.equal((await catalog()).total, 4);
  assert.equal((await fetch(`${base}/api/products/night-drive`)).status, 404);
  const row = relation.rows[0];
  await db.pool.query('INSERT INTO variant_files(variant_id,file_id,product_id) VALUES($1,$2,$3)', [row.variant_id, row.file_id, row.product_id]);
});
test('public cover and demo are real files, audio supports Range; private files stay closed', async () => {
  const item = (await catalog()).items[0]!;
  const cover = await fetch(base + item.coverUrl);
  assert.equal(cover.status, 200);
  assert.equal(cover.headers.get('content-type'), 'image/png');
  assert.deepEqual([...new Uint8Array(await cover.arrayBuffer()).slice(0, 4)], [137, 80, 78, 71]);
  const demo = await fetch(base + item.demoUrl, { headers: { Range: 'bytes=0-43' } });
  assert.equal(demo.status, 206);
  assert.equal(Buffer.from(await demo.arrayBuffer()).toString('ascii', 0, 4), 'RIFF');
  const privateFile = (await db.pool.query("SELECT id,storage_key FROM product_files WHERE purpose='primary' LIMIT 1")).rows[0];
  for (const url of [`/api/media/${privateFile.id}`, `/${privateFile.storage_key}`, '/.local/database-settings.json', '/src/server/config.ts', '/api/media/invalid', '/api/products/missing']) {
    assert.equal((await fetch(base + url)).status, 404, url);
  }
});
