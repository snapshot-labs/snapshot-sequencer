import { capture } from '@snapshot-labs/snapshot-sentry';
import express, { NextFunction, Request, Response } from 'express';
import duplicateRequestPreventor, { cleanup } from './helpers/duplicateRequestPreventor';
import log from './helpers/log';
import { flagEntity } from './helpers/moderation';
import poke from './helpers/poke';
import relayer from './helpers/relayer';
import serve from './helpers/requestDeduplicator';
import { sendError, verifyAuth } from './helpers/utils';
import typedData from './ingestor';
import { updateProposalAndVotes } from './scores';
import { name, version } from '../package.json';

const router = express.Router();
const SNAPSHOT_ENV = process.env.NETWORK || 'testnet';

const maintenanceMsg = 'update in progress, try later';

router.post(
  '/',
  duplicateRequestPreventor,
  async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.MAINTENANCE) return sendError(res, maintenanceMsg, 503);
    try {
      const result = await typedData(req);
      res.json(result);
    } catch (e: any) {
      const errorMessage = typeof e === 'object' ? e.message || JSON.stringify(e) : String(e);
      log.warn(`[ingestor] msg validation failed (typed data): ${errorMessage}`);
      sendError(res, e);
    }

    next();
  },
  cleanup
);

router.get('/', (req, res) => {
  const commit = process.env.COMMIT_HASH || '';
  const v = commit ? `${version}#${commit.substr(0, 7)}` : version;
  return res.json({
    name,
    SNAPSHOT_ENV,
    version: v,
    relayer: relayer.address
  });
});

router.get('/scores/:proposalId', async (req, res) => {
  const { proposalId } = req.params;
  try {
    const result = await serve(proposalId, updateProposalAndVotes, [proposalId]);
    return res.json({ result });
  } catch (e) {
    capture(e);
    log.warn(`[api] updateProposalAndVotes() failed ${proposalId}, ${JSON.stringify(e)}`);
    return res.json({ error: 'failed', message: e });
  }
});

router.get('/spaces/:key/poke', async (req, res) => {
  try {
    return res.json(await poke(req.params.key));
  } catch (e: any) {
    return res.json({ error: e });
  }
});

router.post('/flag', verifyAuth, async (req, res) => {
  const { type, value, action } = req.body;

  try {
    const resp = await flagEntity({ type, value, action });
    return res.json({ success: !!resp.affectedRows });
  } catch (e: any) {
    console.log(e);
    return sendError(res, e.message || 'failed');
  }
});

export default router;
