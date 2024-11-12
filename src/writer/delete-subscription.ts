import { envelopDB } from '../helpers/mysql';

type Message = { address: string };

export async function verify(message: Message): Promise<any> {
  const result = await envelopDB.queryAsync(
    `SELECT * FROM subscribers WHERE address = ? AND verified > 0 LIMIT 1`,
    [message.address]
  );

  if (!result[0]) {
    return Promise.reject('user not subscribed');
  }

  return result[0];
}

export async function action(message: Message): Promise<void> {
  await envelopDB.queryAsync(`DELETE FROM subscribers WHERE address = ? AND verified > 0 LIMIT 1`, [
    message.address
  ]);
}
