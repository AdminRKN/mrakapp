/* Telegram Mini Apps adapter: native inside Telegram, emulated in a browser (dev / design review). */
import { create } from 'zustand';

type Haptic = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
interface BtnParams { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean; has_shine_effect?: boolean; position?: 'left' | 'right' | 'top' | 'bottom' }
interface TgButton { setParams(p: BtnParams): void; onClick(f: () => void): void; offClick(f: () => void): void; showProgress(leaveActive?: boolean): void; hideProgress(): void }
interface WebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string; language_code?: string }; start_param?: string };
  version: string;
  platform: string;
  isVersionAtLeast(v: string): boolean;
  ready(): void;
  expand(): void;
  requestFullscreen?(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor(c: string): void;
  setBackgroundColor(c: string): void;
  setBottomBarColor?(c: string): void;
  MainButton: TgButton;
  SecondaryButton?: TgButton;
  BackButton: { show(): void; hide(): void; onClick(f: () => void): void; offClick(f: () => void): void };
  HapticFeedback: { impactOccurred(s: Haptic): void; notificationOccurred(t: 'success' | 'error' | 'warning'): void; selectionChanged(): void };
  CloudStorage: { getItem(k: string, cb: (e: unknown, v?: string) => void): void; setItem(k: string, v: string, cb?: (e: unknown, ok?: boolean) => void): void };
  openInvoice(url: string, cb: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
  requestContact?(cb: (ok: boolean, r?: { responseUnsafe?: { contact?: { phone_number: string } } }) => void): void;
  shareMessage?(id: string, cb?: (sent: boolean) => void): void;
  shareToStory?(media: string, p?: { text?: string; widget_link?: { url: string; name?: string } }): void;
  openTelegramLink(url: string): void;
  downloadFile?(p: { url: string; file_name: string }, cb?: (ok: boolean) => void): void;
  DeviceOrientation?: { start(p: { refresh_rate?: number }): void; stop(): void; beta?: number; gamma?: number };
  LocationManager?: { init(cb?: () => void): void; isLocationAvailable: boolean; getLocation(cb: (d: { latitude: number; longitude: number } | null) => void): void };
  onEvent(e: string, f: () => void): void;
  offEvent(e: string, f: () => void): void;
}
declare global { interface Window { Telegram?: { WebApp?: WebApp } } }

const W = window.Telegram?.WebApp;
const q = new URLSearchParams(location.search);
export const inTG = !!(W && W.initData);
export const frame = q.get('frame') === '1';
/** browser preview (vite dev, or ?emu=1): fake Telegram chrome + X-Dev-User auth against a dev server */
export const emulated = !inTG && (import.meta.env.DEV || q.get('emu') === '1');
export const atLeast = (v: string) => (inTG ? W!.isVersionAtLeast(v) : true);
const html = document.documentElement;
if (!inTG) html.classList.add('emu');
if (frame) html.classList.add('frame');

const demoUser = { id: Number(q.get('uid')) || 1, first_name: 'Субъект', last_name: 'Восемь', username: 'subject_0x8', photo_url: '' };
export const tgUser = (inTG && W!.initDataUnsafe.user) || demoUser;
export const initData = inTG ? W!.initData : '';
export const startParam = (inTG && W!.initDataUnsafe.start_param) || q.get('startapp') || q.get('tgWebAppStartParam') || '';
/** header values must be Latin-1 → the dev user (with Cyrillic names) travels URI-encoded */
export const devUserHeader = encodeURIComponent(JSON.stringify(demoUser));

if (!inTG) {
  html.style.setProperty('--tg-safe-area-inset-top', frame ? '47px' : 'env(safe-area-inset-top, 0px)');
  html.style.setProperty('--tg-safe-area-inset-bottom', frame ? '34px' : 'env(safe-area-inset-bottom, 0px)');
  html.style.setProperty('--tg-content-safe-area-inset-top', '46px');
}

export function initTelegram() {
  if (!inTG || !W) return;
  try {
    W.ready();
    W.expand();
    if (['ios', 'android', 'android_x'].includes(W.platform) && atLeast('8.0')) W.requestFullscreen?.();
    if (atLeast('7.7')) W.disableVerticalSwipes?.();
    if (atLeast('6.1')) { W.setHeaderColor('#0B0B0B'); W.setBackgroundColor('#0B0B0B'); }
    if (atLeast('7.10')) W.setBottomBarColor?.('#0B0B0B');
  } catch (e) { console.warn('[tg] init', e); }
}

/** the Control room repaints Telegram's own header and bottom bar, so admin mode is obvious at a glance */
export function setChrome(ctrl: boolean) {
  if (!inTG || !W) return;
  const c = ctrl ? '#2A0806' : '#0B0B0B';
  try {
    if (atLeast('6.1')) W.setHeaderColor(c);
    if (atLeast('7.10')) W.setBottomBarColor?.(c);
  } catch (e) { console.warn('[tg] chrome', e); }
}

/* ---------------------------------------------------------------- haptics */
const emu = (kind: string) => {
  if (frame && parent !== window) parent.postMessage({ m8: 'haptic', kind }, '*');
  else if (!inTG && navigator.vibrate && (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) { try { navigator.vibrate(kind.includes('heavy') ? 22 : kind.startsWith('notification') ? [10, 40, 14] : 6); } catch { /* */ } }
};
export const haptic = {
  impact: (s: Haptic = 'light') => (inTG && atLeast('6.1') ? W!.HapticFeedback.impactOccurred(s) : emu(`impactOccurred(${s})`)),
  notify: (t: 'success' | 'error' | 'warning' = 'success') => (inTG && atLeast('6.1') ? W!.HapticFeedback.notificationOccurred(t) : emu(`notificationOccurred(${t})`)),
  select: () => (inTG && atLeast('6.1') ? W!.HapticFeedback.selectionChanged() : emu('selectionChanged()')),
};

/* ----------------------------------------------------------- CloudStorage */
export const cloud = {
  get(key: string): Promise<string | null> {
    if (inTG && atLeast('6.9')) return new Promise((r) => W!.CloudStorage.getItem(key, (e, v) => r(e ? null : v ?? null)));
    try { return Promise.resolve(localStorage.getItem('m8:' + key)); } catch { return Promise.resolve(null); }
  },
  set(key: string, val: string): Promise<void> {
    if (inTG && atLeast('6.9')) return new Promise((r) => W!.CloudStorage.setItem(key, val, () => r()));
    try { localStorage.setItem('m8:' + key, val); } catch { /* private mode */ }
    return Promise.resolve();
  },
};

/* ----------------------------------------------- Main/Secondary/Back buttons */
export interface ButtonState { text: string; color: string; textColor: string; visible: boolean; active: boolean; progress: boolean; shine: boolean; position: 'left' | 'right' | 'top' | 'bottom'; onClick: (() => void) | null }
const blank = (o: Partial<ButtonState>): ButtonState => ({ text: '', color: '#E0241B', textColor: '#FFFFFF', visible: false, active: true, progress: false, shine: false, position: 'left', onClick: null, ...o });
export const useButtons = create<{ main: ButtonState; sec: ButtonState; back: (() => void) | null }>(() => ({
  main: blank({}),
  sec: blank({ color: '#1C1C1C', textColor: '#F1ECE1' }),
  back: null,
}));

let mainFn: (() => void) | null = null;
let secFn: (() => void) | null = null;
let backFn: (() => void) | null = null;
if (inTG && W) {
  W.MainButton.onClick(() => { const m = useButtons.getState().main; if (m.active && !m.progress && mainFn) mainFn(); });
  if (atLeast('7.10')) W.SecondaryButton?.onClick(() => { const s = useButtons.getState().sec; if (s.active && secFn) secFn(); });
  W.BackButton.onClick(() => backFn && backFn());
}
/** Telegram throws WebAppBottomButtonParamInvalid on an empty (or > 64 chars) text — the screen would die black.
    A button without text is simply hidden and keeps its last text. */
const nativeParams = (s: ButtonState): BtnParams => {
  const text = s.text.trim().slice(0, 64);
  return text ? { text, color: s.color, text_color: s.textColor, is_active: s.active, is_visible: s.visible } : { is_visible: false };
};
export function setMain(p: Partial<ButtonState>) {
  const next = { ...useButtons.getState().main, ...p };
  mainFn = next.onClick;
  useButtons.setState({ main: next });
  if (inTG && W) {
    W.MainButton.setParams({ ...nativeParams(next), has_shine_effect: next.shine });
    next.progress ? W.MainButton.showProgress(false) : W.MainButton.hideProgress();
  }
}
export function setSecondary(p: Partial<ButtonState>) {
  const next = { ...useButtons.getState().sec, ...p };
  secFn = next.onClick;
  useButtons.setState({ sec: next });
  if (inTG && W && atLeast('7.10')) W.SecondaryButton?.setParams({ ...nativeParams(next), position: next.position });
}
export function setBack(fn: (() => void) | null) {
  backFn = fn;
  useButtons.setState({ back: fn });
  if (inTG && W) fn ? W.BackButton.show() : W.BackButton.hide();
}
export const resetButtons = () => {
  setMain(blank({}));
  setSecondary(blank({ color: '#1C1C1C', textColor: '#F1ECE1' }));
};

/* ------------------------------------------------------------ platform calls */
export function openInvoice(url: string): Promise<'paid' | 'cancelled' | 'failed' | 'pending'> {
  return new Promise((r) => W!.openInvoice(url, r));
}
export function requestContact(): Promise<string | null> {
  return new Promise((r) => {
    if (inTG && atLeast('6.9') && W!.requestContact) {
      W!.requestContact((ok, res) => r(ok && res?.responseUnsafe?.contact ? '+' + String(res.responseUnsafe.contact.phone_number).replace(/^\+/, '') : null));
    } else setTimeout(() => r('+7 999 008-08-08'), 350);
  });
}
export function shareMessage(id: string): Promise<boolean> {
  return new Promise((r) => (inTG && atLeast('8.0') && W!.shareMessage ? W!.shareMessage(id, (sent) => r(!!sent)) : r(false)));
}
export function shareToStory(mediaUrl: string, text: string, link: string) {
  if (inTG && atLeast('7.8') && W!.shareToStory) { W!.shareToStory(mediaUrl, { text, widget_link: { url: link, name: 'MRAK8' } }); return true; }
  return false;
}
export function openTelegramLink(url: string) {
  if (inTG) W!.openTelegramLink(url); else window.open(url, '_blank', 'noopener');
}
export function downloadFile(url: string, name: string) {
  if (inTG && atLeast('8.0') && W!.downloadFile) { W!.downloadFile({ url, file_name: name }); return true; }
  return false;
}

/** where the subject is, for «pickup points near me»: Telegram LocationManager (Bot API 8.0) asks for permission
    itself; in a browser — the Geolocation API. null when it is unavailable or refused. */
export function getLocation(): Promise<{ lat: number; lon: number } | null> {
  const LM = inTG && atLeast('8.0') ? W!.LocationManager : undefined;
  if (LM)
    return new Promise((ok) => {
      try {
        LM.init(() => {
          if (!LM.isLocationAvailable) return ok(null);
          LM.getLocation((d) => ok(d ? { lat: d.latitude, lon: d.longitude } : null));
        });
      } catch { ok(null); }
    });
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), () => ok(null), { timeout: 10_000, maximumAge: 600_000 });
  });
}

/** gyroscope: Telegram DeviceOrientation (Bot API 8.0) → window deviceorientation fallback */
export function startOrientation(cb: (beta: number, gamma: number) => void): () => void {
  if (inTG && atLeast('8.0') && W!.DeviceOrientation) {
    try {
      W!.DeviceOrientation.start({ refresh_rate: 50 });
      const h = () => cb(W!.DeviceOrientation!.beta || 0, W!.DeviceOrientation!.gamma || 0);
      W!.onEvent('deviceOrientationChanged', h);
      return () => { W!.offEvent('deviceOrientationChanged', h); W!.DeviceOrientation!.stop(); };
    } catch { /* fall through */ }
  }
  const h = (e: DeviceOrientationEvent) => { if (e.gamma != null) cb(((e.beta || 0) * Math.PI) / 180, ((e.gamma || 0) * Math.PI) / 180); };
  addEventListener('deviceorientation', h);
  return () => removeEventListener('deviceorientation', h);
}
