import { getProposal, getSpace } from '../helpers/actions';
import db from '../helpers/mysql';
import { jsonParse } from '../helpers/utils';

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

  const voters = await db.queryAsync(`SELECT voter, vp_value FROM votes WHERE proposal = ?`, [
    msg.payload.proposal
  ]);
  const id = msg.payload.proposal;

  let queries = `
    DELETE FROM proposals WHERE id = ? LIMIT 1;
    DELETE FROM votes WHERE proposal = ?;
    UPDATE leaderboard
      SET proposal_count = GREATEST(proposal_count - 1, 0)
      WHERE user = ? AND space = ?
      LIMIT 1;
    UPDATE spaces
      SET proposal_count = GREATEST(proposal_count - 1, 0), vote_count = GREATEST(vote_count - ?, 0)
      WHERE id = ?;
  `;

  const parameters = [id, id, proposal.author, msg.space, voters.length, msg.space];

  if (voters.length > 0) {
    queries += `
    UPDATE leaderboard SET vote_count = GREATEST(vote_count - 1, 0)
      WHERE user IN (?) AND space = ?;
  `;
    parameters.push(
      voters.map(voter => voter.voter),
      msg.space
    );
  }

  await db.queryAsync(queries, parameters);

  const votersWithVpValue = voters.filter(v => v.vp_value > 0);
  if (votersWithVpValue.length > 0) {
    const batchSize = 1000;
    for (let i = 0; i < votersWithVpValue.length; i += batchSize) {
      const batch = votersWithVpValue.slice(i, i + batchSize);
      const vpQueries = batch
        .map(
          () =>
            `UPDATE leaderboard SET vp_value = GREATEST(vp_value - ?, 0) WHERE user = ? AND space = ?;`
        )
        .join('\n    ');

      const vpParams = batch.flatMap(voter => [voter.vp_value, voter.voter, msg.space]);

      await db.queryAsync(vpQueries, vpParams);
    }
  }
}
