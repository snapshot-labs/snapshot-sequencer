import isEqual from 'lodash/isEqual';
import snapshot from '@snapshot-labs/snapshot.js';
import { addOrUpdateSpace, getSpace } from '../helpers/actions';
import { DEFAULT_NETWORK, jsonParse } from '../helpers/utils';
import { capture } from '@snapshot-labs/snapshot-sentry';
import log from '../helpers/log';

const network = process.env.NETWORK || 'testnet';
const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);

  const schemaIsValid = snapshot.utils.validateSchema(snapshot.schemas.space, msg.payload);
  if (schemaIsValid !== true) {
    log.warn('[writer] Wrong space format', schemaIsValid);
    return Promise.reject('wrong space format');
  }

  const controller = await snapshot.utils.getSpaceController(msg.space, DEFAULT_NETWORK, {
    broviderUrl
  });
  const isController = controller === body.address;
  const space = await getSpace(msg.space, true);

  if (network !== 'testnet') {
    const hasTicket = msg.payload.strategies.some(strategy => strategy.name === 'ticket');
    const hasVotingValidation =
      msg.payload.voteValidation?.name && !['any'].includes(msg.payload.voteValidation.name);

    if (hasTicket && !hasVotingValidation) {
      return Promise.reject('space with ticket requires voting validation');
    }

    const hasProposalValidation =
      (msg.payload.validation?.name && msg.payload.validation.name !== 'any') ||
      msg.payload.filters?.minScore ||
      msg.payload.filters?.onlyMembers;

    if (!hasProposalValidation) {
      return Promise.reject('space missing proposal validation');
    }
  }

  if (space?.deleted) return Promise.reject('space deleted, contact admin');
  const admins = (space?.admins || []).map(admin => admin.toLowerCase());
  const isAdmin = admins.includes(body.address.toLowerCase());
  const newAdmins = (msg.payload.admins || []).map(admin => admin.toLowerCase());

  if (!isAdmin && !isController) return Promise.reject('not allowed');

  if (!isController && !isEqual(admins, newAdmins))
    return Promise.reject('not allowed change admins');
}

export async function action(body): Promise<void> {
  const msg = jsonParse(body.msg);
  const space = msg.space;
  try {
    await addOrUpdateSpace(space, msg.payload);
  } catch (e) {
    capture(e, { space });
    log.warn('[writer] Failed to store settings', msg.space, e);
    return Promise.reject('failed store settings');
  }
}
