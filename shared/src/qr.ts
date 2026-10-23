/* QR code (byte mode, ECC level M, versions 1–10) → SVG markup. Follows ISO/IEC 18004 (Nayuki's reference design). */
const ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLK = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

const rawModules = (v: number) => {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const na = Math.floor(v / 7) + 2;
    r -= (25 * na - 10) * na - 55;
    if (v >= 7) r -= 36;
  }
  return r;
};
const dataCapacity = (v: number) => Math.floor(rawModules(v) / 8) - ECC[v] * BLK[v];
const gfMul = (x: number, y: number) => {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
};
const rsDivisor = (deg: number) => {
  const r = new Array<number>(deg).fill(0);
  r[deg - 1] = 1;
  let root = 1;
  for (let i = 0; i < deg; i++) {
    for (let j = 0; j < deg; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < deg) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 2);
  }
  return r;
};
const rsRemainder = (data: number[], div: number[]) => {
  const r = div.map(() => 0);
  for (const b of data) {
    const f = b ^ (r.shift() as number);
    r.push(0);
    div.forEach((c, i) => (r[i] ^= gfMul(c, f)));
  }
  return r;
};
const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  for (; ver <= 10; ver++) if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= dataCapacity(ver) * 8) break;
  if (ver > 10) throw new Error('qr: text too long');
  const bits: number[] = [];
  const put = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  const cap = dataCapacity(ver) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  const nb = BLK[ver], el = ECC[ver], raw = Math.floor(rawModules(ver) / 8), nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb);
  const div = rsDivisor(el);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const cw: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) cw.push(b[i]); });

  const size = ver * 4 + 17;
  const mod = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const setF = (x: number, y: number, d: boolean) => { mod[y][x] = d; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const align: number[] = [];
  if (ver > 1) {
    const na = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
    align.push(6);
    for (let p = size - 7; align.length < na; p -= step) align.splice(1, 0, p);
  }
  align.forEach((ax, i) => align.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const format = (mask: number) => {
    const d = (0 << 3) | mask; // ECC level M = 0b00
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, g = (i: number) => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) setF(8, i, g(i));
    setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8));
    for (let i = 9; i < 15; i++) setF(14 - i, 8, g(i));
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, g(i));
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, g(i));
    setF(8, size - 8, true);
  };
  format(0);
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (ver << 12) | r;
    for (let i = 0; i < 18; i++) { const c = ((b >>> i) & 1) !== 0, a = size - 11 + (i % 3), bb = Math.floor(i / 3); setF(a, bb, c); setF(bb, a, c); }
  }
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && bi < cw.length * 8) { mod[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
    }
  }
  const applyMask = (m: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x]; };
  const penalty = () => {
    let p = 0;
    const lines = (get: (a: number, b: number) => boolean) => {
      for (let a = 0; a < size; a++) {
        let run = 1;
        for (let b = 1; b <= size; b++) {
          if (b < size && get(a, b) === get(a, b - 1)) run++;
          else { if (run >= 5) p += 3 + (run - 5); run = 1; }
        }
        for (let b = 0; b + 6 < size; b++) if ([1, 0, 1, 1, 1, 0, 1].every((v, i) => get(a, b + i) === !!v)) p += 40;
      }
    };
    lines((a, b) => mod[a][b]);
    lines((a, b) => mod[b][a]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = mod[y][x];
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
    }
    let dark = 0;
    mod.forEach((r) => r.forEach((c) => (dark += c ? 1 : 0)));
    return p + (Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
  };
  let best = 0, bestP = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m); format(m);
    const p = penalty();
    if (p < bestP) { bestP = p; best = m; }
    applyMask(m);
  }
  applyMask(best); format(best);
  return mod;
}

export function qrSVG(text: string, quiet = 2): string {
  const mod = qrMatrix(text);
  const n = mod.length + quiet * 2;
  let d = '';
  mod.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-label="QR"><rect width="${n}" height="${n}" fill="#F6F3EC"/><path d="${d}" fill="#0B0B0B"/></svg>`;
}
