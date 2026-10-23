import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cartCount, useStore } from '../lib/store';
import { go, useRouter, TAB } from '../lib/router';
import { haptic, inTG, useButtons } from '../lib/telegram';
import { scramble } from '../lib/fx';
import { Clock, Logo } from './brand';
import { DjButton } from './DjSet';

/** the Control room is a different room: own header, warning band, own bottom bar (only for ADMIN_IDS) */
export const useCtrl = () => {
  const admin = useStore((s) => !!s.boot?.me.isAdmin);
  const name = useRouter((s) => s.route.name);
  return admin && (name === 'admin' || name === 'editor');
};

export function Header() {
  const me = useStore((s) => s.boot?.me);
  const ctrl = useCtrl();
  if (ctrl)
    return (
      <header className="hdr hdr--ctrl">
        <button className="hdr__logo" onClick={() => { haptic.impact('light'); go('#/'); }} aria-label="Выйти в магазин"><Logo /></button>
        <div className="hdr__subject"><span>ДЕЖУРНЫЙ</span><b>OP #{me?.subjectNo}</b></div>
        <div className="hdr__rec"><span className="ctrl-badge">CONTROL ROOM</span><Clock /></div>
      </header>
    );
  return (
    <header className="hdr">
      <button className="hdr__logo" onClick={() => { haptic.impact('light'); go('#/'); }} aria-label="MRAK8 — к вещдокам"><Logo /></button>
      <button className="hdr__subject" onClick={() => { haptic.impact('light'); go('#/dossier'); }} aria-label="Ваше дело">
        <span>SUBJECT</span><b>#{me?.subjectNo ?? '08-····'}</b>
      </button>
      <DjButton />
      <div className="hdr__rec">
        {me?.isAdmin ? (
          <button className="hdr__ctrl" onClick={() => { haptic.impact('medium'); go('#/admin'); }}>● CONTROL ROOM</button>
        ) : (
          <span className="rec" aria-hidden="true"><i className="dot" />REC · CAM_08</span>
        )}
        <Clock />
      </div>
    </header>
  );
}

export function CtrlBand() {
  return (
    <div className="ctrlband" role="note">
      <span>■ CONTROL ROOM · ТОЛЬКО ДЛЯ ДЕЖУРНЫХ</span>
      <button type="button" onClick={() => { haptic.impact('light'); go('#/'); }}>В МАГАЗИН →</button>
    </div>
  );
}

const CTRL_TABS = [['products', 'ТОВАРЫ'], ['orders', 'ЗАКАЗЫ'], ['drops', 'ДРОПЫ'], ['delivery', 'ДОСТАВКА'], ['channel', 'КАНАЛ']] as const;

function CtrlBar() {
  const route = useRouter((s) => s.route);
  const cur = route.name === 'editor' ? 'products' : route.params.tab || 'products';
  return (
    <nav className="tabbar tabbar--ctrl" aria-label="Разделы пульта">
      {CTRL_TABS.map(([k, t]) => (
        <button key={k} className={`tab ${cur === k ? 'is-on' : ''}`} onClick={() => { haptic.select(); go(k === 'products' ? '#/admin' : '#/admin/' + k, { replace: route.name === 'admin' }); }}>{t}</button>
      ))}
    </nav>
  );
}

const BagIcon = () => (
  <svg className="tab__bag" viewBox="0 0 18 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M1.5 5h15v12.6c0 .7-.5 1.2-1.2 1.2H2.7c-.7 0-1.2-.5-1.2-1.2z" />
    <path d="M1.5 1.6h15V5h-15z" fill="currentColor" fillOpacity=".22" />
    <path d="M4.5 10h6M4.5 13h8.5" strokeOpacity=".6" />
  </svg>
);

export function TabBar() {
  return useCtrl() ? <CtrlBar /> : <ShopBar />;
}

function ShopBar() {
  const tab = useRouter((s) => TAB[s.route.name]);
  const n = useStore((s) => cartCount(s.cart));
  const countRef = useRef<HTMLElement>(null);
  const prev = useRef(n);
  useEffect(() => {
    if (prev.current !== n) scramble(countRef.current, String(n), 220);
    prev.current = n;
  }, [n]);
  const t = (k: 'catalog' | 'bag' | 'dossier', path: string) => ({ className: `tab ${tab === k ? 'is-on' : ''}`, 'data-tab': k, onClick: () => { haptic.impact('light'); go(path); } });
  return (
    <nav className="tabbar" aria-label="Разделы">
      <button {...t('catalog', '#/')}><i>01</i>ВЕЩДОКИ</button>
      <button {...t('bag', '#/bag')} aria-label={`Пакет, предметов: ${n}`}><span className="tab__row"><BagIcon /><b className="tab__count" data-n={n} ref={countRef}>{n}</b></span>ПАКЕТ</button>
      <button {...t('dossier', '#/dossier')}><i>03</i>ДОСЬЕ</button>
    </nav>
  );
}

/* --------------------------------------------------- overlays on <body> */
export function Overlays() {
  return createPortal(
    <>
      <div className="cctv" aria-hidden="true"><div className="cctv__lines" /><div className="cctv__grain" /><div className="cctv__roll" /><div className="cctv__vig" /></div>
      {!inTG && <EmuChrome />}
      <Toasts />
    </>,
    document.body,
  );
}

function EmuChrome() {
  const back = useButtons((s) => s.back);
  return (
    <>
      <div className="tg-status" aria-hidden="true">
        <span>9:41</span>
        <svg viewBox="0 0 66 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx=".6" /><rect x="5" y="6" width="3" height="6" rx=".6" /><rect x="10" y="3" width="3" height="9" rx=".6" /><rect x="15" y="0" width="3" height="12" rx=".6" /><rect x="48.5" y=".5" width="15" height="11" rx="3" fill="none" stroke="#fff" strokeOpacity=".5" /><rect x="50" y="2" width="10" height="8" rx="1.6" /></svg>
      </div>
      <div className="tg-pills">
        <button className="tg-pill tg-pill--l" type="button" onClick={() => back && back()}>
          {back ? (<><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 3 5 8l5 5" /></svg>Назад</>) : (<><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m4 4 8 8M12 4l-8 8" /></svg>Закрыть</>)}
        </button>
        <span className="tg-pill tg-pill--r" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="m4 6 4 4 4-4" /></svg>
          <svg viewBox="0 0 16 16" fill="#fff"><circle cx="3" cy="8" r="1.6" /><circle cx="8" cy="8" r="1.6" /><circle cx="13" cy="8" r="1.6" /></svg>
        </span>
      </div>
    </>
  );
}

/** outside Telegram the native bottom bar is drawn here; inside Telegram it is Telegram's own */
export function EmuBottom() {
  const { main, sec } = useButtons();
  const on = !inTG && (main.visible || sec.visible);
  useEffect(() => {
    document.documentElement.style.setProperty('--tab-safe', on ? '0px' : 'var(--safe-bottom)');
  }, [on]);
  if (inTG) return null;
  return (
    <div className={`tg-bottom ${on ? 'is-on' : ''} ${sec.visible && (sec.position === 'top' || sec.position === 'bottom') ? 'is-stack' : ''}`} aria-label="Кнопки Telegram (эмуляция)">
      {sec.visible && (
        <button className="tg-btn tg-btn--sec" type="button" style={{ background: sec.color, color: sec.textColor, order: sec.position === 'right' || sec.position === 'bottom' ? 2 : 0 }} onClick={() => sec.active && sec.onClick?.()}>{sec.text}</button>
      )}
      {main.visible && (
        <button className={`tg-btn tg-btn--main ${main.active ? '' : 'is-off'} ${main.shine && main.active && !main.progress ? 'is-shine' : ''}`} type="button" style={{ background: main.color, color: main.textColor }} onClick={() => main.active && !main.progress && main.onClick?.()}>
          {main.progress ? <i className="spin" /> : main.text}
        </button>
      )}
    </div>
  );
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <span>{t.text}</span>
          {t.action && <button type="button" onClick={() => { t.onAction?.(); useStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })); }}>{t.action}</button>}
        </div>
      ))}
    </div>
  );
}

/** MainButton / SecondaryButton for the lifetime of a screen */
export { useMainButton } from './useMainButton';
