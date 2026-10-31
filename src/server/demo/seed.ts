import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { cover, makeSound, mp3, sampleRate, stableId, wav, zip } from './assets.js';
import { normalizeSearch, type ProductType, type VariantKind, type FilePurpose } from '../catalog/model.js';

export const demoProducts = [
  { slug: 'night-drive', title: 'Night Drive', type: 'beat', genre: 'Trap', bpm: 140, key: 'A minor', description: 'Тёмная мелодия, упругий бас и пространство для голоса. Синтетический учебный бит.' },
  { slug: 'amber-hour', title: 'Amber Hour', type: 'beat', genre: 'Lo-fi', bpm: 86, key: 'C minor', description: 'Тёплый медленный грув с мягкой мелодией. Синтетический учебный бит.' },
  { slug: 'glacier', title: 'Glacier', type: 'beat', genre: 'Hip-hop', bpm: 96, key: 'D minor', description: 'Чёткий ритм и холодное мелодическое пространство. Синтетический учебный бит.' },
  { slug: 'neon-drums', title: 'Neon Drums', type: 'drumkit', genre: 'Electronic', bpm: 120, key: null, description: 'Синтетические kick, snare и hi-hat в отдельных WAV-файлах. Учебный набор ударных.' },
  { slug: 'tape-dust', title: 'Tape Dust', type: 'drumkit', genre: 'Lo-fi', bpm: 92, key: null, description: 'Мягкие синтетические ударные и короткий ритмический демофрагмент. Учебный драмкит.' },
] as const;

export async function seedCatalog(pool: pg.Pool, storageRoot: string): Promise<void> {
  await mkdir(storageRoot, { recursive: true });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [28501306]);
    for (let index = 0; index < demoProducts.length; index++) {
      const product = demoProducts[index]!;
      const id = stableId(product.slug);
      const existing = await client.query('SELECT id FROM products WHERE id=$1 OR slug=$2', [id, product.slug]);
      if (existing.rowCount) continue;
      await client.query(`INSERT INTO products(id,slug,title,title_search,description,type,genre,bpm,musical_key)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, product.slug, product.title, normalizeSearch(product.title), product.description,
        product.type, product.genre, product.type === 'beat' ? product.bpm : null, product.key]);
      const sound = makeSound(product.bpm, index);
      const store = async (name: string, purpose: FilePurpose, mediaType: string, bytes: Buffer) => {
        const visibility = purpose === 'primary' ? 'private' : 'public';
        const key = `${visibility}/demo-v1/${product.slug}/${name}`;
        const target = path.resolve(storageRoot, key);
        const relative = path.relative(storageRoot, target);
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid seed asset path');
        await mkdir(path.dirname(target), { recursive: true });
        try { await writeFile(target, bytes, { flag: 'wx' }); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          if (!(await readFile(target)).equals(bytes)) throw new Error(`Existing demo asset differs: ${name}`);
        }
        const fileId = stableId(`${product.slug}/${name}`);
        await client.query(`INSERT INTO product_files(id,product_id,purpose,visibility,storage_key,original_name,media_type,byte_size,sha256)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [fileId, id, purpose, visibility, key, name, mediaType, bytes.length,
          createHash('sha256').update(bytes).digest('hex')]);
        return fileId;
      };
      const coverId = await store('cover.png', 'cover', 'image/png', cover(index));
      const excerpt = sound.master.slice(0, sampleRate * 6);
      for (let i = 0; i < excerpt.length; i++) excerpt[i] = excerpt[i]! * Math.min(1, (excerpt.length - i) / (sampleRate * 0.06));
      const demoId = await store('demo.wav', 'demo', 'audio/wav', wav(excerpt));
      const variantFiles: Partial<Record<VariantKind, string>> = {};
      if (product.type === 'beat') {
        variantFiles.mp3 = await store(`${product.slug}.mp3`, 'primary', 'audio/mpeg', mp3(sound.master));
        variantFiles.wav = await store(`${product.slug}.wav`, 'primary', 'audio/wav', wav(sound.master));
        const tracks = { 'tracks/kick.wav': wav(sound.kick), 'tracks/percussion.wav': wav(sound.percussion), 'tracks/melody.wav': wav(sound.melody) };
        variantFiles.trackout = await store(`${product.slug}-trackout.zip`, 'primary', 'application/zip', zip(tracks));
        const manifest = { format: 'beatstore-demo-project-v1', title: product.title, bpm: product.bpm, key: product.key, sampleRate, tracks: Object.keys(tracks) };
        variantFiles.exclusive = await store(`${product.slug}-project.zip`, 'primary', 'application/zip', zip({
          ...tracks, 'project.json': Buffer.from(JSON.stringify(manifest, null, 2)),
          'README.txt': Buffer.from('Original synthetic educational project. project.json describes the arrangement; WAV tracks are included. No proprietary DAW format is claimed.\n'),
        }));
      } else {
        variantFiles.drumkit = await store(`${product.slug}.zip`, 'primary', 'application/zip', zip({
          'kick.wav': wav(sound.kick.slice(0, sampleRate / 2)),
          'hat.wav': wav(sound.percussion.slice(0, sampleRate / 5)),
          'snare.wav': wav(sound.percussion.slice(Math.floor(sampleRate * 60 / product.bpm), Math.floor(sampleRate * (60 / product.bpm + 0.3)))),
        }));
      }
      const prices: Record<VariantKind, string> = { mp3: '1490.00', wav: '2490.00', trackout: '4990.00', exclusive: '24990.00', drumkit: index === 3 ? '990.00' : '1290.00' };
      for (const [kind, fileId] of Object.entries(variantFiles)) {
        const variantId = stableId(`${product.slug}/${kind}`);
        await client.query(`INSERT INTO purchase_variants(id,product_id,product_type,kind,price,terms,terms_version,template_version)
          VALUES($1,$2,$3,$4,$5,$6,'demo-v1',$7)`, [variantId, id, product.type as ProductType, kind, prices[kind as VariantKind],
          'Учебный пример комплекта. Условия коммерческой лицензии будут подготовлены в DEV-18; оплата в этой версии не выполняется.', `${kind}-demo-v1`]);
        await client.query('INSERT INTO variant_files(variant_id,file_id,product_id) VALUES($1,$2,$3)', [variantId, fileId, id]);
      }
      await client.query(`UPDATE products SET cover_file_id=$1,demo_file_id=$2,publication_status='published' WHERE id=$3`, [coverId, demoId, id]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
