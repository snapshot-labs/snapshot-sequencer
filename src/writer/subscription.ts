import { envelopDB } from '../helpers/mysql';
import { jsonParse } from '../helpers/utils';

type Message = { msg: string; address: string };

const VALID_TYPES = ['email'];

function extractPayload(message: Message) {
  return jsonParse(message.msg).payload;
}

export async function verify(message: Message): Promise<any> {
  const payload = extractPayload(message);

  if (!VALID_TYPES.includes(payload.type)) {
    return Promise.reject('invalid type');
  }

  const result = await envelopDB.queryAsync(
    `SELECT * FROM subscribers WHERE address = ? AND email = ? LIMIT 1`,
    [message.address, payload.value]
  );

  if (result[0]) {
    return Promise.reject('user already subscribed');
  }

  return true;
}

export async function action(message: Message): Promise<void> {
  const payload = extractPayload(message);

  await envelopDB.queryAsync(`INSERT INTO subscribers (email, address, created) VALUES(?, ?, ?)`, [
    payload.value,
    message.address,
    (Date.now() / 1e3).toFixed()
  ]);
}
