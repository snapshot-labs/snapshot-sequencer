import express from 'express';
import relayer from './helpers/relayer';
import { updateProposalAndVotes } from './scores';
import typedData from './ingestor';
import { sendError, verifyAuth } from './helpers/utils';
import { flagEntity } from './helpers/moderation';
import log from './helpers/log';
import { name, version } from '../package.json';
import { capture } from '@snapshot-labs/snapshot-sentry';
import poke from './helpers/poke';
import serve from './helpers/requestDeduplicator';

const router = express.Router();
const SNAPSHOT_ENV = process.env.NETWORK || 'testnet';

const maintenanceMsg = 'update in progress, try later';

router.post('/', async (req, res) => {
  if (process.env.MAINTENANCE) return sendError(res, maintenanceMsg, 503);
  try {
    const result = await typedData(req);
    return res.json(result);
  } catch (e) {
    log.warn(`[ingestor] msg validation failed (typed data): ${JSON.stringify(e)}`);
    return sendError(res, e);
  }
});

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
