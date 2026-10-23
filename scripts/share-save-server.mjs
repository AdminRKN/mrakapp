// one-off helper for web/tools/share-cards.html: receives rendered JPEGs and writes them to web/public/share/
// usage: node scripts/share-save-server.mjs  (then open http://localhost:5173/tools/share-cards.html with the dev servers running)
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../web/public/share');
mkdirSync(out, { recursive: true });
createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
  res.setHeader('access-control-allow-private-network', 'true');
  if (req.method === 'OPTIONS') return res.end();
  const name = new URL(req.url, 'http://x').searchParams.get('name') || '';
  if (req.method !== 'POST' || !/^[a-z0-9-]+\.jpg$/.test(name)) { res.statusCode = 400; return res.end('bad request'); }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    writeFileSync(join(out, name), buf);
    console.log(`saved ${name} (${Math.round(buf.length / 1024)} KB)`);
    res.end('ok');
  });
}).listen(8099, '127.0.0.1', () => console.log('share-save-server on http://127.0.0.1:8099 →', out));
