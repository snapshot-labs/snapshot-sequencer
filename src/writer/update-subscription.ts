import { envelopDB } from '../helpers/mysql';
import { jsonParse } from '../helpers/utils';

type Message = { msg: string; address: string };
type Payload = {
  type: string;
  value: string;
  metadata: { subscriptions: string[] };
};

const VALID_SUBSCRIPTIONS = ['summary', 'newProposal', 'closedProposal'];

function extractPayload(message: Message): Payload {
  const payload = jsonParse(message.msg).payload;

  return {
    ...payload,
    metadata: jsonParse(payload.metadata)
  };
}

export async function verify(message: Message): Promise<any> {
  const result = await envelopDB.queryAsync(`SELECT * FROM subscribers WHERE address = ? LIMIT 1`, [
    message.address
  ]);

  if (!result[0]) {
    return Promise.reject('user not subscribed');
  }

  if (!result[0].verified) {
    return Promise.reject('email not verified');
  }

  const {
    metadata: { subscriptions }
  } = extractPayload(message);
  if ((subscriptions || []).some(s => !VALID_SUBSCRIPTIONS.includes(s))) {
    return Promise.reject('invalid subscription value');
  }

  return result[0];
}

export async function action(message: Message): Promise<void> {
  const {
    metadata: { subscriptions }
  } = extractPayload(message);

  await envelopDB.queryAsync(
    `UPDATE subscribers SET subscriptions = ? WHERE address = ? AND verified > 0 LIMIT 1`,
    [JSON.stringify(subscriptions), message.address]
  );
}
