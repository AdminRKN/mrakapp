import { useEffect, useRef } from 'react';
import { CATEGORY_LABEL, formatRub, type ApiProduct } from '@mrak8/shared';
import { api } from '../lib/api';
import { anim, reduced, stampSVG, wait } from '../lib/fx';
import { go } from '../lib/router';
import { set, stockOf, toast, useStore, type View } from '../lib/store';
import { haptic, startOrientation } from '../lib/telegram';
import { Classified, Countdown, Eight, Picture } from '../components/brand';

const CATS = [
  { k: 'all', t: 'ВСЕ' }, { k: 'hoodie', t: 'ХУДИ' }, { k: 'tee', t: 'ФУТБОЛКИ' }, { k: 'acc', t: 'АКСЕССУАРЫ' }, { k: 'archive', t: 'АРХИВ' },
];
const FeedIcon = () => <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="1.5" width="12" height="15" /><path d="M6 13h6" /></svg>;
const FilesIcon = () => <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 3.5h15M1.5 9h15M1.5 14.5h15" /><path d="M4 2v3M4 7.5v3M4 13v3" strokeWidth="2" /></svg>;

export function StockTag({ p }: { p: ApiProduct }) {
  if (p.status === 'soldout') return <span className="tag tag--warn">SOLD OUT</span>;
  if (p.status === 'drop') return <span className="tag tag--warn">ДРОП СКОРО</span>;
  if (p.status === 'archive') return <span className="tag">АРХИВ</span>;
  const n = stockOf(p);
  if (!n) return <span className="tag tag--warn">SOLD OUT</span>;
  return n <= 5 ? <span className="tag tag--warn">ОСТАЛОСЬ {n}</span> : <span className="tag tag--ok">В НАЛИЧИИ</span>;
}

export async function watchDrop(p: ApiProduct) {
  const on = !p.watching;
  try {
    await api.watch(p.id, on);
    set((s) => ({ boot: s.boot && { ...s.boot, products: s.boot.products.map((x) => (x.id === p.id ? { ...x, watching: on } : x)) } }));
    haptic.notify(on ? 'success' : 'warning');
    if (on) toast('БОТ НАПИШЕТ В МОМЕНТ ДРОПА');
  } catch (e) {
    haptic.notify('error');
    toast((e as Error).message);
  }
}

function Case({ p, i, n }: { p: ApiProduct; i: number; n: number }) {
  const img = p.images.front;
  const bb = img?.bbox ?? [10, 12, 90, 90];
  const soldout = p.status === 'soldout' || (p.status === 'live' && !stockOf(p));
  return (
    <article className="case" data-open={p.id} data-i={i} tabIndex={0} aria-label={p.title} onClick={(e) => { if (e.currentTarget.closest('.cat')?.classList.contains('is-pulling')) return; haptic.impact('medium'); go('#/case/' + p.id); }} onKeyDown={(e) => e.key === 'Enter' && go('#/case/' + p.id)}>
      <div className="case__grid" />
      <div className="case__num" aria-hidden="true"><em>#</em>{p.no}</div>
      <div className="case__stage" data-vt={p.id}>
        {img ? (<>
          <img className="case__lqip" src={img.lqip} alt="" aria-hidden="true" />
          <Picture img={img} className="case__img" sizes="(max-width: 480px) 86vw, 380px" alt={p.title} eager={i === 0} width={720} />
        </>) : <Classified />}
        {!img && p.status === 'drop' && <div className="redact" style={{ left: '30%', right: '30%', top: '38%' }}>ЗАСЕКРЕЧЕНО</div>}
        <div className="track" style={{ left: `${bb[0] + 4}%`, top: `${bb[1] + 2}%`, right: `${100 - bb[2] + 4}%`, bottom: `${100 - bb[3] + 2}%` }}>
          <i /><i /><i /><i />
          <div className="track__lbl"><b>OBJ_{p.no}</b><span>{p.category.toUpperCase()} · CONF <span data-conf>0.00</span></span></div>
        </div>
      </div>
      {soldout && <div className="case__stampslot" aria-hidden="true" style={{ color: 'var(--mrak-red)' }} dangerouslySetInnerHTML={{ __html: stampSVG('SOLD OUT', 'ВЕЩДОК ИЗЪЯТ', { w: 300, h: 100 }) }} />}
      <div className="case__top"><span className="label">ВЕЩДОК #{p.no} · {CATEGORY_LABEL[p.category]}{p.batch ? ` · ПАРТИЯ ${p.batch}` : ''}</span><StockTag p={p} /></div>
      <div className="case__info">
        {p.status === 'drop' && p.dropAt ? (<>
          <span className="label">ДРОП · {new Date(p.dropAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          <Countdown to={p.dropAt} />
          <div className="case__row" style={{ pointerEvents: 'auto' }}>
            <span className="price">{formatRub(p.price)}</span>
            <button className={`btn ${p.watching ? 'btn--red' : ''}`} type="button" onClick={(e) => { e.stopPropagation(); void watchDrop(p); }}>{p.watching ? 'ВЫ НА НАБЛЮДЕНИИ ●' : 'УВЕДОМИТЬ МЕНЯ'}</button>
          </div>
        </>) : (<>
          <h2 className="display case__title">{p.name || p.title}<br />{p.sub}</h2>
          {soldout && <p className="case__note">Вещдок изъят другим субъектом.</p>}
          <div className="case__row"><span className="price">{formatRub(p.price)}{p.oldPrice ? <s>{formatRub(p.oldPrice)}</s> : null}</span><span className="case__open">{soldout ? 'ПРОТОКОЛ' : 'ОТКРЫТЬ ДЕЛО'}</span></div>
        </>)}
      </div>
      {i === 0 && n > 1 && <div className="feedhint">↑ СЛЕДУЮЩЕЕ ДЕЛО</div>}
    </article>
  );
}

function Files({ items }: { items: ApiProduct[] }) {
  return (
    <div className="files">
      <div className="files__head label"><span>№</span><span>ФОТО</span><span>НАИМЕНОВАНИЕ</span><span>ЦЕНА</span></div>
      {items.map((p) => {
        const n = stockOf(p);
        const st = p.status === 'drop' ? 'ДРОП СКОРО' : p.status === 'soldout' || !n ? 'SOLD OUT' : `ОСТ. ${n}`;
        return (
          <button className="frow" key={p.id} type="button" onClick={() => { haptic.impact('light'); go('#/case/' + p.id); }}>
            <span className="frow__no">#{p.no}<small>{p.sig}</small></span>
            <span className="frow__ph" data-vt={p.id}>{p.images.front ? <Picture img={p.images.front} sizes="60px" width={360} /> : <Classified label="" />}</span>
            <span className="frow__t"><h3>{p.name} {p.sub}</h3><span className="frow__sizes">{p.sizes.map((s) => (s.available ? <span key={s.label}>{s.label}</span> : <s key={s.label}>{s.label}</s>))}</span></span>
            <span className="frow__r"><span className="price">{formatRub(p.price)}</span><span className={`frow__stock ${p.status !== 'live' || n <= 5 ? 'is-low' : ''}`}>{st}</span></span>
          </button>
        );
      })}
      <div className="files__foot">ОПИСЬ СОСТАВЛЕНА {new Date().toLocaleDateString('ru-RU')} · ВСЕГО ВЕЩДОКОВ: {items.length}<br />NO EMOTIONAL CONTRABAND. ALL SUBJECTS ARE MONITORED.</div>
    </div>
  );
}

/** parallax, gyroscope tilt, tracking-box lock-on, progress ticks, pull-to-refresh */
function wireFeed(body: HTMLElement) {
  const feed = body.querySelector<HTMLElement>('.feed');
  if (!feed) return () => {};
  const cases = Array.from(feed.querySelectorAll<HTMLElement>('.case'));
  const prog = Array.from(body.querySelectorAll<HTMLElement>('.feedprog i'));
  let raf = 0, active = -1;
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  const setActive = (idx: number) => {
    active = idx;
    prog.forEach((t, i) => t.classList.toggle('is-on', i === idx));
    const c = cases[idx];
    if (!c || c.classList.contains('is-live')) return;
    c.classList.add('is-live');
    anim(c.querySelector('.track'), [{ transform: 'scale(1.3)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.4 }, { transform: 'scale(1.04)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 520, easing: 'steps(4, end)' });
    const conf = c.querySelector('[data-conf]');
    if (conf) {
      const target = 0.9 + Math.random() * 0.08, t0 = performance.now();
      const step = (now: number) => { const k = Math.min(1, (now - t0) / 700); conf.textContent = (target * k).toFixed(2); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
    if (idx > 0) haptic.select();
  };
  const paint = () => {
    raf = 0;
    const H = feed.clientHeight || 1;
    cases.forEach((c) => { const p = (c.offsetTop - feed.scrollTop) / H; if (Math.abs(p) < 1.5) c.style.setProperty('--p', p.toFixed(3)); });
    const idx = Math.round(feed.scrollTop / H);
    if (idx !== active) setActive(idx);
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };
  feed.addEventListener('scroll', onScroll, { passive: true });
  paint();

  let tiltRaf = 0;
  const applyTilt = () => {
    tiltRaf = 0;
    tilt.x += (tilt.tx - tilt.x) * 0.18;
    tilt.y += (tilt.ty - tilt.y) * 0.18;
    const c = cases[active];
    if (c) { c.style.setProperty('--tx', (tilt.x * 14).toFixed(2) + 'px'); c.style.setProperty('--ty', (tilt.y * 10).toFixed(2) + 'px'); c.style.setProperty('--rot', (tilt.x * 2.2).toFixed(2) + 'deg'); }
    if (Math.abs(tilt.tx - tilt.x) > 0.002 || Math.abs(tilt.ty - tilt.y) > 0.002) tiltRaf = requestAnimationFrame(applyTilt);
  };
  const kick = () => { if (!tiltRaf && !reduced) tiltRaf = requestAnimationFrame(applyTilt); };
  const stopOri = startOrientation((beta, gamma) => { tilt.tx = Math.max(-1, Math.min(1, gamma / 0.5)); tilt.ty = Math.max(-1, Math.min(1, (beta - 0.7) / 0.5)); kick(); });
  const onMove = (ev: PointerEvent) => {
    if (ev.pointerType === 'touch') return;
    const r = feed.getBoundingClientRect();
    tilt.tx = ((ev.clientX - r.left) / r.width - 0.5) * 2;
    tilt.ty = ((ev.clientY - r.top) / r.height - 0.5) * 2;
    kick();
  };
  feed.addEventListener('pointermove', onMove);
  let sx: number | null = null;
  const ts = (ev: TouchEvent) => { sx = ev.touches[0].clientX; };
  const tm = (ev: TouchEvent) => { if (sx == null) return; tilt.tx = Math.max(-1, Math.min(1, (ev.touches[0].clientX - sx) / 120)); kick(); };
  const te = () => { sx = null; tilt.tx = 0; tilt.ty = 0; kick(); };
  feed.addEventListener('touchstart', ts, { passive: true });
  feed.addEventListener('touchmove', tm, { passive: true });
  feed.addEventListener('touchend', te);

  /* pull to refresh with the 8-scanner */
  const eight = body.querySelector<HTMLElement>('.ptr__eight')!, lbl = body.querySelector<HTMLElement>('.ptr__lbl')!;
  const cat = body.closest('.cat') as HTMLElement;
  let y0: number | null = null, dist = 0, busy = false;
  const setPull = (d: number) => {
    dist = d;
    const k = Math.min(1, d / 90);
    eight.style.opacity = String(k); lbl.style.opacity = String(k);
    eight.style.transform = `translateY(${Math.min(d, 110) * 0.6 - 20}px) rotate(${d * 3}deg)`;
    eight.querySelectorAll<HTMLElement>('.ring').forEach((r, i) => (r.style.transform = i ? `rotateY(${d * 4}deg)` : `rotateX(${d * 5}deg)`));
    feed.style.transform = d ? `translateY(${Math.min(d, 110) * 0.5}px)` : '';
    lbl.textContent = d > 80 ? 'ОТПУСТИ — ПЕРЕСМОТР ДЕЛ' : 'ПОТЯНИ — ОБНОВИТЬ ДЕЛА';
  };
  const down = (ev: PointerEvent) => { if (busy || feed.scrollTop > 2) return; y0 = ev.clientY; };
  const move = (ev: PointerEvent) => {
    if (y0 == null) return;
    const d = ev.clientY - y0;
    if (d > 8) { cat.classList.add('is-pulling'); setPull((d - 8) * 0.8); } else if (d < -4) y0 = null;
  };
  const up = async () => {
    if (y0 == null) return;
    y0 = null;
    setTimeout(() => cat.classList.remove('is-pulling'), 30);
    if (dist > 80) {
      busy = true;
      haptic.impact('medium');
      lbl.textContent = 'ПЕРЕСМОТР ДЕЛ…';
      feed.style.transition = 'transform .3s';
      feed.style.transform = 'translateY(54px)';
      const spins = [
        anim(eight.querySelector('.ring--t'), [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(720deg)' }], { duration: 1600, iterations: Infinity }),
        anim(eight.querySelector('.ring--b'), [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(360deg)' }], { duration: 1150, iterations: Infinity }),
      ];
      try {
        const [boot] = await Promise.all([api.bootstrap(), wait(700)]);
        set({ boot });
        toast('ДЕЛА АКТУАЛЬНЫ · ВЕЩДОКОВ: ' + boot.products.length);
      } catch (e) { toast((e as Error).message); }
      spins.forEach((a) => a.cancel());
      feed.style.transform = ''; setPull(0);
      setTimeout(() => (feed.style.transition = ''), 320);
      busy = false;
    } else { feed.style.transition = 'transform .25s'; setPull(0); setTimeout(() => (feed.style.transition = ''), 260); }
  };
  const tmv = (ev: TouchEvent) => { if (y0 != null && ev.touches[0].clientY - y0 > 8 && ev.cancelable) ev.preventDefault(); };
  feed.addEventListener('pointerdown', down);
  feed.addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  feed.addEventListener('touchmove', tmv, { passive: false });

  return () => {
    feed.removeEventListener('scroll', onScroll);
    feed.removeEventListener('pointermove', onMove);
    feed.removeEventListener('touchstart', ts);
    feed.removeEventListener('touchmove', tm);
    feed.removeEventListener('touchend', te);
    feed.removeEventListener('pointerdown', down);
    feed.removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    feed.removeEventListener('touchmove', tmv);
    stopOri();
    cancelAnimationFrame(raf);
    cancelAnimationFrame(tiltRaf);
  };
}

export function Catalog({ active }: { active: boolean }) {
  const products = useStore((s) => s.boot?.products ?? []);
  const filter = useStore((s) => s.filter);
  const view = useStore((s) => s.view);
  const body = useRef<HTMLDivElement>(null);
  const items = products.filter((p) => (filter === 'all' ? p.status !== 'archive' : filter === 'archive' ? p.status === 'soldout' || p.status === 'archive' : p.category === filter && p.status !== 'archive'));
  const key = items.map((p) => `${p.id}:${p.status}:${p.watching}`).join(',');

  useEffect(() => {
    if (!active || view !== 'feed' || !body.current) return;
    return wireFeed(body.current);
  }, [active, view, key]);

  const pick = (f: string) => { if (f !== filter) { haptic.select(); set({ filter: f }); anim(body.current, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' }); } };
  const pickView = (v: View) => { if (v !== view) { haptic.select(); set({ view: v }); } };

  return (
    <section className="screen cat" aria-label="Каталог вещдоков" hidden={!active} style={{ display: active ? 'flex' : undefined }}>
      <div className="cat__bar">
        <div className="chips" role="tablist" aria-label="Фильтр">
          {CATS.map((c) => <button key={c.k} role="tab" aria-selected={filter === c.k} className={`chip ${filter === c.k ? 'is-on' : ''}`} onClick={() => pick(c.k)}>{c.t}</button>)}
        </div>
        <div className="viewtog" role="group" aria-label="Вид">
          <button className={view === 'feed' ? 'is-on' : ''} aria-label="Лента" onClick={() => pickView('feed')}><FeedIcon /></button>
          <button className={view === 'files' ? 'is-on' : ''} aria-label="Картотека" onClick={() => pickView('files')}><FilesIcon /></button>
        </div>
      </div>
      <div className="cat__body" ref={body} style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {!items.length ? (
          <div className="empty"><h2 className="display">Дел не найдено</h2><p>В этой категории вещдоков нет. Пока.</p></div>
        ) : view === 'files' ? (
          <Files items={items} />
        ) : (<>
          <div className="ptr"><div className="ptr__eight" style={{ color: 'var(--mrak-cream)' }}><Eight /></div><div className="ptr__lbl">ПОТЯНИ — ОБНОВИТЬ ДЕЛА</div></div>
          <div className="feed">{items.map((p, i) => <Case key={p.id} p={p} i={i} n={items.length} />)}</div>
          <div className="feedprog" aria-hidden="true">{items.map((p, i) => <i key={p.id} className={i ? '' : 'is-on'} />)}</div>
        </>)}
      </div>
    </section>
  );
}
