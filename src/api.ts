import express, { type Request, type Response, type NextFunction } from 'express';
import snapshot from '@snapshot-labs/snapshot.js';
import relayer from './helpers/relayer';
import { addOrUpdateSpace } from './helpers/actions';
import { getSpaceENS } from './helpers/ens';
import { updateProposalAndVotes } from './scores';
import typedData from './ingestor';
import { sendError, verifyAuth } from './helpers/utils';
import { flagEntity } from './helpers/moderation';
import log from './helpers/log';
import duplicateRequestPreventor, { cleanup } from './helpers/duplicateRequestPreventor';
import { name, version } from '../package.json';
import { capture } from '@snapshot-labs/snapshot-sentry';

const router = express.Router();
const network = process.env.NETWORK || 'testnet';

const maintenanceMsg = 'update in progress, try later';

router.post(
  '/',
  duplicateRequestPreventor,
  async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.MAINTENANCE) return sendError(res, maintenanceMsg, 503);
    try {
      const result = await typedData(req);
      res.json(result);
    } catch (e) {
      log.warn(`[ingestor] msg validation failed (typed data): ${JSON.stringify(e)}`);
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
    network,
    version: v,
    relayer: relayer.address
  });
});

router.get('/scores/:proposalId', async (req, res) => {
  const { proposalId } = req.params;
  try {
    const result = await updateProposalAndVotes(proposalId);
    return res.json({ result });
  } catch (e) {
    capture(e);
    log.warn(`[api] updateProposalAndVotes() failed ${proposalId}, ${JSON.stringify(e)}`);
    return res.json({ error: 'failed', message: e });
  }
});

router.get('/spaces/:key/poke', async (req, res) => {
  const { key } = req.params;
  try {
    let space = false;
    const result = await getSpaceENS(key);
    if (snapshot.utils.validateSchema(snapshot.schemas.space, result) === true) space = result;
    if (space) {
      await addOrUpdateSpace(key, space);
      // spaces[key] = space;
    }
    return res.json(space);
  } catch (e) {
    capture(e);
    log.warn(`[api] Load space failed ${key}`);
    return res.json(false);
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
