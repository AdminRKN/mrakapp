import * as jsqrNs from 'jsqr';
import { describe, expect, it } from 'vitest';
import { qrMatrix } from '@mrak8/shared';

// jsqr is CommonJS: the callable lives on `default` under NodeNext interop
const jsQR = ((jsqrNs as unknown as { default?: unknown }).default ?? jsqrNs) as (d: Uint8ClampedArray, w: number, h: number) => { data: string } | null;

/** render the module matrix to RGBA (4px per module, 4-module quiet zone) and read it back with an independent decoder */
function decode(text: string) {
  const m = qrMatrix(text);
  const scale = 4, quiet = 4, n = (m.length + quiet * 2) * scale;
  const px = new Uint8ClampedArray(n * n * 4).fill(255);
  m.forEach((row, y) => row.forEach((on, x) => {
    if (!on) return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = (((y + quiet) * scale + dy) * n + (x + quiet) * scale + dx) * 4;
      px[i] = px[i + 1] = px[i + 2] = 0;
    }
  }));
  return { size: m.length, text: jsQR(px, n, n)?.data };
}

describe('receipt QR', () => {
  it.each([
    'https://t.me/mrak8_bot/shop?startapp=order_MRK-000123',
    'MRAK8',
    'https://t.me/mrak8_bot/shop?startapp=order_MRK-000123&subject=08-4417&note=NO-EMOTIONAL-CONTRABAND',
    'Квитанция MRAK8 · CASE #MRK-000123 · SUBJECT #08-4417 · 7 290 ₽ · NO EMOTIONAL CONTRABAND. ALL SUBJECTS ARE MONITORED.',
  ])('round-trips %s', (text) => {
    const r = decode(text);
    expect(r.text).toBe(text);
  });
  it('picks the smallest version that fits', () => {
    expect(decode('MRAK8').size).toBe(21);
  });
});
