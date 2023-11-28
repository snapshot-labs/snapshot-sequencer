import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from './redis';
import { getIp, sendError, sha256 } from './utils';

const hashedIp = (req): string => sha256(getIp(req)).slice(0, 7);

function getStore() {
  return redisClient
    ? new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix: process.env.RATE_LIMIT_KEYS_PREFIX || 'snapshot-sequencer:'
      })
    : undefined;
}

const rateLimitConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(
      res,
      'too many requests, refer to https://docs.snapshot.org/tools/api/api-keys#limits',
      429
    );
  }
};

const highErroredRateLimit = rateLimit({
  keyGenerator: req => `rl-s:${hashedIp(req)}`,
  windowMs: 15 * 1e3,
  max: 15,
  skipSuccessfulRequests: true,
  store: getStore(),
  ...rateLimitConfig
});
const regularRateLimit = rateLimit({
  keyGenerator: req => `rl:${hashedIp(req)}`,
  windowMs: 60 * 1e3,
  max: 100,
  store: getStore(),
  ...rateLimitConfig
});

export { regularRateLimit, highErroredRateLimit };
