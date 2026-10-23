// npm run tunnel — the mini app inside the real Telegram bot, straight from this computer (no server, no domain):
//   1) builds web/dist  2) opens a Cloudflare quick tunnel to the API port  3) starts the API + bot with
//   WEBAPP_URL = the tunnel's https address, so the bot's menu button and «Открыть» buttons lead to it.
// The address is new on every start; the bot updates its menu button itself. Stop with Ctrl+C.
// http2 (TCP) instead of QUIC: UDP to Cloudflare is throttled on Russian networks and the tunnel keeps dropping.
import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { run, supervise } from './proc.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = existsSync(resolve(root, '.env')) ? parse(readFileSync(resolve(root, '.env'))) : {};
const PORT = Number(env.PORT || 8080);
const say = (m) => console.log(`\x1b[35m[tunnel]\x1b[0m ${m}`);
const fail = (m) => { console.error(`\x1b[31m[tunnel] ${m}\x1b[0m`); process.exit(1); };

if (!env.BOT_TOKEN) fail('В .env пустой BOT_TOKEN — вставьте токен от @BotFather.');

const portBusy = () => new Promise((ok) => {
  const s = createConnection({ port: PORT, host: '127.0.0.1' }, () => { s.destroy(); ok(true); });
  s.on('error', () => ok(false));
});
if (await portBusy()) fail(`Порт ${PORT} занят — остановите npm run dev (Ctrl+C в его терминале) и запустите снова.`);

const cloudflared = ['cloudflared', 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe', 'C:\\Program Files\\cloudflared\\cloudflared.exe']
  .find((c) => (c.includes('\\') ? existsSync(c) : spawnSync(`${c} --version`, { shell: true, stdio: 'ignore' }).status === 0));
if (!cloudflared) fail('Не найден cloudflared. Установите: winget install Cloudflare.cloudflared');

say('собираю мини-апп (web/dist)…');
if (spawnSync('npm run build -w web', { cwd: root, shell: true, stdio: 'inherit' }).status !== 0) fail('сборка web не удалась');

say('поднимаю туннель Cloudflare…');
let url = '';
const tunnel = run('cf', `"${cloudflared}" tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:${PORT}`, 90, {
  cwd: root,
  quiet: true,
  onOutput: (t) => {
    url ||= (t.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/) || [])[0] || '';
    if (/ERR/.test(t)) process.stdout.write(t);
  },
});
for (let i = 0; i < 60 && !url; i++) await new Promise((r) => setTimeout(r, 500));
if (!url) { tunnel.stop(); fail('туннель не поднялся за 30 секунд — проверьте интернет/VPN и повторите'); }

// the dev login (X-Dev-User, user id 1) must never be reachable from the internet
const admins = (env.ADMIN_IDS || '').split(/[\s,;]+/).filter((x) => x && x !== '1').join(',');
const api = run('api', 'npm run dev -w server', 33, {
  cwd: root,
  env: { WEBAPP_URL: url, PUBLIC_URL: url, SERVE_WEB: '1', DEV_AUTH: '0', MEDIA_PUBLIC_URL: '/media', ADMIN_IDS: admins, BOT_MODE: env.BOT_MODE === 'webhook' ? 'polling' : env.BOT_MODE || 'polling' },
  onOutput: (t) => {
    const bot = (t.match(/bot @(\w+) polling/) || [])[1];
    if (bot) {
      console.log('');
      say('\x1b[1mготово\x1b[0m');
      say(`мини-апп: ${url}`);
      say(`откройте в Telegram @${bot} → /start → «ОТКРЫТЬ ЦЕНТР ОФОРМЛЕНИЯ» (или кнопка «MRAK8» слева от поля ввода)`);
      say(`Control room: /admin в боте${admins ? '' : ' — впишите свой Telegram id в ADMIN_IDS в .env'}`);
      say('адрес меняется при каждом запуске; остановка — Ctrl+C');
      console.log('');
    }
  },
});
supervise([tunnel, api]);
