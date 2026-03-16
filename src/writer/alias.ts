import snapshot from '@snapshot-labs/snapshot.js';
import { DEFAULT_ALIAS_EXPIRY_DAYS } from '../helpers/alias';
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
  if (message.address === msg.payload.alias) {
    return Promise.reject('alias cannot be the same as the address');
  }

  const results = await db.queryAsync('SELECT address FROM aliases WHERE alias = ?', [
    msg.payload.alias
  ]);
  for (const row of results) {
    if (row.address === message.address) {
      return Promise.reject('alias already exists');
    }
  }
  if (results.length > 0) {
    return Promise.reject('alias is already linked to another address');
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
    created: msg.timestamp,
    expiration: msg.timestamp + DEFAULT_ALIAS_EXPIRY_DAYS * 86400
  };
  await db.queryAsync('INSERT INTO aliases SET ?', params);
}
