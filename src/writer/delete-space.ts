import snapshot from '@snapshot-labs/snapshot.js';
import db from '../helpers/mysql';
import { getSpace } from '../helpers/actions';
import { jsonParse, DEFAULT_NETWORK } from '../helpers/utils';
import { capture } from '@snapshot-labs/snapshot-sentry';
import log from '../helpers/log';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);

  const space = await getSpace(msg.space);
  if (!space) return Promise.reject('space not found');

  const controller = await snapshot.utils.getSpaceController(msg.space, DEFAULT_NETWORK, {
    broviderUrl
  });
  const isController = controller === body.address;
  if (!isController) return Promise.reject('not allowed');
}

export async function action(body): Promise<void> {
  const msg = jsonParse(body.msg);
  const space = msg.space;

  try {
    const query = `
      UPDATE spaces SET deleted = 1 WHERE id = ? LIMIT 1;
      DELETE FROM leaderboard WHERE space = ?;
    `;

    await db.queryAsync(query, [space, space]);
  } catch (e) {
    capture(e, { space });
    log.warn('[writer] Failed to store settings', space, e);
    return Promise.reject('failed store settings');
  }
}
