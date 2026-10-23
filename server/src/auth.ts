import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}
export interface InitData { user: TgUser; authDate: number; queryId?: string; startParam?: string; raw: string }

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Validates Telegram.WebApp.initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * secret = HMAC_SHA256(key="WebAppData", msg=bot_token); hash = hex(HMAC_SHA256(key=secret, msg=data_check_string)),
 * data_check_string = all fields except `hash`, sorted by key, "k=v" joined by "\n".
 */
export function validateInitData(raw: string, botToken: string, maxAgeSec = 86400, now = Date.now()): InitData {
  if (!raw) throw new AuthError('initData is empty');
  if (!botToken) throw new AuthError('server has no BOT_TOKEN');
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) throw new AuthError('initData hash is missing');
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(check).digest();
  const got = Buffer.from(hash, 'hex');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) throw new AuthError('initData signature mismatch');
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) throw new AuthError('initData auth_date is missing');
  if (maxAgeSec > 0 && now / 1000 - authDate > maxAgeSec) throw new AuthError('initData is expired');
  let user: TgUser;
  try {
    user = JSON.parse(params.get('user') || 'null');
  } catch {
    throw new AuthError('initData user is malformed');
  }
  if (!user || typeof user.id !== 'number') throw new AuthError('initData has no user');
  return { user, authDate, queryId: params.get('query_id') || undefined, startParam: params.get('start_param') || undefined, raw };
}

/** builds a correctly signed initData string — used by tests and the dev bot-less mode */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const params = new URLSearchParams(fields);
  const check = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}
