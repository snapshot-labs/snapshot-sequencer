import isEqual from 'lodash/isEqual';
import snapshot from '@snapshot-labs/snapshot.js';
import { jsonParse } from '../helpers/utils';
import db from '../helpers/mysql';
import { getSpace, getProposal } from '../helpers/actions';
import log from '../helpers/log';
import {
  flaggedAddresses,
  flaggedProposalTitleKeywords,
  flaggedProposalBodyKeywords
} from '../helpers/moderation';

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

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);
  const timestampNow = Math.floor(Date.now() / 1e3);

  const schemaIsValid: any = snapshot.utils.validateSchema(
    snapshot.schemas.updateProposal,
    msg.payload
  );
  if (schemaIsValid !== true) {
    log.warn('[writer] Wrong proposal format', schemaIsValid);
    return Promise.reject('wrong proposal format');
  }

  const proposal = await getProposal(msg.space, msg.payload.proposal);
  if (!proposal) return Promise.reject('unknown proposal');
  if (proposal.start < timestampNow) return Promise.reject('proposal already started');

  const isChoicesValid = validateChoices({
    type: msg.payload.type,
    choices: msg.payload.choices
  });
  if (!isChoicesValid) {
    return Promise.reject(`wrong choices for "${msg.payload.type}" type voting`);
  }

  if (proposal.author !== body.address) return Promise.reject('Not the author');

  const space = await getSpace(msg.space);
  space.id = msg.space;

  const spaceUpdateError = getSpaceUpdateError({
    type: msg.payload.type,
    space
  });
  if (spaceUpdateError) return Promise.reject(spaceUpdateError);

  const hasScam = isScamDetected({
    address: body.address,
    name: msg.payload.name,
    body: msg.payload.body
  });
  if (hasScam) return Promise.reject('scam proposal detected, contact support');

  return Promise.resolve(proposal);
}

export async function action(body, ipfs): Promise<void> {
  const msg = jsonParse(body.msg);
  const updated = parseInt(msg.timestamp);
  const metadata = msg.payload.metadata || {};
  const plugins = JSON.stringify(metadata.plugins || {});

  const proposal = {
    ipfs,
    updated,
    type: msg.payload.type,
    plugins: plugins,
    title: msg.payload.name,
    body: msg.payload.body,
    discussion: msg.payload.discussion,
    choices: JSON.stringify(msg.payload.choices)
  };

  const query = 'UPDATE proposals SET ? WHERE id = ? LIMIT 1';
  const params: any[] = [proposal, msg.payload.proposal];

  await db.queryAsync(query, params);
}
