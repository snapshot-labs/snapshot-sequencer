import db from '../helpers/mysql';
import { DEFAULT_NETWORK_ID } from '../helpers/utils';

export async function verify(): Promise<any> {
  return true;
}

export async function action(message): Promise<void> {
  const query = 'DELETE FROM follows WHERE follower = ? AND space = ? AND network = ? LIMIT 1';
  await db.queryAsync(query, [message.from, message.space, message.network || DEFAULT_NETWORK_ID]);
}
