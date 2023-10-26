import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { getIp, sendError, sha256 } from './utils';
import log from './log';

let client;

(async () => {
  if (!process.env.RATE_LIMIT_DATABASE_URL) return;

  log.info('[redis-rl] Connecting to Redis');
  client = new Redis(process.env.RATE_LIMIT_DATABASE_URL);
})();

const hashedIp = (req): string => sha256(getIp(req)).slice(0, 7);

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
        sendCommand: (...args: string[]) => client.call(...args)
      })
    : undefined
});
