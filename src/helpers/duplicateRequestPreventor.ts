import type { Request, Response, NextFunction } from 'express';
import { sendError } from './utils';
import redisClient from './redis';

const KEYS_PREFIX = process.env.RATE_LIMIT_KEYS_PREFIX || 'snapshot-sequencer:';
export const DUPLICATOR_SET_KEY = `${KEYS_PREFIX}processing-requests`;
export const ERROR_MESSAGE = 'request already being processed';

const hashedBody = (req: Request): string => JSON.stringify(req.body?.sig || {});

redisClient.on('ready', async () => await redisClient.del(DUPLICATOR_SET_KEY));

export default async function duplicateRequestPreventor(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!redisClient || req.method !== 'POST' || !req.body) {
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

  next();
}

export async function cleanup(req: Request, res: Response, next: NextFunction) {
  await redisClient.sRem(DUPLICATOR_SET_KEY, hashedBody(req));
  next();
}