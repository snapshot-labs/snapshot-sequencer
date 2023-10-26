import type { Request, Response, NextFunction } from 'express';
import { sha256, sendError } from './utils';
import redisClient from './redis';

const KEYS_PREFIX = process.env.RATE_LIMIT_KEYS_PREFIX || 'snapshot-sequencer:';
const DUPLICATOR_SET_KEY = `${KEYS_PREFIX}processing-requests`;
const hashedBody = (req: Request): string => sha256(JSON.stringify(req.body));

export default async function duplicateRequestPreventor(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!redisClient || req.method !== 'POST') {
    return next();
  }

  const value = hashedBody(req);
  const results = await redisClient
    .multi()
    .sismember(DUPLICATOR_SET_KEY, value)
    .sadd(DUPLICATOR_SET_KEY, value)
    .exec();

  if (results && results[0][1]) {
    return sendError(res, 'request already being processed', 429);
  }

  res.on('finish', async () => {
    await redisClient?.srem(DUPLICATOR_SET_KEY, value);
  });

  next();
}
