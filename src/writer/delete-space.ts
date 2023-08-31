import snapshot from '@snapshot-labs/snapshot.js';
import {
  getSpace,
  markSpaceAsDeleted,
  refreshProposalsCount,
  refreshVotesCount
} from '../helpers/actions';
import { jsonParse, DEFAULT_NETWORK } from '../helpers/utils';
import { capture } from '@snapshot-labs/snapshot-sentry';
import log from '../helpers/log';

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);

  const space = await getSpace(msg.space);
  if (!space) return Promise.reject('space not found');

  const controller = await snapshot.utils.getSpaceController(msg.space, DEFAULT_NETWORK);
  const isController = controller === body.address;
  if (!isController) return Promise.reject('not allowed');
}

export async function action(body): Promise<void> {
  const msg = jsonParse(body.msg);
  const space = msg.space;

  try {
    await markSpaceAsDeleted(space);
    await refreshProposalsCount([space]);
    await refreshVotesCount([space]);
  } catch (e) {
    capture(e, { context: { space } });
    log.error('[writer] Failed to store settings', space, e);
    return Promise.reject('failed store settings');
  }
}
