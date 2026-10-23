/* Public address from a tunnel (docker-compose.local.yml, profile "public"): the tunnel container writes its current
   https address to PUBLIC_URL_FILE. Free tunnels change the address on every reconnect, so the file is followed:
   once a new address answers, the mini app links and the bot's menu button move to it. */
import { readFile } from 'node:fs/promises';
import type { Bot } from 'grammy';
import { setPublicUrl } from './config.js';
import { setupBot, type BotDeps } from './bot/index.js';

export function followPublicUrl(deps: BotDeps, bot: Bot | null, mode: 'webhook' | 'polling') {
  const { cfg, log } = deps;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const url = (await readFile(cfg.PUBLIC_URL_FILE, 'utf8').catch(() => '')).trim().replace(/\/$/, '');
      if (!/^https:\/\//.test(url) || url === cfg.WEBAPP_URL.replace(/\/$/, '')) return;
      // a tunnel that is still connecting (or a file left by an old session) must not take the bot's button
      const ok = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(10_000) }).then((r) => r.ok, () => false);
      if (!ok) return;
      setPublicUrl(cfg, url);
      log.info(`public url: ${url}`);
      if (bot) await setupBot(deps, bot, mode);
    } catch (e) {
      log.warn({ err: e }, 'public url update failed');
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void tick(), 3000);
  void tick();
  return () => clearInterval(timer);
}
