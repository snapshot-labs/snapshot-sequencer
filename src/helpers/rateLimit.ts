import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getIp, sendError, sha256 } from './utils';
import redisClient from './redis';
import log from './log';

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
  store: redisClient
    ? new RedisStore({
        // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
        sendCommand: (...args: string[]) => redisClient?.call(...args),
        prefix: process.env.RATE_LIMIT_KEYS_PREFIX
      })
    : undefined
});
