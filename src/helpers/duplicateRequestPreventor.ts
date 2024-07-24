import type { NextFunction, Request, Response } from 'express';
import { sendError } from './utils';

export const ERROR_MESSAGE = 'request already being processed';
export const queue: Set<string> = new Set();
const hashedBody = (req: Request): string => JSON.stringify(req.body?.sig || {});

export default async function duplicateRequestPreventor(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const value = hashedBody(req);

  if (queue.has(value)) return sendError(res, ERROR_MESSAGE, 425);

  queue.add(value);
  next();
}

export async function cleanup(req: Request, res: Response, next: NextFunction) {
  queue.delete(hashedBody(req));
  next();
}
