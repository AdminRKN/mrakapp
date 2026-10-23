import { useEffect, useState, type CSSProperties } from 'react';
import type { ApiImage } from '@mrak8/shared';
import { LOGO, LOGO_VB } from '../lib/logo';
import { hchart } from '../lib/fx';

const L = LOGO;
const LETTERS = L.letters.m + L.letters.r + L.letters.a + L.letters.k;

export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox={LOGO_VB} fill="currentColor" role="img" aria-label="MRAK8">
      <path fillRule="evenodd" d={LETTERS} />
      <path fillRule="evenodd" d={L.ringTop} />
      <path fillRule="evenodd" d={L.ringBottom} />
    </svg>
  );
}

const pct = (e: readonly number[]) => `${(((e[0] - L.viewBox[0]) / L.viewBox[2]) * 100).toFixed(2)}% ${(((e[1] - L.viewBox[1]) / L.viewBox[3]) * 100).toFixed(2)}%`;

/** each letter and each ring is its own <svg> box so the rings can rotate in real CSS 3D */
export function LogoLayers() {
  return (
    <div className="logo3d" role="img" aria-label="MRAK8">
      <svg className="ring ring--b" viewBox={LOGO_VB} fill="currentColor" aria-hidden="true" style={{ transformOrigin: pct(L.ringBottomEllipse) }}><path fillRule="evenodd" d={L.ringBottom} /></svg>
      <svg className="ring ring--t" viewBox={LOGO_VB} fill="currentColor" aria-hidden="true" style={{ transformOrigin: pct(L.ringTopEllipse) }}><path fillRule="evenodd" d={L.ringTop} /></svg>
      {(['m', 'r', 'a', 'k'] as const).map((k) => (
        <svg key={k} className={`l-letter l-${k}`} viewBox={LOGO_VB} fill="currentColor" aria-hidden="true" style={{ transformOrigin: '50% 100%' }}><path fillRule="evenodd" d={L.letters[k]} /></svg>
      ))}
    </div>
  );
}

/** the 8 on its own: loader, pull-to-refresh, scanner */
export function Eight({ className = '', style }: { className?: string; style?: CSSProperties }) {
  const t = L.ringTopEllipse, b = L.ringBottomEllipse;
  const x0 = b[0] - b[2] - 2, y0 = t[1] - t[3] - 2, w = b[2] * 2 + 4, h = b[1] + b[3] - y0 + 2;
  const o = (e: readonly number[]) => `${(((e[0] - x0) / w) * 100).toFixed(2)}% ${(((e[1] - y0) / h) * 100).toFixed(2)}%`;
  const vb = `${x0} ${y0} ${w} ${h}`;
  const box: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
  return (
    <div className={`eight ${className}`} aria-hidden="true" style={{ position: 'relative', aspectRatio: (w / h).toFixed(3), perspective: 400, ...style }}>
      <svg viewBox={vb} fill="currentColor" className="ring ring--b" style={{ ...box, transformOrigin: o(b) }}><path fillRule="evenodd" d={L.ringBottom} /></svg>
      <svg viewBox={vb} fill="currentColor" className="ring ring--t" style={{ ...box, transformOrigin: o(t) }}><path fillRule="evenodd" d={L.ringTop} /></svg>
    </div>
  );
}

export function HChart({ className = 'hchart', style, labels, ...o }: { className?: string; style?: CSSProperties; labels?: [number, number, number] } & Parameters<typeof hchart>[0]) {
  const from = o?.from ?? 150, to = o?.to ?? 200;
  return (
    <div className={className} style={{ color: 'var(--mrak-cream)', ...style }} aria-hidden="true">
      <div style={{ position: 'absolute', inset: 0 }} dangerouslySetInnerHTML={{ __html: hchart(o) }} />
      {labels &&
        Array.from({ length: Math.floor((labels[1] - labels[0]) / labels[2]) + 1 }, (_, i) => labels[0] + i * labels[2]).map((v) => (
          <span key={v} style={{ position: 'absolute', left: 4, top: `${((to - v) / (to - from)) * 100}%`, transform: 'translateY(-120%)', font: '600 8px/1 var(--font-mono)', letterSpacing: '.06em', color: 'var(--mrak-grey)' }}>{v}</span>
        ))}
    </div>
  );
}

const SLOGAN = 'NO EMOTIONAL CONTRABAND. ALL SUBJECTS ARE MONITORED. НЕ ДИЗАЙНЕР.';
export function Tape({ text = SLOGAN, cls = '', speed = 22 }: { text?: string; cls?: string; speed?: number }) {
  const run = Array.from({ length: 6 }, (_, i) => <span key={i}>{text}</span>);
  return (
    <div className={`tape ${cls}`} aria-hidden="true" style={{ ['--tape-speed' as string]: `${speed}s` }}>
      <div className="tape__track">{run}{run.map((s, i) => <span key={'b' + i}>{text}</span>)}</div>
    </div>
  );
}

/** <picture> with AVIF + WebP srcsets produced by the server pipeline */
export function Picture({ img, sizes = '(max-width: 480px) 92vw, 400px', alt = '', className, eager, width = 1200, onLoad }: { img: ApiImage; sizes?: string; alt?: string; className?: string; eager?: boolean; width?: number; onLoad?: () => void }) {
  const set = (f: string) => img.widths.map((w) => `${img.base}-${w}.${f} ${w}w`).join(', ');
  const fallback = img.widths.filter((w) => w <= width).pop() ?? img.widths[0];
  return (
    <picture>
      {img.formats.includes('avif') && <source type="image/avif" srcSet={set('avif')} sizes={sizes} />}
      <img className={className} src={`${img.base}-${fallback}.webp`} srcSet={set('webp')} sizes={sizes} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : 'auto'} onLoad={onLoad} />
    </picture>
  );
}
export const imgUrl = (img: ApiImage, w = 720, f: 'webp' | 'avif' = 'webp') => `${img.base}-${img.widths.filter((x) => x <= w).pop() ?? img.widths[0]}.${f}`;

/** item without photos yet: a classified tech-flat, never a fake photo */
export function Classified({ label = 'ФОТО ЗАСЕКРЕЧЕНО' }: { label?: string }) {
  return (
    <div className="flat" aria-hidden="true">
      <svg viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M150 58C165 86 235 86 250 58L318 78 386 150 342 188 306 154V352H94V154L58 188 14 150 82 78Z" fill="#101010" />
        <path d="M160 63C174 92 226 92 240 63" />
        <path d="M94 340H306M318 92 372 150M82 92 28 150" strokeDasharray="3 4" strokeOpacity=".5" />
        <path d="M200 92V352" strokeDasharray="10 4 2 4" strokeOpacity=".25" />
        <rect x="110" y="178" width="180" height="34" fill="#0B0B0B" stroke="#F1ECE1" strokeOpacity=".2" />
        <text x="200" y="200" textAnchor="middle" fill="#8A8680" stroke="none" fontFamily="JetBrains Mono Variable, monospace" fontSize="11" letterSpacing="3">{label}</text>
      </svg>
    </div>
  );
}

function split(ms: number) {
  const d = Math.max(0, ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return [p(Math.floor(d / 864e5)), p(Math.floor((d % 864e5) / 36e5)), p(Math.floor((d % 36e5) / 6e4)), p(Math.floor((d % 6e4) / 1e3))];
}
export function Countdown({ to }: { to: string }) {
  const t = new Date(to).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const [D, H, M, Sx] = split(t - now);
  const unit = (v: string, l: string) => <span>{v}<small>{l}</small></span>;
  return (
    <div className="count" role="timer" aria-label={`До дропа ${D} дн ${H} ч ${M} мин`}>
      {unit(D, 'ДН')}<b className="sep">:</b>{unit(H, 'ЧАС')}<b className="sep">:</b>{unit(M, 'МИН')}<b className="sep">:</b>{unit(Sx, 'СЕК')}
    </div>
  );
}

/** ticking OSD clock */
export function Clock({ mode = 'full' }: { mode?: 'full' | 'time' | 'tc' }) {
  const [d, setD] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setD(new Date()), mode === 'tc' ? 80 : 1000);
    return () => clearInterval(i);
  }, [mode]);
  const p = (n: number) => String(n).padStart(2, '0');
  const time = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  const text = mode === 'full' ? `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${time}` : mode === 'tc' ? `${time}:${p(Math.floor(d.getMilliseconds() / 40))}` : time;
  return <time>{text}</time>;
}
