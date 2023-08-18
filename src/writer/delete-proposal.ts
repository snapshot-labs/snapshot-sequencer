import { getProposal, getSpace } from '../helpers/actions';
import { jsonParse } from '../helpers/utils';
import db from '../helpers/mysql';

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);
  const proposal = await getProposal(msg.space, msg.payload.proposal);
  if (!proposal) return Promise.reject('unknown proposal');

  const space = await getSpace(msg.space);
  const admins = (space?.admins || []).map(admin => admin.toLowerCase());
  const mods = (space?.moderators || []).map(mod => mod.toLowerCase());
  if (
    !admins.includes(body.address.toLowerCase()) &&
    !mods.includes(body.address.toLowerCase()) &&
    proposal.author !== body.address
  )
    return Promise.reject('not authorized to archive proposal');
}

export async function action(body): Promise<void> {
  const msg = jsonParse(body.msg);
  const id = msg.payload.proposal;

  const query = `
  DELETE FROM proposals WHERE id = ? LIMIT 1;
  DELETE FROM votes WHERE proposal = ?;
  `;
  await db.queryAsync(query, [id, id]);
}
