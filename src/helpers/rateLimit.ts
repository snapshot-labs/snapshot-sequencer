import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import type { Request, Response, NextFunction } from 'express';
import { getIp, sendError, sha256 } from './utils';
import log from './log';

let client;
const KEYS_PREFIX = process.env.RATE_LIMIT_KEYS_PREFIX || 'snapshot-sequencer:';
const DUPLICATOR_SET_KEY = `${KEYS_PREFIX}processing-requests`;

(async () => {
  if (!process.env.RATE_LIMIT_DATABASE_URL) return;

  log.info(`[redis-rl] Connecting to Redis ${process.env.RATE_LIMIT_DATABASE_URL}`);
  client = createClient({ url: process.env.RATE_LIMIT_DATABASE_URL });
  client.on('connect', () => {
    log.info('[redis-rl] Redis connect');
    client.DEL(DUPLICATOR_SET_KEY);
  });
  client.on('ready', () => log.info('[redis-rl] Redis ready'));
  client.on('reconnecting', err => log.info('[redis-rl] Redis reconnecting', err));
  client.on('error', err => log.info('[redis-rl] Redis error', err));
  client.on('end', err => log.info('[redis-rl] Redis end', err));
  await client.connect();
})();

const hashedIp = (req): string => sha256(getIp(req)).slice(0, 7);
const hashedBody = (req): string => sha256(JSON.stringify(req.body));

export default rateLimit({
  windowMs: 60 * 1e3,
  max: 100,
  keyGenerator: req => hashedIp(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    log.info(`too many requests ${hashedIp(req)}`);
    sendError(
      res,
      'too many requests, refer to https://docs.snapshot.org/tools/api/api-keys#limits',
      429
    );
  },
  store: client
    ? new RedisStore({
        sendCommand: (...args: string[]) => client.sendCommand(args),
        prefix: KEYS_PREFIX
      })
    : undefined
});

export async function duplicateRequestLimit(req: Request, res: Response, next: NextFunction) {
  if (!client || req.method !== 'POST') {
    return next();
  }

  const value = hashedBody(req);
  const [duplicate] = await client
    .multi()
    .SISMEMBER(DUPLICATOR_SET_KEY, value)
    .SADD(DUPLICATOR_SET_KEY, value)
    .exec();

  if (duplicate) {
    return sendError(res, 'request already being processed', 429);
  }

  res.on('finish', async () => {
    await client.SREM(DUPLICATOR_SET_KEY, value);
  });

  next();
}
