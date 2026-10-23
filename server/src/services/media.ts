import { randomBytes } from 'node:crypto';
import sharp, { type Sharp } from 'sharp';
import { IMAGE_WIDTHS } from '@mrak8/shared';
import type { Storage } from './storage.js';

export type Crop = 'none' | '45' | '11';
export interface ProcessOptions { crop?: Crop; cutout?: 'none' | 'black'; prefix: string }
export interface ProcessedImage { key: string; widths: number[]; formats: ('avif' | 'webp')[]; w: number; h: number; lqip: string; bbox: [number, number, number, number] | null; alpha: boolean }

const MAX_SIDE = 2400;

/** binary dilation by radius r (square window) with prefix sums — O(n) */
function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const row = new Int32Array(w + 1);
  for (let y = 0; y < h; y++) {
    row[0] = 0;
    for (let x = 0; x < w; x++) row[x + 1] = row[x] + mask[y * w + x];
    for (let x = 0; x < w; x++) tmp[y * w + x] = row[Math.min(w, x + r + 1)] - row[Math.max(0, x - r)] > 0 ? 1 : 0;
  }
  const col = new Int32Array(h + 1);
  for (let x = 0; x < w; x++) {
    col[0] = 0;
    for (let y = 0; y < h; y++) col[y + 1] = col[y] + tmp[y * w + x];
    for (let y = 0; y < h; y++) out[y * w + x] = col[Math.min(h, y + r + 1)] - col[Math.max(0, y - r)] > 0 ? 1 : 0;
  }
  return out;
}

/**
 * Product shots in MRAK8 come on pure black. Pixels at ~0 become transparent, the anti-aliased rim
 * (≤2px from the background) gets a smooth ramp, and specks far from the garment are dropped.
 */
export function cutoutBlack(rgb: Buffer, w: number, h: number): Buffer {
  const n = w * h;
  const v = new Uint8Array(n);
  const bg = new Uint8Array(n);
  const core = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const m = Math.max(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    v[i] = m;
    bg[i] = m <= 12 ? 1 : 0;
    core[i] = m > 60 ? 1 : 0;
  }
  const near = dilate(bg, w, h, 2);
  const keep = dilate(core, w, h, 12);
  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    let a = 255;
    if (bg[i] || !keep[i]) a = 0;
    else if (near[i]) {
      const t = Math.min(1, Math.max(0, (v[i] - 12) / 58));
      a = Math.round(t * t * (3 - 2 * t) * 255);
    }
    out[i * 4] = rgb[i * 3];
    out[i * 4 + 1] = rgb[i * 3 + 1];
    out[i * 4 + 2] = rgb[i * 3 + 2];
    out[i * 4 + 3] = a;
  }
  return out;
}

function bboxOf(rgba: Buffer, w: number, h: number): [number, number, number, number] | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] > 25) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const p = (a: number, b: number) => Math.round((a / b) * 10000) / 100;
  return [p(x0, w), p(y0, h), p(x1 + 1, w), p(y1 + 1, h)];
}

export async function processImage(input: Buffer, storage: Storage, opts: ProcessOptions): Promise<ProcessedImage> {
  let img = sharp(input, { failOn: 'error' }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error('not an image');
  // crop to the requested aspect around the subject, then cap the size
  if (opts.crop && opts.crop !== 'none') {
    const ratio = opts.crop === '45' ? 4 / 5 : 1;
    const W = Math.min(meta.width, Math.round(meta.height * ratio));
    const H = Math.round(W / ratio);
    img = img.resize({ width: W, height: H, fit: 'cover', position: sharp.strategy.attention });
  }
  img = img.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });

  let base: Sharp;
  let w: number, h: number, alpha: boolean, bbox: ProcessedImage['bbox'] = null;
  if (opts.cutout === 'black') {
    const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgba = cutoutBlack(data, info.width, info.height);
    w = info.width; h = info.height; alpha = true;
    bbox = bboxOf(rgba, w, h);
    base = sharp(rgba, { raw: { width: w, height: h, channels: 4 } });
  } else {
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    w = info.width; h = info.height;
    let transparent = false;
    for (let i = 3; i < data.length; i += 4 * 97) if (data[i] < 250) { transparent = true; break; }
    alpha = transparent;
    if (alpha) bbox = bboxOf(data, w, h);
    base = sharp(data, { raw: { width: w, height: h, channels: 4 } });
  }
  const master = await base.png({ compressionLevel: 1 }).toBuffer();

  const key = `${opts.prefix}-${randomBytes(3).toString('hex')}`;
  const widths: number[] = IMAGE_WIDTHS.filter((x) => x <= w);
  if (!widths.length) widths.push(w);
  const formats: ('avif' | 'webp')[] = ['avif', 'webp'];
  await Promise.all(
    widths.map(async (width) => {
      const r = sharp(master).resize({ width, withoutEnlargement: true });
      const [webp, avif] = await Promise.all([
        r.clone().webp({ quality: width >= 1200 ? 80 : 82, alphaQuality: 90, effort: 5 }).toBuffer(),
        r.clone().avif({ quality: 52, effort: 3 }).toBuffer(),
      ]);
      await storage.put(`${key}-${width}.webp`, webp, 'image/webp');
      await storage.put(`${key}-${width}.avif`, avif, 'image/avif');
    }),
  );
  const lq = await sharp(master).resize({ width: 24 }).webp({ quality: 50, alphaQuality: 60 }).toBuffer();
  return { key, widths, formats, w, h, lqip: `data:image/webp;base64,${lq.toString('base64')}`, bbox, alpha };
}

/** Telegram wants JPEG for photos/inline results: flatten a stored image on the brand black */
export async function jpegForTelegram(storage: Storage, key: string, widths: number[], width = 1200): Promise<Buffer> {
  const w = widths.filter((x) => x <= width).pop() ?? widths[0];
  const src = await storage.get(`${key}-${w}.webp`);
  return sharp(src).flatten({ background: '#0B0B0B' }).extend({ top: 60, bottom: 60, left: 60, right: 60, background: '#0B0B0B' }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}
