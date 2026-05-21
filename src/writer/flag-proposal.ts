import { getProposal, getSpace, isAuthorized } from '../helpers/actions';
import db from '../helpers/mysql';
import { jsonParse } from '../helpers/utils';

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);

  const proposal = await getProposal(msg.space, msg.payload.proposal);
  if (!proposal) return Promise.reject('unknown proposal');
  if (proposal.flagged) return Promise.reject('proposal already flagged');
  const space = await getSpace(msg.space);

  if (!isAuthorized({ space, address: body.address })) {
    return Promise.reject('not authorized to flag proposal');
  }

  return proposal;
}

export async function action(body): Promise<void> {
  const msg = jsonParse(body.msg);
  await db.queryAsync('UPDATE proposals SET flagged = 1 WHERE id = ? LIMIT 1', [
    msg.payload.proposal
  ]);
}
