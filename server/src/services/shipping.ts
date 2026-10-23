/* СДЭК around an order: price the subject's choice before the order exists, hand the paid order to CDEK,
   follow its number and statuses afterwards (polling — no public webhook address needed). */
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import type { CdekChoice, CdekShipment } from '@mrak8/shared';
import type { DB } from '../db/index.js';
import { orderItems, orders } from '../db/schema.js';
import { cdekStage, choiceTitle, type Cdek } from './cdek.js';
import { OrderError, type OrderItemRow, type OrderRow, type PricedDelivery } from './orders.js';

type Log = { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void };

/** the server's own price for what the subject picked: the client never sends a delivery price */
export async function priceCdek(cdek: Cdek, choice: CdekChoice, doorAddress: string, qty: number): Promise<PricedDelivery> {
  let address: string, pvzAddress: string | undefined;
  if (choice.mode === 'pvz') {
    const point = (await cdek.points(choice.cityCode)).find((p) => p.code === choice.pvzCode);
    if (!point) throw new OrderError('NO_PVZ', 'Выберите пункт выдачи СДЭК', 400);
    pvzAddress = point.address;
    address = `${choice.city}, ПВЗ ${point.code}: ${point.address}`;
  } else {
    if (doorAddress.trim().length < 6) throw new OrderError('NO_ADDRESS', 'Укажите улицу, дом и квартиру', 400);
    address = `${choice.city}, ${doorAddress.trim()}`;
  }
  const q = await cdek.quote(choice.cityCode, choice.mode, qty);
  return { title: choiceTitle(choice), price: q.price, address, cdek: { ...choice, pvzAddress } };
}

const saveCdek = (db: DB, id: number, cdek: CdekShipment, extra: Partial<typeof orders.$inferInsert> = {}) =>
  db.update(orders).set({ cdek, ...extra, updatedAt: new Date() }).where(eq(orders.id, id)).returning();

/** a paid order goes to CDEK; a failure is kept on the order so the Control room can retry */
export async function registerShipment(db: DB, cdek: Cdek, log: Log, order: OrderRow, items?: OrderItemRow[]) {
  if (!order.cdek || order.cdek.uuid) return order;
  const list = items ?? (await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)));
  try {
    const { uuid } = await cdek.createShipment(order, list);
    log.info({ no: order.no, uuid }, 'cdek shipment created');
    return (await saveCdek(db, order.id, { ...order.cdek, uuid, error: undefined }))[0];
  } catch (e) {
    log.warn({ err: e, no: order.no }, 'cdek shipment failed');
    return (await saveCdek(db, order.id, { ...order.cdek, error: (e as Error).message }))[0];
  }
}

/**
 * every few minutes: the CDEK number becomes the track number; «accepted by CDEK» ships the order, «at the pickup
 * point» and «delivered» are told to the subject. `notify` is the bot's message to the subject.
 */
export async function syncShipments(db: DB, cdek: Cdek, log: Log, notify: (o: OrderRow, note?: string) => Promise<void>) {
  const list = await db.select().from(orders).where(and(inArray(orders.status, ['paid', 'assembled', 'shipped']), isNotNull(orders.cdek)));
  for (const o of list) {
    if (!o.cdek?.uuid) continue;
    try {
      const s = await cdek.shipment(o.cdek.uuid);
      const prev = o.cdek;
      if (s.number === prev.number && s.status === prev.status && s.error === prev.error) continue;
      const stage = cdekStage(s.status);
      const status = stage === 'delivered' ? 'delivered' : stage === 'waiting' ? o.status : 'shipped';
      const [u] = await saveCdek(db, o.id, { ...prev, number: s.number ?? prev.number, status: s.status, statusName: s.statusName, error: s.error }, {
        ...(s.number && !o.trackNo ? { trackNo: s.number } : {}),
        status,
      });
      const arrived = stage === 'at_point' && prev.status !== s.status;
      if (status !== o.status || arrived) await notify(u, arrived ? 'Посылка ждёт вас в пункте выдачи СДЭК. Возьмите паспорт.' : undefined);
    } catch (e) {
      log.warn({ err: e, no: o.no }, 'cdek status check failed');
    }
  }
}
