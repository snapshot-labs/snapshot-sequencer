import {
  decrementProposalsCount,
  getProposal,
  getSpace,
  refreshVotesCount
} from '../helpers/actions';
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
  const proposal = await getProposal(msg.space, msg.payload.proposal);
  const id = msg.payload.proposal;

  const proposalDeleteResult = await db.queryAsync('DELETE FROM proposals WHERE id = ? LIMIT 1', [
    id
  ]);

  if (proposalDeleteResult.affectedRows > 0) {
    const voteDeleteResult = await db.queryAsync('DELETE FROM votes WHERE proposal = ?', [id]);
    await decrementProposalsCount(msg.space, proposal.author);

    if (voteDeleteResult.affectedRows > 0) {
      await refreshVotesCount([msg.space]);
    }
  }
}
