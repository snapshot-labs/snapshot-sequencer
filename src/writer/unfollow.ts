import db from '../helpers/mysql';
import { UnfollowMessage } from '../schemas';

export async function verify(): Promise<any> {
  return true;
}

export async function action(message: UnfollowMessage): Promise<void> {
  const query = 'DELETE FROM follows WHERE follower = ? AND space = ? LIMIT 1';
  await db.queryAsync(query, [message.from, message.space]);
}
