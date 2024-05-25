import db from '../helpers/mysql';
import { defaultNetwork } from './follow';

export async function verify(message): Promise<any> {
  const query = `SELECT * FROM follows WHERE follower = ? AND space = ? AND network = ? LIMIT 1`;
  const follows = await db.queryAsync(query, [
    message.from,
    message.space,
    message.network || defaultNetwork
  ]);

  if (follows.length === 0) return Promise.reject('you can only unfollow a space you follow');

  return true;
}

export async function action(message): Promise<void> {
  const query = `
    DELETE FROM follows WHERE follower = ? AND space = ? AND network = ? LIMIT 1;
    UPDATE spaces SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = ?;
  `;
  await db.queryAsync(query, [
    message.from,
    message.space,
    message.network || defaultNetwork,
    message.space
  ]);
}
