import { getAddress } from '@ethersproject/address';
import db from '../helpers/mysql';
import { getSpace } from '../helpers/actions';

export async function verify(msg): Promise<any> {
  const space = await getSpace(msg.space);

  if (!space) return Promise.reject('invalid space');

  if (msg.about.length > 140) return Promise.reject('about is too long');

  return true;
}

export async function action(msg, ipfs, receipt, id): Promise<void> {
  const item = {
    id,
    ipfs,
    delegate: getAddress(msg.from),
    space: msg.space,
    about: msg.about,
    statement: msg.statement,
    created: msg.timestamp
  };

  const query =
    'INSERT IGNORE INTO statements SET ? ON DUPLICATE KEY UPDATE about = ?, statement = ?, updated = ?';
  const params = [item, item.about, item.statement, item.created];

  await db.queryAsync(query, params);
}
