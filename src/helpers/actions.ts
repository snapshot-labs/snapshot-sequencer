import db from './mysql';
import { jsonParse } from './utils';

export async function addOrUpdateSpace(space: string, settings: any) {
  if (!settings || !settings.name) return false;
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
