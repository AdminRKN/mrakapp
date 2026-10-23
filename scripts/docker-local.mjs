// npm run docker:local — the whole shop in Docker (Postgres + API + real bot + built mini app + Caddy for https)
// at https://127.0.0.1:8443: Telegram Desktop on this computer opens it from the real bot, no server or domain needed.
// The certificate comes from Caddy's local CA, which Windows has to trust once — this script exports it and checks.
// npm run docker:public — the same plus a localhost.run tunnel: a free public https address, so the bot's button works
// for everyone (the address changes on reconnects, the app follows it).
// The containers keep running after the script exits: npm run docker:local:logs / npm run docker:local:stop
import { X509Certificate } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import https from 'node:https';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { run } from './proc.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = existsSync(resolve(root, '.env')) ? parse(readFileSync(resolve(root, '.env'))) : {};
const PUBLIC = process.argv.includes('--public');
const URL = 'https://127.0.0.1:8443';
const CA_FILE = 'mrak8-local-ca.crt';
const compose = 'docker compose -f docker-compose.local.yml --profile public';
const sh = (cmd, opts = {}) => spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8', ...opts });
const say = (m) => console.log(`\x1b[35m[docker]\x1b[0m ${m}`);
const fail = (m) => { console.error(`\x1b[31m[docker] ${m}\x1b[0m`); process.exit(1); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

if (!env.BOT_TOKEN) fail('В .env пустой BOT_TOKEN — вставьте токен от @BotFather.');
if (!(env.ADMIN_IDS || '').split(/[\s,;]+/).some((x) => x && x !== '1')) fail('В .env нет вашего Telegram id в ADMIN_IDS — только админы видят локальный мини-апп.');
if (sh('docker info', { stdio: 'ignore' }).status !== 0) fail('Docker не отвечает — откройте Docker Desktop и повторите.');

say(PUBLIC ? 'собираю и запускаю контейнеры + туннель в интернет…' : 'собираю и запускаю контейнеры (первый раз — пара минут)…');
// local mode must not leave a tunnel from an earlier docker:public running
if (!PUBLIC) sh(`${compose} rm -sf tunnel`, { stdio: 'ignore' });
// recreate so the logs below start clean and .env changes always apply; a running tunnel is kept, so an update of
// the shop does not change the public address people already have
const tunnelUp = PUBLIC && !!sh(`${compose} ps --status running -q tunnel`).stdout.trim();
if (tunnelUp) say('туннель уже работает — адрес не меняется, обновляю только магазин');
const services = PUBLIC && !tunnelUp ? '' : 'db app https';
const upEnv = { ...process.env, MRAK8_PUBLIC_URL_FILE: PUBLIC ? '/run/tunnel/url' : '' };
if (sh(`${compose} up -d --build --force-recreate ${services}`, { stdio: 'inherit', env: upEnv }).status !== 0) fail('docker compose не запустился — ошибка выше');

say(PUBLIC ? 'жду бота и публичный адрес…' : 'жду бота…');
const fatal = [
  [/Call to 'getMe' failed/, 'Telegram не принял BOT_TOKEN — проверьте токен в .env'],
  [/Network request for 'getMe' failed/, 'бот не достучался до Telegram — проверьте, что Happ включён (или задайте DOCKER_TELEGRAM_PROXY в .env)'],
  [/Conflict: terminated by other getUpdates/,'бот уже запущен в другом месте (npm run dev?) — остановите его и повторите'],
  [/Invalid environment|Missing required env/, 'ошибка в настройках — подробности: npm run docker:local:logs'],
];
const { bot, publicUrl } = await new Promise((ok) => {
  let done = false, bot = '';
  const finish = (res, msg) => { if (done) return; done = true; logs.stop(); if (msg) fail(msg); ok(res); };
  const logs = run('app', `${compose} logs -f --no-log-prefix app`, 33, {
    cwd: root,
    quiet: true,
    onOutput: (t) => {
      for (const [re, msg] of fatal) if (re.test(t)) return finish(null, msg);
      bot ||= (t.match(/bot @(\w+) polling/) || [])[1] || '';
      const publicUrl = (t.match(/public url: (https:\/\/\S+?)"/) || [])[1];
      if (bot && (!PUBLIC || publicUrl)) finish({ bot, publicUrl });
    },
  });
  setTimeout(() => finish(null, PUBLIC
    ? 'бот или туннель не поднялись за 3 минуты — смотрите npm run docker:local:logs и docker compose -f docker-compose.local.yml logs tunnel'
    : 'бот не запустился за 2 минуты — смотрите npm run docker:local:logs'), PUBLIC ? 180_000 : 120_000);
});

console.log('');
if (PUBLIC) {
  say(`\x1b[1mготово — магазин открыт в интернете:\x1b[0m ${publicUrl}`);
  say(`любой человек: @${bot} → кнопка MRAK8 у поля ввода или /start → «ОТКРЫТЬ ЦЕНТР ОФОРМЛЕНИЯ»`);
  say('без VPN у многих в России зарубежный туннель грузится не до конца — провайдеры режут большие файлы');
  say('адрес меняется при переподключении туннеля — кнопка бота обновится сама; кнопки в старых сообщениях перестанут работать');
  say('работает, пока включены этот компьютер и Docker · логи: npm run docker:local:logs · закрыть: npm run docker:local:stop');
  process.exit(0);
}

// Caddy creates its local CA on the first start; export the root so Windows can trust it
let pem = '';
for (let i = 0; i < 30 && !pem; i++, await wait(1000)) {
  if (sh(`${compose} cp https:/data/caddy/pki/authorities/local/root.crt ${CA_FILE}`, { stdio: 'ignore' }).status === 0) pem = readFileSync(resolve(root, CA_FILE), 'utf8');
}
if (!pem) fail('Caddy не выпустил сертификат — смотрите docker compose -f docker-compose.local.yml logs https');
const ok = await new Promise((r) => https.get(`${URL}/api/health`, { ca: pem }, (res) => { res.resume(); r(res.statusCode === 200); }).on('error', () => r(false)));
if (!ok) fail(`${URL} не отвечает — смотрите npm run docker:local:logs`);

const thumb = new X509Certificate(pem).fingerprint.replace(/:/g, '');
const trusted = process.platform !== 'win32' || /True/.test(sh(`powershell -NoProfile -Command "(Test-Path Cert:\\CurrentUser\\Root\\${thumb}) -or (Test-Path Cert:\\LocalMachine\\Root\\${thumb})"`).stdout);

say(`\x1b[1mготово\x1b[0m — мини-апп: ${URL}`);
if (!trusted) {
  say('\x1b[33mодин раз: доверьте компьютеру сертификат магазина — выполните в терминале и нажмите «Да»:\x1b[0m');
  say(`  certutil -user -addstore Root ${CA_FILE}`);
  say('  потом полностью закройте Telegram Desktop (трей → Выход) и откройте снова');
}
say(`Telegram Desktop на этом компьютере: @${bot} → кнопка MRAK8 у поля ввода или /start → «ОТКРЫТЬ ЦЕНТР ОФОРМЛЕНИЯ»`);
say('кнопки мини-аппа видят только ADMIN_IDS; остальные — обычный каталог в чате');
say('логи: npm run docker:local:logs · остановить: npm run docker:local:stop');
process.exit(0);
