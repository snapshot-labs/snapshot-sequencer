import type { Request, Response, NextFunction } from 'express';
import { sha256, sendError } from './utils';
import redisClient from './redis';

const KEYS_PREFIX = process.env.RATE_LIMIT_KEYS_PREFIX || 'snapshot-sequencer:';
export const DUPLICATOR_SET_KEY = `${KEYS_PREFIX}processing-requests`;
export const ERROR_MESSAGE = 'request already being processed';

const hashedBody = (req: Request): string => sha256(JSON.stringify(req.body));

redisClient.on('ready', async () => await redisClient.del(DUPLICATOR_SET_KEY));

export default async function duplicateRequestPreventor(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!redisClient || req.method !== 'POST') {
    return next();
  }

  const value = hashedBody(req);
  const [duplicate] = await redisClient
    .multi()
    .sIsMember(DUPLICATOR_SET_KEY, value)
    .sAdd(DUPLICATOR_SET_KEY, value)
    .exec();

  if (duplicate) {
    return sendError(res, ERROR_MESSAGE, 429);
  }

  res.on('finish', async () => {
    await redisClient.sRem(DUPLICATOR_SET_KEY, value);
  });

  next();
}
