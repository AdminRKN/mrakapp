import { and, asc, eq, inArray, lte, ne } from 'drizzle-orm';
import type { ApiAdminProduct, ApiDelivery, ApiImage, ApiProduct } from '@mrak8/shared';
import type { DB } from '../db/index.js';
import { deliveryMethods, dropWatchers, productImages, products, productSizes } from '../db/schema.js';
import type { Storage } from './storage.js';

type ImageRow = typeof productImages.$inferSelect;
type ProductRow = typeof products.$inferSelect;
type SizeRow = typeof productSizes.$inferSelect;

export const toApiImage = (r: ImageRow, storage: Storage): ApiImage => ({
  id: r.id,
  slot: r.slot,
  base: storage.url(r.key),
  widths: r.widths,
  formats: r.formats,
  lqip: r.lqip,
  bbox: r.bbox ?? null,
  w: r.w,
  h: r.h,
  alpha: r.alpha,
});

function assemble(p: ProductRow, sizes: SizeRow[], images: ImageRow[], storage: Storage): ApiProduct {
  const imgs = images.filter((i) => i.productId === p.id).sort((a, b) => a.position - b.position);
  const first = (slot: ImageRow['slot']) => {
    const r = imgs.find((i) => i.slot === slot);
    return r ? toApiImage(r, storage) : null;
  };
  return {
    id: p.id,
    no: p.no,
    slug: p.slug,
    sig: p.sig,
    title: p.title,
    name: p.name,
    sub: p.sub,
    category: p.category,
    price: p.price,
    oldPrice: p.oldPrice,
    color: p.color,
    batch: p.batch,
    status: p.status,
    dropAt: p.dropAt ? p.dropAt.toISOString() : null,
    proto: p.proto,
    hotspots: p.hotspots,
    todo: p.todo,
    images: { front: first('front'), back: first('back'), details: imgs.filter((i) => i.slot === 'detail').map((i) => toApiImage(i, storage)) },
    sizes: sizes
      .filter((s) => s.productId === p.id)
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ label: s.label, available: Math.max(0, s.stock - s.reserved), heightMin: s.heightMin, heightMax: s.heightMax, length: s.length, width: s.width, sleeve: s.sleeve })),
  };
}

export async function listProducts(db: DB, storage: Storage, opts: { includeDrafts?: boolean; ids?: number[]; userId?: number } = {}): Promise<ApiProduct[]> {
  const where = and(opts.includeDrafts ? undefined : ne(products.status, 'draft'), opts.ids ? inArray(products.id, opts.ids) : undefined);
  const rows = await db.select().from(products).where(where).orderBy(asc(products.sort), asc(products.no));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [sizes, images, watching] = await Promise.all([
    db.select().from(productSizes).where(inArray(productSizes.productId, ids)),
    db.select().from(productImages).where(inArray(productImages.productId, ids)),
    opts.userId ? db.select({ productId: dropWatchers.productId }).from(dropWatchers).where(eq(dropWatchers.userId, opts.userId)) : Promise.resolve([]),
  ]);
  const w = new Set(watching.map((x) => x.productId));
  return rows.map((p) => ({ ...assemble(p, sizes, images, storage), watching: w.has(p.id) }));
}

export async function getProduct(db: DB, storage: Storage, id: number, opts: { includeDrafts?: boolean; userId?: number } = {}) {
  const [p] = await listProducts(db, storage, { ...opts, ids: [id] });
  return p ?? null;
}

export async function getAdminProduct(db: DB, storage: Storage, id: number): Promise<ApiAdminProduct | null> {
  const p = await getProduct(db, storage, id, { includeDrafts: true });
  if (!p) return null;
  const [row] = await db.select({ sort: products.sort }).from(products).where(eq(products.id, id));
  const sizes = await db.select().from(productSizes).where(eq(productSizes.productId, id)).orderBy(asc(productSizes.position));
  return {
    ...p,
    sort: row.sort,
    sizesAdmin: sizes.map((s) => ({ label: s.label, stock: s.stock, reserved: s.reserved, heightMin: s.heightMin, heightMax: s.heightMax, length: s.length, width: s.width, sleeve: s.sleeve })),
  };
}

export async function listDelivery(db: DB, all = false): Promise<(ApiDelivery & { active: boolean; position: number })[]> {
  const rows = await db.select().from(deliveryMethods).where(all ? undefined : eq(deliveryMethods.active, true)).orderBy(asc(deliveryMethods.position));
  return rows.map((r) => ({ key: r.key, title: r.title, subtitle: r.subtitle, price: r.price, needsAddress: r.needsAddress, active: r.active, position: r.position }));
}

/** flip drops whose time has come to `live`; returns the launched product ids */
export async function launchDueDrops(db: DB, now = new Date()): Promise<number[]> {
  const rows = await db
    .update(products)
    .set({ status: 'live', updatedAt: now })
    .where(and(eq(products.status, 'drop'), lte(products.dropAt, now)))
    .returning({ id: products.id });
  return rows.map((r) => r.id);
}
