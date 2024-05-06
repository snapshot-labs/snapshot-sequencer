import db from '../helpers/mysql';
import { defaultNetwork } from './follow';

export async function verify(): Promise<any> {
  return true;
}

export async function action(message): Promise<void> {
  const query = 'DELETE FROM follows WHERE follower = ? AND space = ? AND network = ? LIMIT 1';
  await db.queryAsync(query, [message.from, message.space, defaultNetwork]);
}
