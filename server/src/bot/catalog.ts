/* Catalog right in the chat: list with prices → card with photo and sizes → checkout.
   Works without the mini app too (e.g. before the https domain exists, or for payment-provider moderation). */
import { InlineKeyboard, InputFile, type Bot } from 'grammy';
import { CATEGORY_LABEL, formatRub, subjectNo, type ApiProduct } from '@mrak8/shared';
import { and, eq } from 'drizzle-orm';
import { orders, productImages } from '../db/schema.js';
import { listDelivery, listProducts } from '../services/catalog.js';
import { jpegForTelegram } from '../services/media.js';
import { canOpenWebApp } from '../config.js';
import type { BotDeps } from './index.js';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function registerChatCatalog(bot: Bot, deps: BotDeps) {
  const { cfg, db, storage } = deps;
  const webApp = (userId?: number) => canOpenWebApp(cfg, userId);
  const appUrl = (q = '') => cfg.WEBAPP_URL.replace(/\/$/, '') + '/' + q;
  const forSale = (p: ApiProduct) => p.status === 'live' && p.sizes.some((s) => s.available > 0);

  const menu = async (userId: number) => {
    const list = (await listProducts(db, storage)).filter((p) => p.status !== 'archive');
    const lines = list.map((p) => `▪️ <b>${esc(p.title)}</b> — ${formatRub(p.price)}${p.status === 'drop' ? ' · дроп скоро' : forSale(p) ? '' : ' · sold out'}`);
    const kb = new InlineKeyboard();
    for (const p of list) kb.text(`${forSale(p) ? '🛒' : p.status === 'drop' ? '⏳' : '✖️'} #${p.no} ${p.name || p.title} — ${formatRub(p.price)}`, `p:${p.id}`).row();
    if (webApp(userId)) kb.webApp('🟥 ОТКРЫТЬ ЦЕНТР ОФОРМЛЕНИЯ', appUrl()).row();
    kb.text('📦 Доставка и оплата', 'info:delivery').text('ℹ️ О магазине', 'info:about');
    const text = [
      '<b>MRAK8 · CENTRAL BOOKING &amp; INTAKE CENTER</b>',
      `SUBJECT <code>#${subjectNo(userId)}</code> поставлен на учёт.`,
      '',
      '<b>Вещдоки в наличии:</b>',
      ...lines,
      '',
      'Выберите вещь — покажу фото, размеры и оформлю протокол.',
    ].join('\n');
    return { text, kb };
  };

  bot.command(['start', 'catalog'], async (c) => {
    const arg = (c.match || '').trim();
    if (arg.startsWith('product_')) return showProduct(c.chat.id, Number(arg.slice(8)));
    // t.me/<bot>?start=order_<no> (receipt QR, «Я оформлен»): the owner gets a button straight into the case
    if (arg.startsWith('order_')) {
      const [o] = await db.select({ no: orders.no, userId: orders.userId }).from(orders).where(eq(orders.no, arg.slice(6)));
      if (o && o.userId === c.from!.id && webApp(c.from!.id)) {
        return c.reply(`<b>CASE #${esc(o.no!)}</b>\nДело открыто — протокол, квитанция и статус этапирования.`, { parse_mode: 'HTML', reply_markup: new InlineKeyboard().webApp('ОТКРЫТЬ ДЕЛО', appUrl(`?startapp=order_${o.no}`)) });
      }
    }
    const { text, kb } = await menu(c.from!.id);
    await c.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  const showProduct = async (chatId: number, id: number) => {
    const [p] = await listProducts(db, storage, { ids: [id] });
    if (!p) return bot.api.sendMessage(chatId, 'Вещдок не найден.');
    const sizes = p.sizes.map((s) => `${s.label}${s.heightMin ? ` (рост ${s.heightMin}–${s.heightMax})` : ''}${s.available ? '' : ' — нет'}`).join(', ');
    const caption = [
      `<b>ДЕЛО #${p.no} · ${esc(p.title)}</b>`,
      `${CATEGORY_LABEL[p.category]} · ${esc(p.color)}${p.batch ? ` · партия ${esc(p.batch)}` : ''}`,
      '',
      `Цена: <b>${formatRub(p.price)}</b>${p.oldPrice ? ` <s>${formatRub(p.oldPrice)}</s>` : ''}`,
      `Размеры: ${sizes}`,
      ...p.proto.slice(0, 5).map((r) => `${esc(r.k.charAt(0) + r.k.slice(1).toLowerCase())}: ${esc(r.v)}`),
    ].join('\n');
    const kb = new InlineKeyboard();
    if (forSale(p)) {
      p.sizes.filter((s) => s.available > 0).forEach((s, i) => { kb.text(s.label, `s:${p.id}:${s.label}`); if (i % 4 === 3) kb.row(); });
      kb.row();
    }
    if (webApp(chatId)) kb.webApp('🟥 РОСТОМЕР И ФОТО В МИНИ-АППЕ', appUrl(`?startapp=product_${p.id}`)).row();
    kb.text('← Ко всем вещдокам', 'menu');
    const [img] = await db.select().from(productImages).where(and(eq(productImages.productId, p.id), eq(productImages.slot, 'front')));
    if (img) {
      const jpg = await jpegForTelegram(storage, img.key, img.widths, 1200);
      return bot.api.sendPhoto(chatId, new InputFile(jpg, `mrak8-${p.no}.jpg`), { caption, parse_mode: 'HTML', reply_markup: kb });
    }
    return bot.api.sendMessage(chatId, caption, { parse_mode: 'HTML', reply_markup: kb });
  };

  bot.callbackQuery('menu', async (c) => {
    await c.answerCallbackQuery();
    const { text, kb } = await menu(c.from.id);
    await c.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.callbackQuery(/^p:(\d+)$/, async (c) => {
    await c.answerCallbackQuery();
    await showProduct(c.chat!.id, Number(c.match[1]));
  });

  bot.callbackQuery(/^s:(\d+):([\w-]+)$/, async (c) => {
    const [p] = await listProducts(db, storage, { ids: [Number(c.match[1])] });
    const size = c.match[2];
    if (!p || !p.sizes.find((s) => s.label === size && s.available > 0)) return c.answerCallbackQuery({ text: 'Размер изъят другим субъектом', show_alert: true });
    await c.answerCallbackQuery();
    const delivery = await listDelivery(db);
    const kb = new InlineKeyboard();
    if (webApp(c.from.id)) kb.webApp(`💳 ОФОРМИТЬ И ОПЛАТИТЬ — ${formatRub(p.price)}`, appUrl(`?startapp=product_${p.id}`)).row();
    else kb.text(`💳 ОФОРМИТЬ И ОПЛАТИТЬ — ${formatRub(p.price)}`, 'info:soon').row();
    kb.text('← Назад к вещдоку', `p:${p.id}`);
    await c.reply(
      [
        `<b>ПРОТОКОЛ ИЗЪЯТИЯ</b>`,
        `${esc(p.title)} / размер ${esc(size)} × 1 — <b>${formatRub(p.price)}</b>`,
        '',
        'Доставка:',
        ...delivery.map((d) => `▪️ ${esc(d.title)} (${esc(d.subtitle)}) — ${formatRub(d.price)}`),
        '',
        'Нажмите «Оформить и оплатить»: укажете ФИО, телефон и адрес, оплата картой через ЮKassa прямо в Telegram. Чек по 54-ФЗ придёт на телефон.',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: kb },
    );
  });

  bot.callbackQuery(/^info:(\w+)$/, async (c) => {
    const k = c.match[1];
    if (k === 'soon') return c.answerCallbackQuery({ text: 'Оформление откроется в мини-приложении', show_alert: true });
    await c.answerCallbackQuery();
    if (k === 'delivery') {
      const delivery = await listDelivery(db);
      await c.reply(
        ['<b>ДОСТАВКА И ОПЛАТА</b>', ...delivery.map((d) => `▪️ ${esc(d.title)} — ${esc(d.subtitle)}, ${formatRub(d.price)}`), '', 'Оплата банковской картой через ЮKassa в Telegram. Отправка 1–3 рабочих дня после оплаты, трек-номер пришлю сюда. Возврат — 7 дней после получения, если вещь не носили.'].join('\n'),
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('← Ко всем вещдокам', 'menu') },
      );
    } else {
      await c.reply(
        [
          '<b>MRAK8 — НЕ ДИЗАЙНЕР</b>',
          'Streetwear-бренд, цифровой шоурум и магазин. Малые партии, ручная проверка каждой вещи.',
          '',
          ...(/^https:\/\//.test(cfg.WEBAPP_URL) ? [`Оферта: ${cfg.WEBAPP_URL.replace(/\/$/, '')}/offer.html`] : []), // a localhost link must not reach customers
          // a bare @mrak8.merch is a Telegram mention of «@mrak8» (usernames have no dots) — link the profile itself
          'Instagram: <a href="https://www.instagram.com/mrak8.merch/">@mrak8.merch</a>',
        ].join('\n'),
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: new InlineKeyboard().text('← Ко всем вещдокам', 'menu') },
      );
    }
  });
}
