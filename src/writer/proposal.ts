import snapshot from '@snapshot-labs/snapshot.js';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';
import kebabCase from 'lodash/kebabCase';
import { getQuorum, jsonParse, validateChoices } from '../helpers/utils';
import db from '../helpers/mysql';
import { getSpace } from '../helpers/actions';
import log from '../helpers/log';
import { ACTIVE_PROPOSAL_BY_AUTHOR_LIMIT, getSpaceLimits } from '../helpers/limits';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { flaggedAddresses, containsFlaggedLinks } from '../helpers/moderation';
import { validateSpaceSettings } from './settings';
// import { isMalicious } from '../helpers/blockaid';
// import { blockaidBlockedRequestsCount } from '../helpers/metrics';

const scoreAPIUrl = process.env.SCORE_API_URL || 'https://score.snapshot.org';
const broviderUrl = process.env.BROVIDER_URL || 'https://rpc.snapshot.org';

export const getProposalsCount = async (space, author) => {
  const query = `
  SELECT
    dayCount,
    monthCount,
    activeProposalsByAuthor
  FROM
    (SELECT
        COUNT(IF(a.created > (UNIX_TIMESTAMP() - 86400), 1, NULL)) AS dayCount,
        COUNT(*) AS monthCount
    FROM proposals AS a
    WHERE a.space = ? AND a.created > (UNIX_TIMESTAMP() - 2592000)
    ) AS proposalsCountBySpace
  CROSS JOIN
    (SELECT
        COUNT(*) AS activeProposalsByAuthor
    FROM proposals AS b
    WHERE b.author = ? and b.end > UNIX_TIMESTAMP()
    ) AS proposalsCountByAuthor;
  `;
  return await db.queryAsync(query, [space, author]);
};

async function validateSpace(space: any) {
  if (!space) {
    return Promise.reject('unknown space');
  }

  if (space.hibernated) {
    return Promise.reject('space hibernated');
  }

  try {
    await validateSpaceSettings(space);
  } catch (e) {
    return Promise.reject(e);
  }
}

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg);
  const created = parseInt(msg.timestamp);
  const addressLC = body.address.toLowerCase();
  const space = await getSpace(msg.space);

  try {
    await validateSpace(space);
  } catch (e) {
    return Promise.reject(`invalid space settings: ${e}`);
  }

  space.id = msg.space;

  const schemaIsValid = snapshot.utils.validateSchema(snapshot.schemas.proposal, msg.payload, {
    spaceType: space.turbo ? 'turbo' : 'default'
  });

  if (schemaIsValid !== true) {
    log.warn('[writer] Wrong proposal format', schemaIsValid);
    return Promise.reject('wrong proposal format');
  }

  const tsInt = (Date.now() / 1e3).toFixed();
  if (msg.payload.end <= tsInt) {
    return Promise.reject('proposal end date must be in the future');
  }

  const isChoicesValid = validateChoices({
    type: msg.payload.type,
    choices: msg.payload.choices
  });
  if (!isChoicesValid) return Promise.reject('wrong choices for basic type voting');

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

  /**
  try {
    const content = `
      ${msg.payload.name || ''}
      ${msg.payload.body || ''}
      ${msg.payload.discussion || ''}
    `;

    if (await isMalicious(content)) {
      blockaidBlockedRequestsCount.inc({ space: space.id });
      return Promise.reject('invalid proposal content');
    }
  } catch (e) {
    log.warning('[writer] Failed to query Blockaid');
  }
  */

  if (flaggedAddresses.includes(addressLC))
    return Promise.reject('invalid proposal, please contact support');

  const onlyAuthors = space.filters?.onlyMembers;
  const members = [
    ...(space.members || []),
    ...(space.admins || []),
    ...(space.moderators || [])
  ].map(member => member.toLowerCase());
  const isAuthorized = members.includes(addressLC);

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
          { url: scoreAPIUrl }
        );
      }

      if (!isValid) return Promise.reject('validation failed');
    } catch (e) {
      capture(e, { space: msg.space, address: body.address });
      log.warn(
        `[writer] Failed to check proposal validation, ${msg.space}, ${
          body.address
        }, ${JSON.stringify(e)}`
      );
      return Promise.reject('failed to check validation');
    }
  }

  if (msg.payload.snapshot < networks[space.network].start)
    return Promise.reject('proposal snapshot must be after network start');

  try {
    const provider = snapshot.utils.getProvider(space.network, { broviderUrl });
    const block = await provider.getBlock(msg.payload.snapshot);
    if (!block) return Promise.reject('invalid snapshot block');
  } catch (error: any) {
    if (error.message?.includes('invalid block hash or block tag'))
      return Promise.reject('invalid snapshot block');
    return Promise.reject('unable to fetch block');
  }

  try {
    const [{ dayCount, monthCount, activeProposalsByAuthor }] = await getProposalsCount(
      space.id,
      body.address
    );
    const [dayLimit, monthLimit] = getSpaceLimits(space);

    if (dayCount >= dayLimit || monthCount >= monthLimit)
      return Promise.reject('proposal limit reached');
    if (!isAuthorized && activeProposalsByAuthor >= ACTIVE_PROPOSAL_BY_AUTHOR_LIMIT)
      return Promise.reject('active proposal limit reached for author');
  } catch (e) {
    capture(e);
    return Promise.reject('failed to check proposals limit');
  }
}

export async function action(body, ipfs, receipt, id): Promise<void> {
  const msg = jsonParse(body.msg);
  const space = msg.space;

  /* Store the proposal in dedicated table 'proposals' */
  const spaceSettings = await getSpace(space);

  const author = body.address;
  const created = parseInt(msg.timestamp);
  const metadata = msg.payload.metadata || {};
  const strategies = JSON.stringify(spaceSettings.strategies);
  const validation = JSON.stringify(spaceSettings.voteValidation);
  const plugins = JSON.stringify(metadata.plugins || {});
  const spaceNetwork = spaceSettings.network;
  const proposalSnapshot = parseInt(msg.payload.snapshot || '0');

  let quorum = spaceSettings.voting?.quorum || 0;
  if (!quorum && spaceSettings.plugins?.quorum) {
    try {
      quorum = await getQuorum(spaceSettings.plugins.quorum, spaceNetwork, proposalSnapshot);
    } catch (e: any) {
      console.log('unable to get quorum', e.message);
      return Promise.reject('unable to get quorum');
    }
  }

  const proposal = {
    id,
    ipfs,
    author,
    created,
    space,
    network: spaceNetwork,
    symbol: spaceSettings.symbol || '',
    type: msg.payload.type || 'single-choice',
    strategies,
    plugins,
    title: msg.payload.name,
    body: msg.payload.body,
    discussion: msg.payload.discussion || '',
    choices: JSON.stringify(msg.payload.choices),
    start: parseInt(msg.payload.start || '0'),
    end: parseInt(msg.payload.end || '0'),
    quorum,
    quorum_type: (quorum && spaceSettings.voting?.quorumType) || '',
    privacy: spaceSettings.voting?.privacy || '',
    snapshot: proposalSnapshot || 0,
    app: kebabCase(msg.payload.app || ''),
    scores: JSON.stringify([]),
    scores_by_strategy: JSON.stringify([]),
    scores_state: 'pending',
    scores_total: 0,
    scores_updated: 0,
    votes: 0,
    validation,
    flagged: +containsFlaggedLinks(msg.payload.body)
  };

  const query = 'INSERT IGNORE INTO proposals SET ?; ';
  const params: any[] = [proposal];

  await db.queryAsync(query, params);
}
