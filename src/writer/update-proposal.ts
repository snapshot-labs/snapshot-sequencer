import isEqual from 'lodash/isEqual';
import snapshot from '@snapshot-labs/snapshot.js';
import { getAddress } from '@ethersproject/address';
import { jsonParse } from '../helpers/utils';
import db from '../helpers/mysql';
import { getSpace, getProposal } from '../helpers/actions';
import log from '../helpers/log';
import { capture } from '@snapshot-labs/snapshot-sentry';
import {
  flaggedAddresses,
  flaggedProposalTitleKeywords,
  flaggedProposalBodyKeywords
} from '../helpers/moderation';

const scoreAPIUrl = process.env.SCORE_API_URL || 'https://score.snapshot.org';

export function validateChoices({ type, choices }): boolean {
  if (type && choices.length > 0) {
    switch (type) {
      case 'basic':
        return isEqual(['For', 'Against', 'Abstain'], choices);
      default:
        return choices.length > 0;
    }
  } else {
    return false;
  }
}

// We don't need most of the checks used https://github.com/snapshot-labs/snapshot-sequencer/blob/89992b49c96fedbbbe33b42041c9cbe5a82449dd/src/writer/proposal.ts#L62
// because we assume that those checks were already done during the proposal creation
export function getSpaceUpdateError({ type, space }): string | undefined {
  const { voting = {} } = space;

  if (voting.type && type !== voting.type) return 'space voting type mismatch';

  return undefined;
}

export function isScamDetected({ address, name, body }): boolean {
  const proposalNameLC = name.toLowerCase();
  const proposalBodyLC = body.toLowerCase();
  const addressLC = address.toLowerCase();

  return (
    flaggedAddresses.includes(addressLC) ||
    flaggedProposalBodyKeywords.some(keyword => proposalBodyLC.includes(keyword)) ||
    flaggedProposalTitleKeywords.some(keyword => proposalNameLC.includes(keyword))
  );
}

export function isAddressAuthorized(address: string, space: any): boolean {
  const addressLC = address.toLowerCase();
  const members = [
    ...(space.members || []),
    ...(space.admins || []),
    ...(space.moderators || [])
  ].map(member => member.toLowerCase());

  return members.includes(addressLC);
}

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);

  const schemaIsValid = snapshot.utils.validateSchema(snapshot.schemas.updateProposal, msg.payload);
  if (!schemaIsValid) {
    log.warn('[writer] Wrong proposal format', schemaIsValid);
    return Promise.reject('wrong proposal format');
  }

  const proposal = await getProposal(msg.space, msg.payload.proposal);
  if (!proposal) return Promise.reject('unknown proposal');

  const isChoicesValid = validateChoices({
    type: msg.payload.type || proposal.type,
    choices: msg.payload.choices.length > 0 ? msg.payload.choices : proposal.choices
  });
  if (!isChoicesValid) {
    return Promise.reject(`wrong choices for "${msg.payload.type || proposal.type}" type voting`);
  }

  if (proposal.author !== body.address) return Promise.reject('Not the author');

  const space = await getSpace(msg.space);
  space.id = msg.space;

  const spaceUpdateError = getSpaceUpdateError({
    type: msg.payload.type || proposal.type,
    space
  });
  if (spaceUpdateError) return Promise.reject(spaceUpdateError);

  const hasScam = isScamDetected({
    address: body.address,
    name: msg.payload.name || proposal.title,
    body: msg.payload.body || proposal.body
  });
  if (hasScam) return Promise.reject('scam proposal detected, contact support');

  return Promise.resolve(proposal);
}

export async function action(body, ipfs, receipt, id, context): Promise<void> {
  const originalProposal = context;
  const msg = jsonParse(body.msg);
  const updated = parseInt(msg.timestamp);
  const metadata = msg.payload.metadata || {};
  const plugins = JSON.stringify(metadata.plugins || {});

  const proposal = {
    ipfs,
    updated,
    type: msg.payload.type || originalProposal.type,
    plugins: plugins || originalProposal.plugins,
    title: msg.payload.name || originalProposal.title,
    body: msg.payload.body,
    discussion: msg.payload.discussion,
    choices: JSON.stringify(msg.payload.choices) || originalProposal.choices
  };

  const query = 'UPDATE proposals SET ? WHERE id = ?';
  const params: any[] = [proposal, msg.payload.proposal];

  await db.queryAsync(query, params);
}

export function getIpfsBody(body, context) {
  const id = context.id;
  const originIpfs = context.ipfs;
  const { address, sig, ...restBody } = body;
  const { message } = restBody.data;

  const updatedProposal = {
    ...context,
    ...message
  };

  const ipfsBody = {
    address,
    sig,
    hash: id,
    originIpfs,
    ...restBody,
    data: restBody.data,
    proposal: updatedProposal
  };
  return ipfsBody;
}
