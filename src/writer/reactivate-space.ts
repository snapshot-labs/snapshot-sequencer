import { jsonParse } from '../helpers/utils';
import db from '../helpers/mysql';
import { getSpace } from '../helpers/actions';

export function isAuthorized({ space, address }): boolean {
  const admins = (space?.admins || []).map(admin => admin.toLowerCase());
  const mods = (space?.moderators || []).map(mod => mod.toLowerCase());

  return admins.includes(address.toLowerCase()) || mods.includes(address.toLowerCase());
}

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);

  const space = await getSpace(msg.space);
  if (!space) return Promise.reject('unknown space');
  if (!space.hibernated) return Promise.reject('space already active');

  const isAuthorizedToReactivate = isAuthorized({
    space,
    address: body.address
  });
  if (!isAuthorizedToReactivate) return Promise.reject('not authorized to reactivate space');

  return Promise.resolve(space);
}

export async function action(body): Promise<void> {
  const msg = jsonParse(body.msg);

  const query = 'UPDATE space SET hibernated = 0 WßHERE id = ? LIMIT 1';
  const params: any[] = [msg.payload.space];

  await db.queryAsync(query, params);
}
