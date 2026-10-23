// loads .env from the server folder or the repo root (whichever exists); real env vars win
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

for (const p of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')]) {
  if (existsSync(p)) config({ path: p, quiet: true });
}
