import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import db from '../helpers/mysql';
import { jsonParse } from '../helpers/utils';
import log from '../helpers/log';

export async function verify(message): Promise<any> {
  const msg = jsonParse(message.msg, {});
  const schemaIsValid = snapshot.utils.validateSchema(snapshot.schemas.alias, msg.payload);
  if (schemaIsValid !== true) {
    log.warn(`[writer] Wrong alias format ${JSON.stringify(schemaIsValid)}`);
    return Promise.reject('wrong alias format');
  }
  return message.from !== msg.payload.alias;
}

export async function action(message, ipfs, receipt, id): Promise<void> {
  const params = {
    id,
    ipfs,
    address: getAddress(message.from),
    alias: getAddress(message.alias),
    created: message.timestamp
  };
  await db.queryAsync('INSERT IGNORE INTO aliases SET ?', params);
}
