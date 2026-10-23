import { mkdirSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Config } from '../config.js';

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(keys: string[]): Promise<void>;
  url(key: string): string;
  /** local driver only: directory served at /media */
  localDir?: string;
}

const CACHE = 'public, max-age=31536000, immutable';

export function createStorage(cfg: Config): Storage {
  if (cfg.STORAGE_DRIVER === 's3') return s3Storage(cfg);
  const root = resolve(cfg.MEDIA_DIR);
  mkdirSync(root, { recursive: true });
  return {
    localDir: root,
    async put(key, body) {
      const file = join(root, key);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    get: (key) => readFile(join(root, key)),
    async remove(keys) {
      await Promise.all(keys.map((k) => rm(join(root, k), { force: true })));
    },
    url: (key) => `${cfg.mediaPublicUrl}/${key}`,
  };
}

function s3Storage(cfg: Config): Storage {
  // lazy import keeps the AWS SDK out of the local/dev path
  let clientP: Promise<{ client: import('@aws-sdk/client-s3').S3Client; sdk: typeof import('@aws-sdk/client-s3') }> | null = null;
  const get = () =>
    (clientP ??= import('@aws-sdk/client-s3').then((sdk) => ({
      sdk,
      client: new sdk.S3Client({
        region: cfg.S3_REGION,
        endpoint: cfg.S3_ENDPOINT || undefined,
        forcePathStyle: cfg.S3_FORCE_PATH_STYLE,
        credentials: { accessKeyId: cfg.S3_ACCESS_KEY_ID, secretAccessKey: cfg.S3_SECRET_ACCESS_KEY },
      }),
    })));
  return {
    async put(key, body, contentType) {
      const { client, sdk } = await get();
      await client.send(new sdk.PutObjectCommand({ Bucket: cfg.S3_BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: CACHE }));
    },
    async get(key) {
      const { client, sdk } = await get();
      const r = await client.send(new sdk.GetObjectCommand({ Bucket: cfg.S3_BUCKET, Key: key }));
      return Buffer.from(await r.Body!.transformToByteArray());
    },
    async remove(keys) {
      if (!keys.length) return;
      const { client, sdk } = await get();
      await client.send(new sdk.DeleteObjectsCommand({ Bucket: cfg.S3_BUCKET, Delete: { Objects: keys.map((Key) => ({ Key })) } }));
    },
    url: (key) => `${cfg.mediaPublicUrl}/${key}`,
  };
}
