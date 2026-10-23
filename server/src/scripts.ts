/* npm run db:migrate | db:seed [-- --demo] | bot:setup */
import './env.js';
import { loadConfig } from './config.js';
import { migrateDatabase, openDatabase } from './db/index.js';
import { seed } from './db/seed.js';
import { createStorage } from './services/storage.js';
import { createBot, setupBot } from './bot/index.js';

const cmd = process.argv[2];
const cfg = loadConfig();
const database = await openDatabase(cfg.DATABASE_URL, cfg.PGLITE_DIR);
try {
  if (cmd === 'migrate' || cmd === 'seed') {
    await migrateDatabase(database);
    console.log('migrations applied');
  }
  if (cmd === 'seed') {
    const created = await seed(database.db, createStorage(cfg), { demo: process.argv.includes('--demo'), log: console.log });
    console.log(created ? 'seeded' : 'products already exist — nothing to seed');
  }
  if (cmd === 'bot-setup') {
    if (!cfg.BOT_TOKEN) throw new Error('BOT_TOKEN is empty');
    const bot = createBot({ cfg, db: database.db, storage: createStorage(cfg), log: console });
    await bot.init();
    const mode = process.argv.includes('--polling') ? 'polling' : 'webhook';
    await setupBot({ cfg, db: database.db, storage: createStorage(cfg), log: console }, bot, mode);
    console.log(`@${bot.botInfo.username}: commands, menu button${mode === 'webhook' ? ', webhook' : ''} configured`);
  }
} finally {
  await database.close();
}
