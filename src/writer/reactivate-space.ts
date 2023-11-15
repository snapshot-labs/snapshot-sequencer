import snapshot from '@snapshot-labs/snapshot.js';
import db from '../helpers/mysql';
import { jsonParse, DEFAULT_NETWORK } from '../helpers/utils';
import { getSpace } from '../helpers/actions';

const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export async function isAuthorized({ space, address }): Promise<boolean> {
  const admins = (space?.admins || []).map(admin => admin.toLowerCase());
  const controller = await snapshot.utils.getSpaceController(space.id, DEFAULT_NETWORK, {
    broviderUrl
  });

  return (
    admins.includes(address.toLowerCase()) || controller?.toLowerCase() === address.toLowerCase()
  );
}

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);

  const space = await getSpace(msg.space);
  if (!space) return Promise.reject('unknown space');
  if (!space.hibernated) return Promise.resolve(space);

  const isAuthorizedToReactivate = await isAuthorized({
    space,
    address: body.address
  });
  if (!isAuthorizedToReactivate) return Promise.reject('not authorized to reactivate space');

  return Promise.resolve(space);
}

export async function action(body): Promise<void> {
  const msg = jsonParse(body.msg);

  const query = 'UPDATE spaces SET hibernated = 0 WHERE id = ? LIMIT 1';
  const params: any[] = [msg.payload.space];

  await db.queryAsync(query, params);
}
