/* Motion primitives (Web Animations API) — transform/opacity only, all respect reduced motion. */
import { haptic } from './telegram';

const q = new URLSearchParams(location.search);
const ua = navigator.userAgent;
const perfClass = (ua.match(/Telegram-Android\/[\d.]+\s*\([^)]*;\s*(LOW|AVERAGE|HIGH)\)/) || [])[1];
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || q.get('rm') === '1';
export const weak = perfClass === 'LOW' || (navigator.hardwareConcurrency || 8) <= 2 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8) <= 2;
const html = document.documentElement;
if (reduced) html.classList.add('rm');
if (reduced || weak || q.get('fx') === '0') html.classList.add('no-fx');
if (q.get('cctv') === '0') html.classList.add('no-cctv');

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
type Anim = { finished: Promise<unknown>; cancel(): void };
export function anim(el: Element | null | undefined, kf: Keyframe[], opts: KeyframeAnimationOptions): Anim {
  if (!el) return { finished: Promise.resolve(), cancel() {} };
  if (reduced) {
    const last = kf[kf.length - 1];
    if (last && opts.fill && opts.fill !== 'none') Object.assign((el as HTMLElement).style, last);
    return { finished: Promise.resolve(), cancel() {} };
  }
  return el.animate(kf, opts);
}
/** a paused timeline (hidden tab) must never block a purchase flow */
export const done = (a: Anim, ms: number) => Promise.race([a.finished.catch(() => {}), wait(ms)]);

/* grain texture for the CCTV layer and paper */
export function initGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d')!;
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  html.style.setProperty('--grain', `url(${c.toDataURL('image/png')})`);
}

export function shake(el: Element | null, px = 4) {
  anim(el, [{ transform: 'translate(0,0)' }, { transform: `translate(${-px}px,${px / 2}px)` }, { transform: `translate(${px}px,${-px / 2}px)` }, { transform: `translate(${-px / 2}px,${px / 3}px)` }, { transform: 'translate(0,0)' }], { duration: 80, easing: 'linear' });
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

let seed = 3;
/** red rubber stamp: double border, condensed caps, turbulence for uneven ink */
export function stampSVG(text: string, sub = '', { w = 320, h = 104, color = 'currentColor', double = true } = {}) {
  const id = 'ink' + seed++;
  const fs = h * 0.56;
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><filter id="${id}" x="-5%" y="-10%" width="110%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${seed}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.6 0 0 0 1.95" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in" result="k"/>
    <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="${seed + 9}" result="w"/>
    <feDisplacementMap in="k" in2="w" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
    <g filter="url(#${id})" fill="none" stroke="${color}">
      <rect x="5" y="5" width="${w - 10}" height="${h - 10}" rx="5" stroke-width="5"/>
      ${double ? `<rect x="14" y="14" width="${w - 28}" height="${h - 28}" rx="2" stroke-width="2"/>` : ''}
      <text x="${w / 2}" y="${sub ? h * 0.6 : h * 0.68}" text-anchor="middle" fill="${color}" stroke="none" font-family="Roboto Condensed Variable, Roboto Condensed, Arial Narrow, sans-serif" font-weight="900" font-size="${sub ? fs * 0.9 : fs}" letter-spacing="2" textLength="${w - 56}" lengthAdjust="spacingAndGlyphs">${esc(text)}</text>
      ${sub ? `<text x="${w / 2}" y="${h * 0.84}" text-anchor="middle" fill="${color}" stroke="none" font-family="JetBrains Mono Variable, JetBrains Mono, monospace" font-weight="700" font-size="${h * 0.11}" letter-spacing="1.5">${esc(sub)}</text>` : ''}
    </g></svg>`;
}

/** round office seal for «М.П.»: text along the ring, the logo's two rings of the «8» in the middle, uneven ink */
export function sealSVG(ring: string, sub = '', { size = 120, color = 'currentColor' } = {}) {
  const id = 'ink' + seed++;
  const r = size / 2, tr = r - 13, inner = r - 24;
  return `<svg viewBox="0 0 ${size} ${size}" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true"><defs><filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${seed}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.4 0 0 0 1.85" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in" result="k"/>
    <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="${seed + 7}" result="w"/>
    <feDisplacementMap in="k" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G"/></filter>
    <path id="${id}r" d="M ${r - tr} ${r} a ${tr} ${tr} 0 1 1 ${tr * 2} 0 a ${tr} ${tr} 0 1 1 ${-tr * 2} 0"/></defs>
    <g filter="url(#${id})" fill="none" stroke="${color}">
      <circle cx="${r}" cy="${r}" r="${r - 3}" stroke-width="3"/>
      <circle cx="${r}" cy="${r}" r="${inner}" stroke-width="1.3"/>
      <ellipse cx="${r}" cy="${r - size * 0.07}" rx="${size * 0.165}" ry="${size * 0.054}" stroke-width="${size * 0.03}"/>
      <ellipse cx="${r}" cy="${r + size * 0.05}" rx="${size * 0.2}" ry="${size * 0.066}" stroke-width="${size * 0.03}"/>
      <text fill="${color}" stroke="none" font-family="JetBrains Mono Variable, JetBrains Mono, monospace" font-weight="700" font-size="${size * 0.078}"><textPath href="#${id}r" xlink:href="#${id}r" textLength="${(2 * Math.PI * tr - 6).toFixed(1)}" lengthAdjust="spacing">${esc(ring)}</textPath></text>
      ${sub ? `<text x="${r}" y="${r + inner * 0.78}" text-anchor="middle" fill="${color}" stroke="none" font-family="JetBrains Mono Variable, JetBrains Mono, monospace" font-weight="700" font-size="${size * 0.062}">${esc(sub)}</text>` : ''}
    </g></svg>`;
}

/** stamp hits the paper: scale 1.45 → 1, rotation, 80 ms shake, heavy haptic (or success) */
export async function slam(host: HTMLElement, text: string, o: { sub?: string; rot?: number; cls?: string; haptic?: 'heavy' | 'success' | null; shakeEl?: Element | null; w?: number; h?: number } = {}) {
  const st = document.createElement('div');
  st.className = `stamp ${o.cls ?? ''}`;
  st.innerHTML = stampSVG(text, o.sub ?? '', { w: o.w, h: o.h });
  host.appendChild(st);
  const r = `rotate(${o.rot ?? -9}deg)`;
  const a = anim(st, [
    { transform: `scale(1.45) ${r} rotate(-4deg)`, opacity: 0, filter: 'blur(3px)' },
    { transform: `scale(1.08) ${r}`, opacity: 1, filter: 'blur(0px)', offset: 0.62 },
    { transform: `scale(.98) ${r}`, offset: 0.82 },
    { transform: `scale(1) ${r}` },
  ], { duration: 300, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' });
  setTimeout(() => {
    const hp = o.haptic === undefined ? 'heavy' : o.haptic;
    if (hp === 'success') haptic.notify('success');
    else if (hp) haptic.impact(hp);
    shake(o.shakeEl ?? document.querySelector('.app'));
  }, reduced ? 0 : 190);
  await done(a, 420);
  st.style.transform = r;
  return st;
}

/** terminal-style text swap */
export function scramble(el: Element | null, text: string, dur = 260) {
  if (!el) return;
  if (reduced || el.textContent === text) { el.textContent = text; return; }
  const chars = '0123456789#/<>_-=+';
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / dur);
    let out = '';
    for (let i = 0; i < text.length; i++) out += i < Math.floor(p * text.length) ? text[i] : text[i] === ' ' ? ' ' : chars[(Math.random() * chars.length) | 0];
    el.textContent = p < 1 ? out : text;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** types markup char by char (used by the splash) */
export async function typeInto(el: HTMLElement, markup: string, cps = 90, cancelled: () => boolean = () => false) {
  const tmp = document.createElement('div');
  tmp.innerHTML = markup;
  const full = tmp.textContent || '';
  if (reduced) { el.innerHTML = markup; return; }
  el.classList.add('cur');
  for (let i = 1; i <= full.length; i++) {
    if (cancelled()) break;
    el.textContent = full.slice(0, i);
    await wait(1000 / cps);
  }
  el.innerHTML = markup;
  el.classList.remove('cur');
}

/** switching tabs = switching CCTV cameras */
export function camcut(label: string) {
  if (reduced) return;
  let c = document.querySelector('.camcut') as HTMLElement | null;
  if (!c) {
    c = document.createElement('div');
    c.className = 'camcut';
    c.innerHTML = '<span class="camcut__label"></span>';
    document.body.appendChild(c);
  }
  c.querySelector('.camcut__label')!.textContent = label;
  anim(c, [{ opacity: 0 }, { opacity: 0.92, offset: 0.25 }, { opacity: 0.6, offset: 0.6 }, { opacity: 0 }], { duration: 260, easing: 'steps(5)' });
}

/** the seized item flies into the evidence bag on the tab bar */
export async function flyToBag(fromEl: Element | null, src: string) {
  const target = document.querySelector('[data-tab="bag"] .tab__bag');
  if (!fromEl || !target) return;
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const size = Math.min(a.width, a.height);
  const outer = document.createElement('div');
  outer.style.cssText = `position:fixed;left:${a.left + (a.width - size) / 2}px;top:${a.top + (a.height - size) / 2}px;width:${size}px;height:${size}px;z-index:84;pointer-events:none`;
  outer.innerHTML = `<div style="width:100%;height:100%"><img src="${src}" alt="" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(0,0,0,.6))"></div>`;
  document.body.appendChild(outer);
  const inner = outer.firstElementChild!;
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const d = 640;
  const ax = anim(outer, [{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { duration: d, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
  anim(inner, [
    { transform: 'translateY(0) scale(1) rotate(0deg)', opacity: 1 },
    { transform: 'translateY(-60px) scale(.55) rotate(-8deg)', opacity: 1, offset: 0.3 },
    { transform: `translateY(${dy}px) scale(${18 / size}) rotate(12deg)`, opacity: 0.85 },
  ], { duration: d, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
  await done(ax, d + 160);
  outer.remove();
  haptic.impact('light');
  anim(target, [{ transform: 'scale(1)' }, { transform: 'scale(1.45) rotate(-6deg)' }, { transform: 'scale(1)' }], { duration: 360, easing: 'cubic-bezier(.3,1.5,.5,1)' });
}

export function strikePath(w: number) {
  let d = `M -4 ${11 + Math.random() * 2}`;
  for (let i = 1; i <= 4; i++) d += ` Q ${(w * (i - 0.5)) / 4} ${8 + Math.random() * 6} ${(w * i) / 4 + (i === 4 ? 6 : 0)} ${9 + Math.random() * 4}`;
  return d;
}

/** a deterministic scribble from the username — the subject's «signature» */
export function signPath(seedStr: string | number, w = 240, h = 62) {
  let s = 0;
  for (const c of String(seedStr)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
  let x = 10;
  const y = h * 0.62;
  let d = `M ${x} ${y}`;
  const loops = 5 + (s % 3);
  for (let i = 0; i < loops; i++) {
    const up = h * (0.12 + rnd() * 0.3), dx = (w - 60) / loops;
    d += ` C ${x + dx * 0.2} ${y - up * 1.6} ${x + dx * 0.9} ${y - up * 1.2} ${x + dx * 0.55} ${y + 4}`;
    x += dx;
    d += ` S ${x + dx * 0.1} ${y - up * 0.2} ${x} ${y}`;
  }
  return d + ` C ${x + 14} ${y + 10} ${x - 70} ${y + 14} ${x - 120} ${y + 6}`;
}

/** height chart lines (mugshot wall) as an SVG string */
export function hchart({ from = 150, to = 200, minor = 1, major = 5, label = 10, w = 100, h = 100, strong = 0.42, weak = 0.14 } = {}) {
  const n = to - from;
  let s = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">`;
  for (let v = from; v <= to; v += minor) {
    const y = (h * (to - v)) / n;
    const isMaj = (v - from) % major === 0, isLab = (v - from) % label === 0;
    const len = isLab ? w : isMaj ? w * 0.18 : w * 0.06;
    s += `<line x1="0" x2="${len}" y1="${y}" y2="${y}" stroke="currentColor" stroke-opacity="${isLab ? strong : isMaj ? strong * 0.8 : weak}" vector-effect="non-scaling-stroke" stroke-width="1"/>`;
  }
  return s + '</svg>';
}
