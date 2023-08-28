import rateLimit from 'express-rate-limit';
import { getIp, sendError } from './utils';
import log from './log';

export default rateLimit({
  windowMs: 60 * 1e3,
  max: 100,
  keyGenerator: req => getIp(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    log.info(`too many requests ${getIp(req).slice(0, 7)}`);
    sendError(res, 'too many requests', 429);
  }
});
