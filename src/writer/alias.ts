import snapshot from '@snapshot-labs/snapshot.js';
import log from '../helpers/log';
import db from '../helpers/mysql';
import { jsonParse } from '../helpers/utils';

export async function verify(message): Promise<any> {
  const msg = jsonParse(message.msg, {});
  const schemaIsValid = snapshot.utils.validateSchema(snapshot.schemas.alias, msg.payload);
  if (schemaIsValid !== true) {
    log.warn(`[writer] Wrong alias format ${JSON.stringify(schemaIsValid)}`);
    return Promise.reject('wrong alias format');
  }
  if (message.from === msg.payload.alias) {
    return Promise.reject('alias cannot be the same as the address');
  }
  return true;
}

export async function action(message, ipfs, receipt, id): Promise<void> {
  const msg = jsonParse(message.msg);
  const params = {
    id,
    ipfs,
    address: message.address,
    alias: msg.payload.alias,
    created: msg.timestamp
  };
  await db.queryAsync('INSERT INTO aliases SET ?', params);
}
