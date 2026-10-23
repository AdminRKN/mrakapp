/* Renders the share cards (shareMessage photo + Story) with the brand fonts and the real cut-out photo. */
import '@fontsource-variable/roboto-condensed/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import { LOGO } from '../src/lib/logo';

const C = { black: '#0B0B0B', cream: '#F1ECE1', red: '#E0241B', grey: '#8A8680' };
const DISPLAY = '"Roboto Condensed Variable"', MONO = '"JetBrains Mono Variable"';
const log = (m: string) => (document.getElementById('log')!.textContent += m + '\n');

async function loadPhoto(): Promise<HTMLImageElement | null> {
  try {
    const b = await fetch('/api/bootstrap', { headers: { 'x-dev-user': encodeURIComponent(JSON.stringify({ id: 1, first_name: 'Share' })) } }).then((r) => r.json());
    const img = b.products.find((p: { no: string }) => p.no === '001')?.images.front;
    if (!img) return null;
    const el = new Image();
    el.src = `${new URL(img.base, location.href).pathname}-1200.webp`; // same origin via the Vite /media proxy → canvas stays untainted
    await new Promise((ok, fail) => { el.onload = ok; el.onerror = fail; }); // decode() stalls in a hidden tab, load does not
    return el;
  } catch (e) {
    log('photo: ' + (e as Error).message);
    return null;
  }
}

function logo(g: CanvasRenderingContext2D, x: number, y: number, w: number, color = '#FFFFFF') {
  const [vx, vy, vw] = LOGO.viewBox;
  const k = w / vw;
  g.save();
  g.translate(x - vx * k, y - vy * k);
  g.scale(k, k);
  g.fillStyle = color;
  for (const d of [LOGO.letters.m + LOGO.letters.r + LOGO.letters.a + LOGO.letters.k, LOGO.ringTop, LOGO.ringBottom]) g.fill(new Path2D(d), 'evenodd');
  g.restore();
}

function chart(g: CanvasRenderingContext2D, W: number, H: number, top: number, bottom: number) {
  const from = 150, to = 200, span = bottom - top;
  g.save();
  for (let v = from; v <= to; v++) {
    const y = top + ((to - v) / (to - from)) * span;
    const lab = v % 10 === 0, maj = v % 5 === 0;
    g.strokeStyle = `rgba(241,236,225,${lab ? 0.22 : maj ? 0.14 : 0.07})`;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(lab ? W : maj ? W * 0.12 : W * 0.05, y);
    g.stroke();
    if (lab) { g.fillStyle = C.grey; g.font = `600 22px ${MONO}`; g.fillText(String(v), 14, y - 10); }
  }
  g.restore();
}

/** red rubber stamp with uneven ink: drawn on its own canvas, then speckled out */
function stamp(text: string, sub: string, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.strokeStyle = g.fillStyle = C.red;
  const rr = (x: number, y: number, ww: number, hh: number, r: number, lw: number) => { g.lineWidth = lw; g.beginPath(); g.roundRect(x, y, ww, hh, r); g.stroke(); };
  rr(10, 10, w - 20, h - 20, 12, 12);
  rr(30, 30, w - 60, h - 60, 5, 4);
  g.textAlign = 'center';
  g.font = `900 ${h * 0.46}px ${DISPLAY}`;
  const tw = g.measureText(text).width, maxW = w - 110;
  g.save();
  g.translate(w / 2, h * 0.6);
  g.scale(Math.min(1, maxW / tw), 1);
  g.fillText(text, 0, 0);
  g.restore();
  g.font = `700 ${h * 0.1}px ${MONO}`;
  g.fillText(sub, w / 2, h * 0.83);
  // ink gaps
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < (w * h) / 90; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.85})`;
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h, Math.random() * 2.6 + 0.4, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 18; i++) {
    g.fillStyle = `rgba(0,0,0,${0.25 + Math.random() * 0.4})`;
    g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 60 + 10, Math.random() * 3 + 1);
  }
  return c;
}

function tape(g: CanvasRenderingContext2D, W: number, y: number, h: number, rot: number) {
  const text = 'NO EMOTIONAL CONTRABAND ■ ALL SUBJECTS ARE MONITORED ■ НЕ ДИЗАЙНЕР ■ ';
  g.save();
  g.translate(W / 2, y);
  g.rotate((rot * Math.PI) / 180);
  g.fillStyle = C.red;
  g.fillRect(-W, -h / 2, W * 2, h);
  g.fillStyle = C.cream;
  g.font = `800 ${h * 0.52}px ${DISPLAY}`;
  g.textBaseline = 'middle';
  g.fillText(text.repeat(4), -W, 2);
  g.restore();
}

function osd(g: CanvasRenderingContext2D, W: number, top: number) {
  g.save();
  g.fillStyle = C.red;
  g.beginPath(); g.arc(W - 330, top + 2, 9, 0, Math.PI * 2); g.fill();
  g.font = `700 26px ${MONO}`;
  g.fillText('REC · CAM_08', W - 312, top + 12);
  g.restore();
}

function grain(g: CanvasRenderingContext2D, W: number, H: number) {
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  for (let y = 0; y < H; y += 4) { g.fillStyle = 'rgba(255,255,255,0.018)'; g.fillRect(0, y, W, 1); }
}

function card(canvas: HTMLCanvasElement, photo: HTMLImageElement | null, story: boolean) {
  const g = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  // story: Telegram's own UI covers ~220 px on top and ~260 px at the bottom — keep the message inside
  const L = story
    ? { top: 220, chartTop: 420, chartBottom: 1600, logo: 380, label: 450, photo: [150, 500, 780], head: 1430, headGap: 140, headSize: 150, stamp: [W - 270, 1235], tape: 1745, cta: 1650 }
    : { top: 40, chartTop: 160, chartBottom: 1010, logo: 300, label: 985, photo: [W - 600, 190, 640], head: 800, headGap: 118, headSize: 128, stamp: [W - 250, 655], tape: H - 34, cta: 0 };
  g.fillStyle = C.black;
  g.fillRect(0, 0, W, H);
  chart(g, W, H, L.chartTop, L.chartBottom);
  logo(g, 60, L.top, L.logo);
  osd(g, W, L.top + 30);
  g.fillStyle = C.grey;
  g.font = `600 24px ${MONO}`;
  g.fillText('MRAK8 CENTRAL BOOKING & INTAKE CENTER', 60, L.label);
  if (photo) {
    const [x, y, sz] = L.photo;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 40; g.shadowOffsetY = 20;
    g.drawImage(photo, x, y, sz, sz);
    g.restore();
    g.strokeStyle = C.cream; g.lineWidth = 3;
    const bx = x + sz * 0.05, by = y + sz * 0.06, bw = sz * 0.9, bh = sz * 0.86, K = 34;
    for (const [cx, cy, dx, dy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
      g.beginPath(); g.moveTo(cx + dx * K, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + dy * K); g.stroke();
    }
    g.fillStyle = C.cream; g.fillRect(bx, by - 48, 150, 36);
    g.fillStyle = C.black; g.font = `700 22px ${MONO}`; g.fillText('OBJ_001', bx + 14, by - 22);
  }
  g.fillStyle = C.cream;
  g.font = `900 ${L.headSize}px ${DISPLAY}`;
  g.fillText('Я ОФОРМЛЕН', 56, L.head);
  g.fillText('В MRAK8', 56, L.head + L.headGap);
  const st = stamp('ОФОРМЛЕН', 'MRAK8 · CENTRAL BOOKING', 520, 176);
  g.save();
  g.translate(L.stamp[0], L.stamp[1]);
  g.rotate((-12 * Math.PI) / 180);
  g.globalAlpha = 0.96;
  g.drawImage(st, -st.width / 2, -st.height / 2);
  g.restore();
  tape(g, W, L.tape, story ? 64 : 52, story ? -3 : 0);
  if (L.cta) {
    g.fillStyle = C.grey;
    g.font = `600 30px ${MONO}`;
    g.fillText('ОТКРОЙ ЦЕНТР ОФОРМЛЕНИЯ В TELEGRAM →', 60, L.cta);
  }
  grain(g, W, H);
}

async function post(canvas: HTMLCanvasElement, name: string) {
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.88));
  const res = await fetch(`http://127.0.0.1:8099/save?name=${name}`, { method: 'POST', body: blob }).then((r) => r.text()).catch((e) => 'not saved: ' + e.message);
  log(`${name}: ${Math.round(blob.size / 1024)} KB → ${res}`);
}

const SAMPLE = 'Я ОФОРМЛЕН В MRAK8 НЕ ДИЗАЙНЕР ОТКРОЙ ЦЕНТР ОФОРМЛЕНИЯ 0123456789';
// pass sample text: unicode-range subsets (cyrillic!) load only for the characters asked for
await Promise.all([`900 100px ${DISPLAY}`, `800 100px ${DISPLAY}`, `600 20px ${MONO}`, `700 20px ${MONO}`].map((f) => document.fonts.load(f, SAMPLE)));
const photo = await loadPhoto();
card(document.getElementById('sq') as HTMLCanvasElement, photo, false);
card(document.getElementById('st') as HTMLCanvasElement, photo, true);
await post(document.getElementById('sq') as HTMLCanvasElement, 'booked.jpg');
await post(document.getElementById('st') as HTMLCanvasElement, 'story.jpg');
log('done');
