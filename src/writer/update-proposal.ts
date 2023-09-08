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

export function isChoicesValid({ type, choices }): boolean {
  switch (type) {
    case 'basic':
      return isEqual(['For', 'Against', 'Abstain'], choices);
    default:
      return choices.length > 0;
  }
}

// We don't need most of the checks used https://github.com/snapshot-labs/snapshot-sequencer/blob/89992b49c96fedbbbe33b42041c9cbe5a82449dd/src/writer/proposal.ts#L62
// because we assume that those checks were already done during the proposal creation
export function getSpaceUpdateError({ type }, space): string | undefined {
  const { voting = {} } = space;

  if (voting.type && type !== voting.type) return 'space voting type mismatch';

  return undefined;
}

export function isScamDetected(address, { name, body }): boolean {
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

export async function checkAuthorization(address: string, space: any): Promise<string | undefined> {
  const onlyAuthors = space.filters?.onlyMembers;
  const isAuthorized = isAddressAuthorized(address, space);

  if (onlyAuthors && !isAuthorized) return 'only space authors can propose';
  if (!isAuthorized) {
    try {
      const validationName = space.validation?.name || 'basic';
      const validationParams = space.validation?.params || {};
      const minScore = space.validation?.params?.minScore || space.filters?.minScore;

      let isValid = false;
      // default case
      if (validationName === 'any' || (validationName === 'basic' && !minScore)) {
        isValid = true;
      } else {
        if (validationName === 'basic') {
          validationParams.minScore = minScore;
          validationParams.strategies = space.validation?.params?.strategies || space.strategies;
        }

        isValid = await snapshot.utils.validate(
          validationName,
          address,
          space.id,
          space.network,
          'latest',
          validationParams,
          { url: scoreAPIUrl }
        );
      }

      if (!isValid) return 'validation failed';
    } catch (e) {
      capture(e, { contexts: { input: { space: space.id, address } } });
      log.warn(
        `[writer] Failed to check proposal validation, ${space.id}, ${address}, ${JSON.stringify(
          e
        )}`
      );
      return 'failed to check validation';
    }
  }
}

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);

  const schemaIsValid = snapshot.utils.validateSchema(snapshot.schemas.updateProposal, msg.payload);
  // const schemaIsValid = snapshot.utils.validateSchema(schema, msg.payload);
  if (!schemaIsValid) {
    log.warn('[writer] Wrong proposal format', schemaIsValid);
    return Promise.reject('wrong proposal format');
  }

  if (!isChoicesValid(msg.payload)) {
    return Promise.reject(`wrong choices for ${msg.payload.type} type voting`);
  }

  const proposal = await getProposal(msg.space, msg.payload.proposal);
  if (!proposal) return Promise.reject('unknown proposal');

  console.log('proposal', proposal, body);
  if (proposal.author !== body.address) return Promise.reject('Not the author');

  const space = await getSpace(msg.space);
  space.id = msg.space;

  const spaceUpdateError = getSpaceUpdateError(msg.payload, space);
  if (spaceUpdateError) return Promise.reject(spaceUpdateError);

  if (isScamDetected(body.address, msg.payload))
    return Promise.reject('scam proposal detected, contact support');

  const authorizationError = await checkAuthorization(body.address, space);
  if (authorizationError) return Promise.reject(authorizationError);

  return Promise.resolve(proposal);
}

export async function action(body, ipfs): Promise<void> {
  const msg = jsonParse(body.msg);
  const space = msg.space;

  const author = getAddress(body.address);
  const updated = parseInt(msg.timestamp);
  const metadata = msg.payload.metadata || {};
  const plugins = JSON.stringify(metadata.plugins || {});

  const proposal = {
    ipfs,
    author,
    updated,
    space,
    type: msg.payload.type || 'single-choice',
    plugins,
    title: msg.payload.name,
    body: msg.payload.body,
    discussion: msg.payload.discussion || '',
    choices: JSON.stringify(msg.payload.choices)
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
