import isEqual from 'lodash/isEqual';
import snapshot from '@snapshot-labs/snapshot.js';
import { getAddress } from '@ethersproject/address';
import kebabCase from 'lodash/kebabCase';
import { jsonParse } from '../helpers/utils';
import db from '../helpers/mysql';
import { getSpace } from '../helpers/actions';
import log from '../helpers/log';

const proposalDayLimit = 32;
const proposalMonthLimit = 320;
const network = process.env.NETWORK || 'testnet';

async function getRecentProposalsCount(space) {
  const query = `
    SELECT
    COUNT(IF(created > (UNIX_TIMESTAMP() - 86400), 1, NULL)) AS count_1d,
    COUNT(*) AS count_30d
    FROM proposals WHERE space = ? AND created > (UNIX_TIMESTAMP() - 2592000)
  `;
  return await db.queryAsync(query, [space]);
}

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);
  const created = parseInt(msg.timestamp);

  const schemaIsValid = snapshot.utils.validateSchema(snapshot.schemas.proposal, msg.payload);
  if (schemaIsValid !== true) {
    log.warn('[writer] Wrong proposal format', schemaIsValid);
    return Promise.reject('wrong proposal format');
  }

  if (
    msg.payload.type === 'basic' &&
    !isEqual(['For', 'Against', 'Abstain'], msg.payload.choices)
  ) {
    return Promise.reject('wrong choices for basic type voting');
  }

  const space = await getSpace(msg.space);
  space.id = msg.space;

  const hasTicket = space.strategies.some(strategy => strategy.name === 'ticket');
  const hasVotingValidation =
    space.voteValidation?.name && !['any', 'basic'].includes(space.voteValidation.name);

  if (hasTicket && !hasVotingValidation && network !== 'testnet') {
    return Promise.reject('space with ticket requires voting validation');
  }

  const hasProposalValidation =
    (space.validation?.name && space.validation.name !== 'any') ||
    space.filters?.minScore ||
    space.filters?.onlyMembers;

  if (!hasProposalValidation && network !== 'testnet') {
    return Promise.reject('space missing proposal validation');
  }

  // if (msg.payload.start < created) return Promise.reject('invalid start date');

  if (space.voting?.delay) {
    const isValidDelay = msg.payload.start === created + space.voting.delay;
    if (!isValidDelay) return Promise.reject('invalid voting delay');
  }

  if (space.voting?.period) {
    const isValidPeriod = msg.payload.end - msg.payload.start === space.voting.period;
    if (!isValidPeriod) return Promise.reject('invalid voting period');
  }

  if (space.voting?.type) {
    if (msg.payload.type !== space.voting.type) return Promise.reject('invalid voting type');
  }

  // Temporary fix to block proposal from scammer
  if (
    body.address.toLowerCase() === '0x2c8829427ce20d57614c461f5b2e9ada53a3dd96' ||
    body.address.toLowerCase() === '0x30323cf33a62651460405e3c1984835094168a60' ||
    body.address.toLowerCase() === '0xD48B7d0B0A9af29aAebda2c6F27aBC0B821341DE' ||
    msg.payload.body.toLowerCase().includes('claim airdrop here') ||
    msg.payload.name.includes('✅') ||
    msg.payload.name.toLowerCase().includes('airdrop') ||
    msg.payload.name.toLowerCase().includes('drop claim')
  )
    return Promise.reject('oops something went wrong');

  const onlyAuthors = space.filters?.onlyMembers;
  const members = [
    ...(space.members || []),
    ...(space.admins || []),
    ...(space.moderators || [])
  ].map(member => member.toLowerCase());
  const isAuthorized = members.includes(body.address.toLowerCase());

  if (onlyAuthors && !isAuthorized) return Promise.reject('only space authors can propose');
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
          body.address,
          space.id,
          space.network,
          'latest',
          validationParams,
          {}
        );
      }

      if (!isValid) return Promise.reject('validation failed');
    } catch (e) {
      log.warn(
        `[writer] Failed to check proposal validation, ${msg.space}, ${
          body.address
        }, ${JSON.stringify(e)}`
      );
      return Promise.reject('failed to check validation');
    }
  }

  const provider = snapshot.utils.getProvider(space.network);
  const currentBlockNum = parseInt(await provider.getBlockNumber());
  if (msg.payload.snapshot > currentBlockNum)
    return Promise.reject('proposal snapshot must be in past');

  try {
    const [{ count_1d: proposalsDayCount, count_30d: proposalsMonthCount }] =
      await getRecentProposalsCount(space.id);
    if (proposalsDayCount >= proposalDayLimit || proposalsMonthCount >= proposalMonthLimit)
      return Promise.reject('proposal limit reached');
  } catch (e) {
    return Promise.reject('failed to check proposals limit');
  }
}

export async function action(body, ipfs, receipt, id): Promise<void> {
  const msg = jsonParse(body.msg);
  const space = msg.space;

  /* Store the proposal in dedicated table 'proposals' */
  const spaceSettings = await getSpace(space);
  const author = getAddress(body.address);
  const created = parseInt(msg.timestamp);
  const metadata = msg.payload.metadata || {};
  const strategies = JSON.stringify(spaceSettings.strategies);
  const validation = JSON.stringify(spaceSettings.voteValidation);
  const plugins = JSON.stringify(metadata.plugins || {});
  const network = spaceSettings.network;
  const proposalSnapshot = parseInt(msg.payload.snapshot || '0');

  const proposal = {
    id,
    ipfs,
    author,
    created,
    space,
    network,
    symbol: spaceSettings?.symbol || '',
    type: msg.payload.type || 'single-choice',
    strategies,
    plugins,
    title: msg.payload.name,
    body: msg.payload.body,
    discussion: msg.payload.discussion || '',
    choices: JSON.stringify(msg.payload.choices),
    start: parseInt(msg.payload.start || '0'),
    end: parseInt(msg.payload.end || '0'),
    quorum: spaceSettings?.voting?.quorum || 0,
    privacy: spaceSettings?.voting?.privacy || '',
    snapshot: proposalSnapshot || 0,
    app: kebabCase(msg.payload.app || ''),
    scores: JSON.stringify([]),
    scores_by_strategy: JSON.stringify([]),
    scores_state: 'pending',
    scores_total: 0,
    scores_updated: 0,
    votes: 0,
    validation
  };
  const query = 'INSERT IGNORE INTO proposals SET ?; ';
  const params: any[] = [proposal];

  await db.queryAsync(query, params);
}
