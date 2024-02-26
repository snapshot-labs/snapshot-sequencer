import db from './mysql';
import { jsonParse } from './utils';

export async function addOrUpdateSpace(space: string, settings: any) {
  if (!settings?.name) return false;

  const ts = (Date.now() / 1e3).toFixed();
  const query =
    'INSERT IGNORE INTO spaces SET ? ON DUPLICATE KEY UPDATE updated = ?, settings = ?, name = ?, hibernated = 0';

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

export async function getSpace(id: string, includeDeleted = false) {
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

export async function markSpaceAsDeleted(space: string) {
  const query = 'UPDATE spaces SET deleted = ? WHERE id = ?';

  await db.queryAsync(query, [1, space]);
}
