import db from '../helpers/mysql';
import { SubscribeMessage } from '../schemas';

export async function verify(): Promise<any> {
  return true;
}

export async function action(
  message: SubscribeMessage,
  ipfs: string,
  receipt: string,
  id: string
): Promise<void> {
  const params = {
    id,
    ipfs,
    address: message.from,
    space: message.space,
    created: message.timestamp
  };
  await db.queryAsync('INSERT INTO subscriptions SET ?', params);
}
