import type { LabeledPrice } from 'grammy/types';
import type { Config } from '../config.js';
import type { OrderItemRow, OrderRow } from './orders.js';

/**
 * Telegram Payments with a Russian provider (physical goods → not Stars).
 * The provider is switched with PAYMENT_PROVIDER; only the 54-ФЗ receipt format differs between them.
 */
export interface InvoiceParams {
  title: string;
  description: string;
  payload: string;
  currency: 'RUB';
  prices: LabeledPrice[];
  other: {
    provider_data?: string;
    need_phone_number?: boolean;
    send_phone_number_to_provider?: boolean;
    need_email?: boolean;
    send_email_to_provider?: boolean;
    photo_url?: string;
    photo_width?: number;
    photo_height?: number;
  };
}

const money = (rub: number) => rub.toFixed(2);
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** ЮKassa receipt (54-ФЗ) inside provider_data: https://yookassa.ru/developers/payment-acceptance/scenario-extensions/receipts/54fz/parameters-values */
export function yookassaReceipt(cfg: Config, order: OrderRow, items: OrderItemRow[]) {
  const lines = items.map((i) => ({
    description: clip(`${i.title} / ${i.sizeLabel}`, 128),
    quantity: i.qty.toFixed(2),
    amount: { value: money(i.price), currency: 'RUB' },
    vat_code: cfg.RECEIPT_VAT_CODE,
    payment_mode: 'full_payment',
    payment_subject: 'commodity',
  }));
  if (order.deliveryPrice > 0) {
    lines.push({
      description: clip(`Доставка: ${order.deliveryTitle}`, 128),
      quantity: '1.00',
      amount: { value: money(order.deliveryPrice), currency: 'RUB' },
      vat_code: cfg.RECEIPT_VAT_CODE,
      payment_mode: 'full_payment',
      payment_subject: 'service',
    });
  }
  const receipt: Record<string, unknown> = { items: lines };
  if (cfg.RECEIPT_CONTACT === 'phone') receipt.customer = { phone: order.phone.replace(/\D/g, '') };
  if (cfg.RECEIPT_TAX_SYSTEM_CODE) receipt.tax_system_code = cfg.RECEIPT_TAX_SYSTEM_CODE;
  return { receipt };
}

export function buildProviderData(cfg: Config, order: OrderRow, items: OrderItemRow[]): string | undefined {
  switch (cfg.PAYMENT_PROVIDER) {
    case 'yookassa':
      return JSON.stringify(yookassaReceipt(cfg, order, items));
    case 'tbank':
    case 'cloudpayments':
      // TODO: these providers expect their own receipt JSON in provider_data — fill in from the provider's docs
      // (see README → «Сменить провайдера»). Without it the payment still works, the receipt has to be sent by the provider's cabinet.
      return undefined;
    default:
      return undefined;
  }
}

export function buildInvoice(cfg: Config, order: OrderRow, items: OrderItemRow[], photoUrl?: string): InvoiceParams {
  const prices: LabeledPrice[] = items.map((i) => ({ label: clip(`${i.title} / ${i.sizeLabel} ×${i.qty}`, 64), amount: i.price * i.qty * 100 }));
  if (order.deliveryPrice > 0) prices.push({ label: `Доставка · ${order.deliveryTitle}`, amount: order.deliveryPrice * 100 });
  const description = clip(
    `Протокол оформления ${order.no}. ${items.map((i) => `${i.title} / ${i.sizeLabel} ×${i.qty}`).join('; ')}. Этапирование: ${order.deliveryTitle}.`,
    255,
  );
  const providerData = buildProviderData(cfg, order, items);
  const other: InvoiceParams['other'] = {};
  if (providerData) other.provider_data = providerData;
  // the receipt contact goes to the provider straight from Telegram's payment form
  if (cfg.RECEIPT_CONTACT === 'phone') Object.assign(other, { need_phone_number: true, send_phone_number_to_provider: true });
  else Object.assign(other, { need_email: true, send_email_to_provider: true });
  if (photoUrl) Object.assign(other, { photo_url: photoUrl, photo_width: 800, photo_height: 800 });
  return { title: clip(`MRAK8 · CASE #${order.no}`, 32), description, payload: order.payload, currency: 'RUB', prices, other };
}
