import type pg from 'pg';
import type { Product, ProductType, VariantKind } from '../../shared/catalog.js';
import { bundleLabels, variantLabels } from './model.js';

// Read only complete, published products. Publication editing belongs to DEV-11.
const publicProduct = `
  FROM products p
  JOIN product_files cover ON cover.id=p.cover_file_id AND cover.purpose='cover' AND cover.visibility='public'
  JOIN product_files demo ON demo.id=p.demo_file_id AND demo.purpose='demo' AND demo.visibility='public'
  WHERE p.publication_status='published'
    AND (SELECT count(*) FROM purchase_variants v WHERE v.product_id=p.id) = CASE p.type WHEN 'beat' THEN 4 ELSE 1 END
    AND NOT EXISTS (
      SELECT 1 FROM purchase_variants v WHERE v.product_id=p.id AND (
        (SELECT count(*) FROM variant_files vf WHERE vf.variant_id=v.id) <> 1
        OR NOT EXISTS (
          SELECT 1 FROM variant_files vf JOIN product_files f ON f.id=vf.file_id
          WHERE vf.variant_id=v.id AND f.purpose='primary' AND f.visibility='private'
            AND f.media_type=CASE v.kind WHEN 'mp3' THEN 'audio/mpeg' WHEN 'wav' THEN 'audio/wav' ELSE 'application/zip' END
        )
      )
    )`;

const selectProduct = `SELECT p.id,p.slug,p.title,p.description,p.type,p.genre,p.bpm,
  p.musical_key AS "musicalKey", '/api/media/' || cover.id AS "coverUrl", '/api/media/' || demo.id AS "demoUrl",
  (SELECT json_agg(json_build_object('kind',v.kind,'price',v.price::text,'currency',v.currency)
    ORDER BY CASE v.kind WHEN 'mp3' THEN 1 WHEN 'wav' THEN 2 WHEN 'trackout' THEN 3 WHEN 'exclusive' THEN 4 ELSE 5 END)
    FROM purchase_variants v WHERE v.product_id=p.id) AS variants`;

type Row = Omit<Product, 'variants'> & { variants: { kind: VariantKind; price: string; currency: 'RUB' }[] };
function dto(row: Row): Product {
  return { ...row, variants: row.variants.map(v => ({ ...v, label: variantLabels[v.kind], bundle: bundleLabels[v.kind] })) };
}

export async function listProducts(pool: pg.Pool, query: string, type?: ProductType) {
  const result = await pool.query<Row>(`${selectProduct} ${publicProduct}
    AND strpos(p.title_search,$1)>0 AND ($2::text IS NULL OR p.type=$2)
    ORDER BY p.created_at,p.slug`, [query, type || null]);
  return result.rows.map(dto);
}

export async function getProduct(pool: pg.Pool, slug: string) {
  const result = await pool.query<Row>(`${selectProduct} ${publicProduct} AND p.slug=$1`, [slug]);
  return result.rows[0] ? dto(result.rows[0]) : undefined;
}

export async function getPublicFile(pool: pg.Pool, id: string) {
  // Only current public files of visible products can be addressed, even with a guessed UUID.
  const result = await pool.query<{ storage_key: string; media_type: string }>(`
    SELECT f.storage_key,f.media_type FROM product_files f
    WHERE f.id=$1 AND f.visibility='public' AND f.purpose IN ('cover','demo')
      AND EXISTS (SELECT 1 ${publicProduct} AND f.id IN (p.cover_file_id,p.demo_file_id))`, [id]);
  return result.rows[0];
}
