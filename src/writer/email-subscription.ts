import snapshot from '@snapshot-labs/snapshot.js';
import log from '../helpers/log';
import { envelopDB } from '../helpers/mysql';
import { jsonParse } from '../helpers/utils';

type Message = { msg: string; address: string };
type Payload = {
  email?: string;
  subscriptions?: string[];
};

function extractPayload(message: Message): Payload {
  return jsonParse(message.msg).payload;
}

export async function verify(message: Message): Promise<boolean> {
  if (!envelopDB) {
    return Promise.reject('not supported');
  }

  const payload = extractPayload(message);

  const schemaIsValid = snapshot.utils.validateSchema(snapshot.schemas.emailSubscription, payload);
  if (schemaIsValid !== true) {
    log.warn(`[writer] Wrong email subscription format ${JSON.stringify(schemaIsValid)}`);
    return Promise.reject('wrong email subscription format');
  }

  if (payload.email?.length) {
    return verifySubscriptionCreation(message, payload);
  } else {
    return verifySubscriptionUpdate(message, payload);
  }
}

export async function action(message: Message): Promise<void> {
  if (!envelopDB) {
    return Promise.reject('not supported');
  }

  const payload = extractPayload(message);

  if (payload.email?.length) {
    await createAction(message, payload);
  } else {
    await updateAction(message, payload);
  }
}

async function verifySubscriptionCreation(message: Message, payload: Payload): Promise<boolean> {
  const result = await envelopDB.queryAsync(
    `SELECT * FROM subscribers WHERE address = ? AND email = ? LIMIT 1`,
    [message.address, payload.email]
  );

  if (result[0]) {
    return Promise.reject('email already subscribed');
  }

  return true;
}

async function verifySubscriptionUpdate(message: Message, payload: Payload): Promise<boolean> {
  const result = await envelopDB.queryAsync(
    `SELECT * FROM subscribers WHERE address = ? ORDER BY verified DESC LIMIT 1`,
    [message.address, payload.email]
  );

  if (!result[0]) {
    return Promise.reject('email not subscribed');
  }

  if (!result[0].verified) {
    return Promise.reject('email not verified');
  }

  return true;
}

async function createAction(message: Message, payload: Payload) {
  await envelopDB.queryAsync(`INSERT INTO subscribers (email, address, created) VALUES(?, ?, ?)`, [
    payload.email,
    message.address,
    (Date.now() / 1e3).toFixed()
  ]);
}

async function updateAction(message: Message, payload: Payload) {
  await envelopDB.queryAsync(
    `UPDATE subscribers SET subscriptions = ? WHERE address = ? AND verified > 0 LIMIT 1`,
    [JSON.stringify(payload.subscriptions), message.address]
  );
}
