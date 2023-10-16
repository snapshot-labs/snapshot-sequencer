import { FOLLOWS_LIMIT_PER_USER } from '../helpers/limits';
import db from '../helpers/mysql';

export const getFollowsCount = async follower => {
  const query = `
  SELECT
    COUNT(*) AS followsCount
  FROM
    follows
  WHERE
    follower = ?
  `;
  return await db.queryAsync(query, follower);
};

export async function verify(message): Promise<any> {
  const follower = message.from;
  const [{ followsCount }] = await getFollowsCount(follower);
  if (followsCount >= FOLLOWS_LIMIT_PER_USER) {
    return Promise.reject('follows limit reached');
  }
  return true;
}

export async function action(message, ipfs, receipt, id): Promise<void> {
  const params = {
    id,
    ipfs,
    follower: message.from,
    space: message.space,
    created: message.timestamp
  };
  await db.queryAsync('INSERT IGNORE INTO follows SET ?', params);
}
