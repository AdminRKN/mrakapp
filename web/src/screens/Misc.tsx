import { useEffect, useRef, useState } from 'react';
import { formatRub, ORDER_STATUS_LABEL, ORDER_STEPS, type ApiOrder } from '@mrak8/shared';
import { api } from '../lib/api';
import { reduced, wait } from '../lib/fx';
import { go } from '../lib/router';
import { set, toast, useStore } from '../lib/store';
import { haptic, openTelegramLink } from '../lib/telegram';
import { Classified, Logo, Picture } from '../components/brand';

/* ------------------------------------------------------------------ ДОСЬЕ */
export function Dossier() {
  const orders = useStore((s) => s.orders);
  const me = useStore((s) => s.boot?.me);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.orders().then((o) => set({ orders: o })).catch((e) => setErr((e as Error).message));
  }, []);
  const copy = (t: string) => {
    try { void navigator.clipboard?.writeText(t); } catch { /* insecure context */ }
    haptic.notify('success');
    toast('ТРЕК СКОПИРОВАН');
  };
  const list = (orders ?? []).filter((o) => o.status !== 'pending');
  return (
    <section className="screen dos" aria-label="Досье">
      <div className="scr-h"><div><span className="label">ДОСЬЕ СУБЪЕКТА #{me?.subjectNo}</span><h1 className="display">Мои дела</h1></div><span className="label">ДЕЛ: <b style={{ color: 'var(--mrak-cream)' }}>{list.length}</b></span></div>
      {err && <p className="label">{err}</p>}
      {orders && !list.length && <div className="empty" style={{ minHeight: 320 }}><h2 className="display">Дел не заведено.</h2><p>Пока вы чисты перед центром.</p><button className="btn" onClick={() => go('#/')}>К вещдокам</button></div>}
      {list.map((o: ApiOrder) => {
        const it = o.items[0];
        const step = ORDER_STEPS.indexOf(o.status);
        return (
          <article className="dcase" key={o.no}>
            <div className="dcase__h"><b>CASE #{o.no}</b><span className="label">{new Date(o.paidAt ?? o.createdAt).toLocaleDateString('ru-RU')}</span></div>
            <div className="dcase__body">
              <span className="frow__ph">{it?.image ? <Picture img={it.image} sizes="64px" width={360} /> : <Classified label="" />}</span>
              <span className="frow__t"><h3 style={{ font: '800 16px/1 var(--font-display)', textTransform: 'uppercase', margin: 0 }}>{it?.title}</h3><span className="label">{it?.size} × {it?.qty}{o.items.length > 1 ? ` · +${o.items.length - 1}` : ''}</span></span>
              <span className="price" style={{ fontSize: 13 }}>{formatRub(o.total)}</span>
            </div>
            {step >= 0 ? (
              <div className="steps">{ORDER_STEPS.map((s, i) => <div key={s} className={`step ${i < step ? 'is-done' : i === step ? 'is-now' : ''}`}>{ORDER_STATUS_LABEL[s]}</div>)}</div>
            ) : (
              <div className="steps" style={{ gridTemplateColumns: '1fr' }}><div className="step is-now">{ORDER_STATUS_LABEL[o.status]}</div></div>
            )}
            {o.trackNo ? <button className="track-no" type="button" onClick={() => copy(o.trackNo!)}><span>ТРЕК</span>{o.trackNo}<span>КОПИРОВАТЬ</span></button> : <div className="label" style={{ padding: '0 12px 12px' }}>ТРЕК-НОМЕР ПРИДЁТ ОТ БОТА ПРИ ЭТАПИРОВАНИИ</div>}
          </article>
        );
      })}
      <p className="label" style={{ textAlign: 'center', marginTop: 18 }}>ПРИНЯТ → СОБРАН → ЭТАПИРОВАН → ДОСТАВЛЕН</p>
    </section>
  );
}

/* ------------------------------------------------- СВЯЗЬ С ЦЕНТРОМ ПОТЕРЯНА */
export function Lost({ message, onRetry }: { message?: string; onRetry?: () => Promise<void> | void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    haptic.notify('error');
    const c = canvas.current;
    if (!c || reduced) return;
    const g = c.getContext('2d')!, img = g.createImageData(c.width, c.height);
    let on = true, t = 0;
    const draw = () => {
      if (!on) return;
      if (++t % 3 === 0) {
        for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
        g.putImageData(img, 0, 0);
        g.fillStyle = 'rgba(0,0,0,.6)';
        g.fillRect(0, (t * 2) % c.height, c.width, 10);
      }
      requestAnimationFrame(draw);
    };
    draw();
    return () => { on = false; };
  }, []);
  return (
    <section className="screen">
      <div className="lost">
        <canvas ref={canvas} width={90} height={160} aria-hidden="true" />
        <span className="lost__sig">● NO SIGNAL · CAM_08</span>
        <h1 className="display">Связь с центром потеряна</h1>
        <p>{message || 'Проверьте сеть. Дело не пострадало:'}<br />пакет сохранён в CloudStorage.</p>
        <button className="btn" type="button" disabled={busy} onClick={async () => { setBusy(true); haptic.impact('light'); await wait(400); try { await (onRetry ? onRetry() : go('#/', { replace: true })); } finally { setBusy(false); } }}>{busy ? 'Соединение…' : 'Повторить'}</button>
      </div>
    </section>
  );
}

/* --------------------------------- opened outside Telegram in production */
export function Gate() {
  const link = import.meta.env.VITE_MINIAPP_LINK || 'https://t.me';
  return (
    <section className="screen">
      <div className="empty">
        <div style={{ width: 180, color: '#fff' }}><Logo /></div>
        <span className="lost__sig">● ДОСТУП ТОЛЬКО ЧЕРЕЗ TELEGRAM</span>
        <h1 className="display" style={{ fontSize: 'var(--fs-d2)' }}>Центр оформления закрыт для посторонних</h1>
        <p>Откройте MRAK8 в Telegram — там ваш номер дела, пакет и оплата.</p>
        <button className="btn btn--red" type="button" onClick={() => openTelegramLink(link)}>Открыть в Telegram</button>
      </div>
    </section>
  );
}
