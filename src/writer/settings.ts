import isEqual from 'lodash/isEqual';
import snapshot from '@snapshot-labs/snapshot.js';
import { addOrUpdateSpace, getSpace } from '../helpers/actions';
import { DEFAULT_NETWORK, jsonParse } from '../helpers/utils';
import { capture } from '@snapshot-labs/snapshot-sentry';
import log from '../helpers/log';

const SNAPSHOT_ENV = process.env.NETWORK || 'testnet';
const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export async function validateSpaceSettings(originalSpace: any) {
  const spaceType = originalSpace.turbo ? 'turbo' : 'default';
  const space = snapshot.utils.clone(originalSpace);

  if (space?.deleted) return Promise.reject('space deleted, contact admin');

  delete space.deleted;
  delete space.flagged;
  delete space.verified;
  delete space.turbo;
  delete space.hibernated;
  delete space.id;

  const schemaIsValid: any = snapshot.utils.validateSchema(snapshot.schemas.space, space, {
    spaceType,
    snapshotEnv: SNAPSHOT_ENV
  });

  if (schemaIsValid !== true) {
    log.warn('[writer] Wrong space format', schemaIsValid);
    const firstErrorObject: any = Object.values(schemaIsValid)[0];
    if (firstErrorObject.message === 'network not allowed') {
      return Promise.reject(firstErrorObject.message);
    }
    return Promise.reject('wrong space format');
  }

  if (SNAPSHOT_ENV !== 'testnet') {
    const hasTicket = space.strategies.some(strategy => strategy.name === 'ticket');
    const hasVotingValidation =
      space.voteValidation?.name && !['any'].includes(space.voteValidation.name);

    if (hasTicket && !hasVotingValidation) {
      return Promise.reject('space with ticket requires voting validation');
    }

    const hasProposalValidation =
      (space.validation?.name && space.validation.name !== 'any') ||
      space.filters?.minScore ||
      space.filters?.onlyMembers;

    if (!hasProposalValidation) {
      return Promise.reject('space missing proposal validation');
    }
  }
}

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);
  const space = await getSpace(msg.space, true);

  try {
    await validateSpaceSettings({
      ...msg.payload,
      deleted: space?.deleted,
      turbo: space?.turbo
    });
  } catch (e) {
    return Promise.reject(e);
  }

  const controller = await snapshot.utils.getSpaceController(msg.space, DEFAULT_NETWORK, {
    broviderUrl
  });
  const isController = controller === body.address;

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
    log.warn('[writer] Failed to store settings', msg.space, JSON.stringify(e));
    return Promise.reject('failed store settings');
  }
}
