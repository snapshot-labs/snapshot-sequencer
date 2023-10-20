import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import type { Request, Response, NextFunction } from 'express';
import { getIp, sendError, sha256 } from './utils';
import log from './log';

let client;

(async () => {
  if (!process.env.RATE_LIMIT_DATABASE_URL) return;

  log.info('[redis-rl] Connecting to Redis');
  client = createClient({ url: process.env.RATE_LIMIT_DATABASE_URL });
  client.on('connect', () => log.info('[redis-rl] Redis connect'));
  client.on('ready', () => log.info('[redis-rl] Redis ready'));
  client.on('reconnecting', err => log.info('[redis-rl] Redis reconnecting', err));
  client.on('error', err => log.info('[redis-rl] Redis error', err));
  client.on('end', err => log.info('[redis-rl] Redis end', err));
  await client.connect();
})();

const hashedIp = (req): string => sha256(getIp(req)).slice(0, 7);
const hashedBody = (req): string => sha256(req.body);

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
        prefix: 'snapshot-sequencer:'
      })
    : undefined
});

export async function duplicateRequestLimit(req: Request, res: Response, next: NextFunction) {
  const key = 'snapshot-sequencer:processing-requests';
  const value = hashedBody(req);
  const duplicate = await client.SISMEMBER(key, value);

  if (duplicate) {
    return sendError(res, 'request already being processed', 429);
  }

  await client.SADD(key, value);

  res.on('finish', async () => {
    await client.SREM(key, value);
  });

  next();
}
