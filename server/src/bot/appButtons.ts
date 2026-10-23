/* Buttons into the mini app carry its address. A free tunnel changes the address on every reconnect, and every
   button already sent then opens a dead page («no tunnel»). So each bot message with such buttons is remembered,
   and after a move the bot re-points them all to the new address. */
import { and, eq, lt } from 'drizzle-orm';
import { GrammyError, type Bot } from 'grammy';
import type { Config } from '../config.js';
import type { DB } from '../db/index.js';
import { appButtons } from '../db/schema.js';

const TRACKED = new Set(['sendMessage', 'sendPhoto', 'editMessageText', 'editMessageCaption', 'editMessageReplyMarkup']);
const KEEP_DAYS = 30;
const baseOf = (cfg: Config) => cfg.WEBAPP_URL.replace(/\/$/, '');
const opensApp = (markup: unknown, base: string) => !!markup && JSON.stringify(markup).includes(`"url":"${base}`);

/** remembers every sent or edited message whose buttons open the mini app at the current address */
export function trackAppButtons(bot: Bot, cfg: Config, db: DB) {
  bot.api.config.use(async (prev, method, payload, signal) => {
    const res = await prev(method, payload, signal);
    if (!res.ok || !TRACKED.has(method)) return res;
    const base = baseOf(cfg);
    const markup = (payload as { reply_markup?: unknown }).reply_markup;
    const msg = res.result as { message_id?: number; chat?: { id: number } };
    if (msg?.message_id && msg.chat && opensApp(markup, base)) {
      const row = { chatId: msg.chat.id, messageId: msg.message_id, base, markup: JSON.parse(JSON.stringify(markup)) };
      void db.insert(appButtons).values(row).onConflictDoUpdate({ target: [appButtons.chatId, appButtons.messageId], set: { base, markup: row.markup } }).catch(() => {});
    }
    return res;
  });
}

/** after a move: the buttons of every remembered message are rewritten to the current address */
export async function repointAppButtons(bot: Bot, cfg: Config, db: DB, log: { info: (...a: unknown[]) => void }) {
  const base = baseOf(cfg);
  await db.delete(appButtons).where(lt(appButtons.createdAt, new Date(Date.now() - KEEP_DAYS * 86_400_000)));
  const rows = (await db.select().from(appButtons)).filter((r) => r.base !== base);
  let moved = 0;
  for (const r of rows) {
    const markup = JSON.parse(JSON.stringify(r.markup).split(`"url":"${r.base}`).join(`"url":"${base}`));
    try {
      await bot.api.editMessageReplyMarkup(r.chatId, r.messageId, { reply_markup: markup }); // the tracker stores the new base
      moved++;
    } catch (e) {
      // the subject deleted the message or the chat: nothing to re-point any more
      if (e instanceof GrammyError && /not found|can't be edited|blocked|deactivated/i.test(e.description)) {
        await db.delete(appButtons).where(and(eq(appButtons.chatId, r.chatId), eq(appButtons.messageId, r.messageId)));
      }
    }
    await new Promise((ok) => setTimeout(ok, 40)); // well under Telegram's limits
  }
  if (rows.length) log.info(`mini app buttons re-pointed: ${moved}/${rows.length}`);
}
