import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import type { DB } from './index.js';
import { deliveryMethods, productImages, products, productSizes } from './schema.js';
import { processImage } from '../services/media.js';
import type { Storage } from '../services/storage.js';

const here = dirname(fileURLToPath(import.meta.url));
const PHOTO = 'mrakl-zip-front.jpg';
export const findAssetsDir = () =>
  [resolve(here, '../../..'), resolve(here, '../..'), resolve(process.cwd(), '..'), process.cwd(), resolve(process.cwd(), 'assets')].find((d) => existsSync(resolve(d, PHOTO)));

export const DEFAULT_DELIVERY = [
  { key: 'cdek', title: 'СДЭК', subtitle: 'ПВЗ или курьер · 2–5 дней', price: 390, needsAddress: true, active: true, position: 0 },
  { key: 'post', title: 'Почта России', subtitle: 'Отделение · 5–14 дней', price: 290, needsAddress: true, active: true, position: 1 },
  { key: 'pickup', title: 'Самовывоз', subtitle: 'Москва · по договорённости', price: 0, needsAddress: false, active: true, position: 2 },
];

/** seed product #001 from the brand materials. Price, size chart and stock are placeholders marked TODO. */
export async function seed(db: DB, storage: Storage, opts: { images?: boolean; demo?: boolean; log?: (m: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(products);
  await db.insert(deliveryMethods).values(DEFAULT_DELIVERY).onConflictDoNothing();
  if (c > 0) return false;

  const [p] = await db
    .insert(products)
    .values({
      no: '001',
      slug: 'zip-hoodie-ne-dizainer',
      sig: 'SIG.001',
      title: 'ZIP-HOODIE «НЕ ДИЗАЙНЕР»',
      name: 'ZIP-HOODIE',
      sub: '«НЕ ДИЗАЙНЕР»',
      category: 'hoodie',
      price: 6900, // TODO: real price
      color: 'ЭКРЮ',
      batch: '1/50',
      status: 'live',
      sort: 1,
      todo: ['price', 'sizes'],
      proto: [
        { k: 'МАТЕРИАЛ', v: 'футер 3-х нитка, 100% хлопок' },
        { k: 'ПЛОТНОСТЬ', v: '500 г/м²' },
        { k: 'ПОСАДКА', v: 'оверсайз, спущенное плечо' },
        { k: 'ЦВЕТ', v: 'экрю' },
        { k: 'ПРИНТ', v: 'спереди красный «НЕ ДИЗАЙНЕР»; на спине «MRAK8 CENTRAL BOOKING & INTAKE CENTER. NO EMOTIONAL CONTRABAND. ALL SUBJECTS ARE MONITORED.»' },
        { k: 'ВЫШИВКА', v: '«Mrak8» — капюшон' },
        { k: 'ФУРНИТУРА', v: 'металлическая молния' },
        { k: 'ПАРТИЯ', v: '1/50' },
        { k: 'УХОД', v: '30°, наизнанку, без отжима', todo: true },
      ],
      hotspots: {
        front: [
          { x: 48.3, y: 24.4, t: 'ВЫШИВКА «Mrak8»', s: 'КАПЮШОН · КРАСНАЯ НИТЬ' },
          { x: 63, y: 47.6, fx: 57.6, fy: 42.2, t: 'ПРИНТ «НЕ ДИЗАЙНЕР»', s: 'ГРУДЬ · ПЕРЕД' },
          { x: 78.5, y: 33.5, t: 'ВСТАВКА НА ПЛЕЧЕ', s: 'КОНТРАСТНАЯ ПАНЕЛЬ' },
          // one marker on the left sleeve stands for both: the caption says so
          { x: 8.8, y: 53.4, n: 4, t: 'ПРОРЕЗИ ДЛЯ РУКАВОВ', s: 'СПЕЦИАЛЬНЫЕ · ОБА РУКАВА' },
        ],
        back: [
          { x: 50.5, y: 46.6, fx: 50.5, fy: 40.6, t: 'CENTRAL BOOKING & INTAKE', s: 'СПИНА · ТРИ СТРОКИ' },
          { x: 48.5, y: 14, t: 'КАПЮШОН', s: 'ВИД СЗАДИ' },
          { x: 76, y: 30, t: 'ВСТАВКА НА ПЛЕЧЕ', s: 'ВИД СЗАДИ' },
        ],
      },
    })
    .returning();

  // TODO: real size chart — length / chest width / sleeve (cm) and height band per size
  const sizes = [
    { label: 'XS', stock: 2, heightMin: 155, heightMax: 163, length: 66, width: 56, sleeve: 58 },
    { label: 'S', stock: 6, heightMin: 163, heightMax: 171, length: 68, width: 58, sleeve: 59 },
    { label: 'M', stock: 9, heightMin: 171, heightMax: 179, length: 70, width: 61, sleeve: 60 },
    { label: 'L', stock: 3, heightMin: 179, heightMax: 187, length: 72, width: 64, sleeve: 61 },
    { label: 'XL', stock: 0, heightMin: 187, heightMax: 195, length: 74, width: 67, sleeve: 62 },
  ];
  await db.insert(productSizes).values(sizes.map((s, i) => ({ ...s, productId: p.id, position: i })));

  if (opts.images !== false) {
    const dir = findAssetsDir();
    if (!dir) log('seed: brand photos not found next to the repo — product #001 has no images');
    else {
      for (const [slot, file] of [['front', 'mrakl-zip-front.jpg'], ['back', 'mrakl-zip-back.jpg']] as const) {
        const buf = await readFile(resolve(dir, file));
        const img = await processImage(buf, storage, { prefix: `products/001/${slot}`, cutout: 'black' });
        await db.insert(productImages).values({ productId: p.id, slot, position: slot === 'front' ? 0 : 1, ...img });
        log(`seed: ${file} → ${img.key} (${img.widths.join('/')}, ${img.formats.join('+')})`);
      }
    }
  }

  if (opts.demo) {
    const [tee] = await db
      .insert(products)
      .values({ no: '002', slug: 'tee-no-emotional-contraband', sig: 'SIG.002', title: 'ФУТБОЛКА «NO EMOTIONAL CONTRABAND»', name: 'ФУТБОЛКА', sub: '«NO EMOTIONAL CONTRABAND»', category: 'tee', price: 3900, color: 'ЧЁРНЫЙ', batch: '1/80', status: 'drop', dropAt: new Date(Date.now() + 3 * 864e5), sort: 2, todo: ['demo', 'photo', 'price'], proto: [{ k: 'СТАТУС', v: 'засекречено до дропа' }] })
      .returning();
    await db.insert(productSizes).values(sizes.map((s, i) => ({ ...s, stock: 10, productId: tee.id, position: i })));
    const [hat] = await db
      .insert(products)
      .values({ no: '003', slug: 'beanie-all-subjects-monitored', sig: 'SIG.003', title: 'ШАПКА «ALL SUBJECTS ARE MONITORED»', name: 'ШАПКА', sub: '«ALL SUBJECTS ARE MONITORED»', category: 'acc', price: 2900, oldPrice: 3400, color: 'ЧЁРНЫЙ', batch: '30/30', status: 'soldout', sort: 3, todo: ['demo', 'photo'], proto: [{ k: 'СТАТУС', v: 'партия изъята полностью' }] })
      .returning();
    await db.insert(productSizes).values({ productId: hat.id, label: 'OS', stock: 0, position: 0, heightMin: 150, heightMax: 200 });
  }
  log('seed: product #001 created' + (opts.demo ? ' (+ demo #002 drop, #003 sold out)' : ''));
  return true;
}

/** sanity helper for scripts */
export async function productCount(db: DB) {
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(products).where(eq(products.status, 'live'));
  return c;
}
