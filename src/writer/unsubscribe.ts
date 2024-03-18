import db from '../helpers/mysql';
import { UnsubscribeMessage } from '../schemas';

export async function verify(): Promise<any> {
  return true;
}

export async function action(message: UnsubscribeMessage): Promise<void> {
  const query = 'DELETE FROM subscriptions WHERE address = ? AND space = ? LIMIT 1';
  await db.queryAsync(query, [message.from, message.space]);
}
