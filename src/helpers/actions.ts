import snapshot from '@snapshot-labs/snapshot.js';
import db from './mysql';
import { jsonParse } from './utils';
import { defaultNetwork } from '../writer/follow';

export async function addOrUpdateSpace(space: string, settings: any) {
  if (!settings?.name) return false;

  const ts = (Date.now() / 1e3).toFixed();
  const query =
    'INSERT INTO spaces SET ? ON DUPLICATE KEY UPDATE updated = ?, settings = ?, name = ?, hibernated = 0';

  await db.queryAsync(query, [
    {
      id: space,
      name: settings.name,
      created: ts,
      updated: ts,
      settings: JSON.stringify(settings)
    },
    ts,
    JSON.stringify(settings),
    settings.name
  ]);
}

export async function getProposal(space, id) {
  const query = `SELECT * FROM proposals WHERE space = ? AND id = ?`;
  const [proposal] = await db.queryAsync(query, [space, id]);
  if (!proposal) return false;

  proposal.strategies = jsonParse(proposal.strategies);
  proposal.validation = jsonParse(proposal.validation, { name: 'any', params: {} }) || {
    name: 'any',
    params: {}
  };
  proposal.choices = jsonParse(proposal.choices);

  return proposal;
}

export async function getSpace(id: string, includeDeleted = false, network = defaultNetwork) {
  if (network !== defaultNetwork) {
    const spaceExist = await sxSpaceExists(id);
    if (!spaceExist) return false;

    return {
      network: 0
    };
  }

  const query = `SELECT settings, deleted, flagged, verified, turbo, hibernated FROM spaces WHERE id = ? AND deleted in (?) LIMIT 1`;
  const spaces = await db.queryAsync(query, [id, includeDeleted ? [0, 1] : [0]]);

  if (!spaces[0]) return false;

  return {
    ...jsonParse(spaces[0].settings, {}),
    deleted: spaces[0].deleted === 1,
    verified: spaces[0].verified === 1,
    flagged: spaces[0].flagged === 1,
    hibernated: spaces[0].hibernated === 1,
    turbo: spaces[0].turbo === 1
  };
}

export async function sxSpaceExists(spaceId: string): Promise<boolean> {
  const { space } = await snapshot.utils.subgraphRequest(
    'https://api.studio.thegraph.com/query/23545/sx/version/latest',
    {
      space: {
        __args: {
          id: spaceId
        },
        id: true
      }
    }
  );
  return !!space?.id;
}

export function refreshProposalsCount(spaces?: string[], users?: string[]) {
  const whereFilters = ['spaces.deleted = 0'];
  const params: string[][] = [];

  if (spaces?.length) {
    whereFilters.push('space IN (?)');
    params.push(spaces);
  }

  if (users?.length) {
    whereFilters.push('author IN (?)');
    params.push(users);
  }

  return db.queryAsync(
    `
      INSERT INTO leaderboard (proposal_count, user, space)
        (SELECT * FROM (
          SELECT COUNT(proposals.id) AS proposal_count, author, space
          FROM proposals
          JOIN spaces ON BINARY spaces.id = BINARY proposals.space
          WHERE ${whereFilters.join(' AND ')}
          GROUP BY author, space
        ) AS t)
      ON DUPLICATE KEY UPDATE proposal_count = t.proposal_count
    `,
    params
  );
}

export function refreshVotesCount(spaces?: string[], users?: string[]) {
  const whereFilters = ['spaces.deleted = 0'];
  const params: string[][] = [];

  if (spaces?.length) {
    whereFilters.push('space IN (?)');
    params.push(spaces);
  }

  if (users?.length) {
    whereFilters.push('voter IN (?)');
    params.push(users);
  }

  return db.queryAsync(
    `
      INSERT INTO leaderboard (vote_count, last_vote, user, space)
        (SELECT * FROM (
          SELECT COUNT(votes.id) AS vote_count, MAX(votes.created) as last_vote, voter, space
          FROM votes
          JOIN spaces ON BINARY spaces.id = BINARY votes.space
          WHERE ${whereFilters.join(' AND ')}
          GROUP BY voter, space
        ) AS t)
      ON DUPLICATE KEY UPDATE vote_count = t.vote_count, last_vote = t.last_vote
    `,
    params
  );
}
