import Redis from 'ioredis';
import log from './log';

let client: Redis | undefined;

(async () => {
  if (!process.env.RATE_LIMIT_DATABASE_URL) return;

  log.info('[redis-rl] Connecting to Redis');
  client = new Redis(process.env.RATE_LIMIT_DATABASE_URL);
})();

export default client;
