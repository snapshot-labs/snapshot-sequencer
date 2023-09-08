import db from './mysql';
import { jsonParse } from './utils';

export async function addOrUpdateSpace(space: string, settings: any) {
  if (!settings?.name) return false;
  const ts = (Date.now() / 1e3).toFixed();
  const query =
    'INSERT IGNORE INTO spaces SET ? ON DUPLICATE KEY UPDATE updated_at = ?, settings = ?, name = ?';
  await db.queryAsync(query, [
    {
      id: space,
      name: settings.name,
      created_at: ts,
      updated_at: ts,
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

export async function getSpace(id, includeDeleted = false) {
  const query = `SELECT settings, deleted FROM spaces WHERE id = ? AND deleted in (?) LIMIT 1`;
  const spaces = await db.queryAsync(query, [id, includeDeleted ? [0, 1] : [0]]);

  if (!spaces[0]) return false;

  const space = jsonParse(spaces[0].settings, {});
  if (spaces[0].deleted) space.deleted = true;

  return space;
}

export async function markSpaceAsDeleted(space: string) {
  const query = 'UPDATE spaces SET deleted = ? WHERE id = ?';

  await db.queryAsync(query, [1, space]);
}

export function refreshProposalsCount(spaces?: string[]) {
  return db.queryAsync(
    `
      INSERT INTO user_space_activities (proposals_count, user, space)
        (SELECT * FROM (
          SELECT COUNT(proposals.id) AS proposals_count, author, space
          FROM proposals
          JOIN spaces ON spaces.id = proposals.space
          WHERE spaces.deleted = 0
          ${spaces ? ' AND space IN (?)' : ''}
          GROUP BY author, space
        ) AS t)
      ON DUPLICATE KEY UPDATE proposals_count = t.proposals_count
    `.replace(/\n/gm, ' '),
    spaces
  );
}

export function refreshVotesCount(spaces: string[]) {
  return db.queryAsync(
    `
      INSERT INTO user_space_activities (votes_count, user, space)
        (SELECT * FROM (
          SELECT COUNT(votes.id) AS votes_count, voter, space
          FROM votes
          JOIN spaces ON spaces.id = votes.space
          WHERE spaces.deleted = 0 AND space IN (?)
          GROUP BY voter, space
        ) AS t)
      ON DUPLICATE KEY UPDATE votes_count = t.votes_count
    `.replace(/\n/gm, ' '),
    spaces
  );
}

export function incrementVotesCount(space: string, user: string) {
  return db.queryAsync(
    `
      INSERT INTO user_space_activities (space, user, votes_count)
      VALUES(?, ?, 1)
      ON DUPLICATE KEY UPDATE votes_count = votes_count + 1
    `.replace(/\n/gm, ' '),
    [space, user]
  );
}

export function incrementProposalsCount(space: string, user: string) {
  return db.queryAsync(
    `
      INSERT INTO user_space_activities (space, user, proposals_count)
      VALUES(?, ?, 1)
      ON DUPLICATE KEY UPDATE proposals_count = proposals_count + 1
    `.replace(/\n/gm, ' '),
    [space, user]
  );
}

export function decrementProposalsCount(space: string, user: string) {
  return db.queryAsync(
    `
      UPDATE user_space
      SET proposals_count = proposals_count - 1
      WHERE user = ? AND space = ?
      LIMIT 1
    `.replace(/\n/gm, ' '),
    [user, space]
  );
}
