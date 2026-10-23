import { create } from 'zustand';
import type { ApiBootstrap, ApiOrder, ApiProduct } from '@mrak8/shared';
import { cloud } from './telegram';

export interface CartLine { productId: number; size: string; qty: number }
export interface Toast { id: number; text: string; action?: string; onAction?: () => void }
export type View = 'feed' | 'files';

interface State {
  boot: ApiBootstrap | null;
  bootError: string | null;
  cart: CartLine[];
  height: number | null;
  view: View;
  filter: string;
  visits: number;
  restored: boolean;
  lastOrder: ApiOrder | null;
  orders: ApiOrder[] | null;
  toasts: Toast[];
}

export const useStore = create<State>(() => ({
  boot: null,
  bootError: null,
  cart: [],
  height: null,
  view: 'feed',
  filter: 'all',
  visits: 0,
  restored: false,
  lastOrder: null,
  orders: null,
  toasts: [],
}));
export const S = () => useStore.getState();
export const set = useStore.setState;

/* persistence: cart + profile live in Telegram CloudStorage (survive restarts and device switches) */
let t = 0;
useStore.subscribe((s, prev) => {
  if (!s.restored) return;
  if (s.cart === prev.cart && s.height === prev.height && s.view === prev.view && s.visits === prev.visits) return;
  clearTimeout(t);
  t = window.setTimeout(() => {
    void cloud.set('cart', JSON.stringify(s.cart));
    void cloud.set('profile', JSON.stringify({ height: s.height, view: s.view, visits: s.visits }));
  }, 250);
});
export async function restore() {
  if (new URLSearchParams(location.search).get('fresh') === '1') { set({ restored: true }); return; }
  const [cart, profile] = await Promise.all([cloud.get('cart'), cloud.get('profile')]);
  const patch: Partial<State> = { restored: true };
  try { if (cart) patch.cart = JSON.parse(cart); } catch { /* corrupt */ }
  try { if (profile) Object.assign(patch, JSON.parse(profile)); } catch { /* corrupt */ }
  set(patch);
}

/* selectors */
export const productById = (id: number): ApiProduct | undefined => S().boot?.products.find((p) => p.id === id);
export const sizeOf = (p: ApiProduct, label: string) => p.sizes.find((s) => s.label === label);
export const cartCount = (c: CartLine[]) => c.reduce((a, l) => a + l.qty, 0);
export const cartTotal = (c: CartLine[]) => c.reduce((a, l) => a + (productById(l.productId)?.price ?? 0) * l.qty, 0);
export const stockOf = (p: ApiProduct) => p.sizes.reduce((a, s) => a + s.available, 0);

/* toasts */
let tid = 0;
export function toast(text: string, opts: { action?: string; onAction?: () => void; ms?: number } = {}) {
  const id = ++tid;
  set((s) => ({ toasts: [...s.toasts, { id, text, action: opts.action, onAction: opts.onAction }] }));
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), opts.ms ?? 2600);
}
