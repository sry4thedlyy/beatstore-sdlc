import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isolatedDatabase } from './helpers/database.js';
import { migrate } from '../src/server/infrastructure/migrations.js';
import { normalizeSearch } from '../src/server/catalog/model.js';

let db: Awaited<ReturnType<typeof isolatedDatabase>>;
const productId = randomUUID();
const otherProductId = randomUUID();
const fileId = randomUUID();
const variantId = randomUUID();
before(async () => {
  db = await isolatedDatabase();
  await db.pool.query(`INSERT INTO products(id,slug,title,title_search,description,type)
    VALUES ($1,'model-beat','Ночной бит',$2,'Тестовая запись','beat'),
           ($3,'model-kit','Kit','kit','Тестовая запись','drumkit')`, [productId, normalizeSearch('Ночной бит'), otherProductId]);
  await db.pool.query(`INSERT INTO product_files(id,product_id,purpose,visibility,storage_key,original_name,media_type,byte_size,sha256)
    VALUES ($1,$2,'primary','private','private/model.wav','model.wav','audio/wav',100,$3)`, [fileId, productId, 'a'.repeat(64)]);
  await db.pool.query(`INSERT INTO purchase_variants(id,product_id,product_type,kind,price,terms,terms_version,template_version)
    VALUES ($1,$2,'beat','wav','1490.01','Test','test-v1','wav-v1')`, [variantId, productId]);
});
after(async () => { if (db) await db.close(); });

test('migration applies to an empty PostgreSQL schema and is idempotent', async () => {
  assert.deepEqual(await migrate(db.pool), []);
  const result = await db.pool.query('SELECT count(*)::int AS count FROM schema_migrations');
  assert.equal(result.rows[0].count, 1);
});
test('money is stored exactly and returned as decimal text', async () => {
  const result = await db.pool.query('SELECT price::text AS price, currency FROM purchase_variants WHERE id=$1', [variantId]);
  assert.equal(result.rows[0].price, '1490.01');
  assert.equal(result.rows[0].currency, 'RUB');
});
test('one product cannot have duplicate variant kinds', async () => {
  await assert.rejects(db.pool.query(`INSERT INTO purchase_variants(id,product_id,product_type,kind,price,terms,terms_version,template_version)
    VALUES($1,$2,'beat','wav',100,'Test','v1','v1')`, [randomUUID(), productId]), { code: '23505' });
});
test('a drumkit cannot receive an exclusive beat variant', async () => {
  await assert.rejects(db.pool.query(`INSERT INTO purchase_variants(id,product_id,product_type,kind,price,terms,terms_version,template_version)
    VALUES($1,$2,'drumkit','exclusive',100,'Test','v1','v1')`, [randomUUID(), otherProductId]), { code: '23514' });
});
test('the product type in a variant must match its product', async () => {
  await assert.rejects(db.pool.query(`INSERT INTO purchase_variants(id,product_id,product_type,kind,price,terms,terms_version,template_version)
    VALUES($1,$2,'beat','mp3',100,'Test','v1','v1')`, [randomUUID(), otherProductId]), { code: '23503' });
});
test('one file can be associated with a matching variant', async () => {
  await db.pool.query('INSERT INTO variant_files(variant_id,file_id,product_id) VALUES($1,$2,$3)', [variantId, fileId, productId]);
  const result = await db.pool.query('SELECT file_id FROM variant_files WHERE variant_id=$1', [variantId]);
  assert.equal(result.rows[0].file_id, fileId);
});
test('files from another product cannot be attached to a variant', async () => {
  const otherFileId = randomUUID();
  await db.pool.query(`INSERT INTO product_files(id,product_id,purpose,visibility,storage_key,original_name,media_type,byte_size,sha256)
    VALUES ($1,$2,'primary','private','private/other.zip','other.zip','application/zip',100,$3)`, [otherFileId, otherProductId, 'c'.repeat(64)]);
  await assert.rejects(db.pool.query('INSERT INTO variant_files(variant_id,file_id,product_id) VALUES($1,$2,$3)',
    [variantId, otherFileId, productId]), { code: '23503' });
});
test('a primary file cannot be public', async () => {
  await assert.rejects(db.pool.query(`INSERT INTO product_files(id,product_id,purpose,visibility,storage_key,original_name,media_type,byte_size,sha256)
    VALUES($1,$2,'primary','public','public/forbidden.wav','forbidden.wav','audio/wav',100,$3)`, [randomUUID(), productId, 'b'.repeat(64)]), { code: '23514' });
});
test('stored file versions cannot be changed in place', async () => {
  await assert.rejects(db.pool.query('UPDATE product_files SET storage_key=$1 WHERE id=$2', ['private/replaced.wav', fileId]), { code: '23514' });
});
test('search normalization supports Cyrillic and canonical Unicode', () => {
  assert.equal(normalizeSearch('  НОЧНОЙ БИТ  '), 'ночной бит');
  assert.equal(normalizeSearch('Й'), normalizeSearch('И\u0306'));
});
