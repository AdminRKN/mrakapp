/* Stack router driven by the Telegram BackButton. Hash-mirrored so deep links and reloads work. */
import { flushSync } from 'react-dom';
import { create } from 'zustand';
import { camcut, reduced } from './fx';
import { frame, setBack } from './telegram';

export type RouteName = 'catalog' | 'case' | 'bag' | 'protocol' | 'booked' | 'dossier' | 'lost' | 'admin' | 'editor' | 'gate';
export interface Route { path: string; name: RouteName; params: Record<string, string> }
export type Tab = 'catalog' | 'bag' | 'dossier' | null;

const ROOT: Partial<Record<RouteName, true>> = { catalog: true, bag: true, dossier: true, admin: true };
export const TAB: Record<RouteName, Tab> = { catalog: 'catalog', case: 'catalog', bag: 'bag', protocol: 'bag', booked: 'dossier', dossier: 'dossier', lost: null, admin: null, editor: null, gate: null };
const PARENT: Partial<Record<RouteName, string>> = { case: '#/', protocol: '#/bag', booked: '#/dossier', lost: '#/', editor: '#/admin' };
const CAM: Partial<Record<RouteName, string>> = { catalog: 'CAM_01 · EVIDENCE', bag: 'CAM_02 · PERSONAL PROPERTY', dossier: 'CAM_03 · DOSSIER', admin: 'CAM_00 · CONTROL ROOM' };

export function parse(path: string): Route {
  const clean = path.startsWith('#') ? path : '#/';
  const p = clean.replace(/^#/, '').split('/').filter(Boolean);
  const r = (name: RouteName, params: Record<string, string> = {}): Route => ({ path: clean, name, params });
  if (!p.length) return r('catalog');
  switch (p[0]) {
    case 'case': return r('case', { id: p[1] || '' });
    case 'booked': return r('booked', { no: p[1] || '' });
    case 'admin': return p[1] === 'p' ? r('editor', { id: p[2] || 'new' }) : r('admin', { tab: p[1] || 'products' });
    case 'bag': case 'protocol': case 'dossier': case 'lost': return r(p[0]);
    default: return r('catalog');
  }
}

interface RouterState { route: Route; stack: string[]; lastCase: string | null }
export const useRouter = create<RouterState>(() => ({ route: parse('#/'), stack: ['#/'], lastCase: null }));

const html = document.documentElement;
const stageNames = () => document.querySelectorAll<HTMLElement>('#stage [data-vt]');

export function go(path: string, o: { back?: boolean; replace?: boolean } = {}) {
  const cur = useRouter.getState();
  if (cur.route.path === path && !o.replace) return;
  const next = parse(path);
  const stack = [...cur.stack];
  if (o.back) stack.pop();
  else if (o.replace || ROOT[next.name]) { stack.length = 0; stack.push(path); }
  else stack.push(path);
  const tabSwitch = !o.back && !!ROOT[next.name] && !!ROOT[cur.route.name] && TAB[next.name] !== TAB[cur.route.name];
  const lastCase = next.name === 'case' ? next.params.id : cur.lastCase;
  const commit = () => flushSync(() => useRouter.setState({ route: next, stack, lastCase }));

  // shared element: the catalog photo morphs into the case hero (View Transitions API)
  if (next.name === 'case') document.querySelector<HTMLElement>(`#stage [data-vt="${next.params.id}"]`)?.style.setProperty('view-transition-name', 'hero-photo');
  const vt = (document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }).startViewTransition;
  if (tabSwitch) {
    camcut(CAM[next.name] ?? '');
    commit();
  } else if (vt && !reduced && cur.route.name !== 'gate') {
    html.classList.toggle('vt-back', !!o.back);
    const t = vt.call(document, () => {
      commit();
      if (o.back && next.name === 'catalog' && cur.route.name === 'case') document.querySelector<HTMLElement>(`#stage [data-vt="${cur.route.params.id}"]`)?.style.setProperty('view-transition-name', 'hero-photo');
    });
    t.finished.finally(() => { html.classList.remove('vt-back'); stageNames().forEach((n) => n.style.removeProperty('view-transition-name')); });
  } else {
    commit();
    stageNames().forEach((n) => n.style.removeProperty('view-transition-name'));
  }
  try { history.replaceState(null, '', location.pathname + location.search + path); } catch { /* sandboxed */ }
  if (frame && parent !== window) parent.postMessage({ m8: 'route', path, name: next.name }, '*');
}

export function goBack() {
  const { stack, route } = useRouter.getState();
  if (stack.length > 1) go(stack[stack.length - 2], { back: true });
  else go(PARENT[route.name] || '#/', { back: true, replace: true });
}

/** BackButton visibility follows the stack */
useRouter.subscribe((s) => setBack(s.stack.length > 1 || PARENT[s.route.name] ? goBack : null));
addEventListener('hashchange', () => { if (location.hash.startsWith('#/') && useRouter.getState().route.path !== location.hash) go(location.hash); });
