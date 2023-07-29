import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';
import db from '../helpers/mysql';
import { jsonParse } from '../helpers/utils';
import log from '../helpers/log';
import { capture } from '@snapshot-labs/snapshot-sentry';

export async function verify(body): Promise<any> {
  const msg = jsonParse(body.msg, {});
  const schemaIsValid = snapshot.utils.validateSchema(snapshot.schemas.statement, msg.payload);
  if (schemaIsValid !== true) {
    capture(schemaIsValid);
    log.warn(`[writer] Wrong statement format ${JSON.stringify(schemaIsValid)}`);
    return Promise.reject('wrong statement format');
  }
  return true;
}

export async function action(body, ipfs, receipt, id): Promise<void> {
  const msg = jsonParse(body.msg);
  const space = msg.space;
  const delegate = getAddress(body.address);
  const created = parseInt(msg.timestamp);
  const item = {
    id,
    ipfs,
    delegate,
    space,
    about: msg.payload.about,
    statement: msg.payload.statement,
    created
  };

  const query =
    'INSERT IGNORE INTO statements SET ? ON DUPLICATE KEY UPDATE ipfs = ?, about = ?, statement = ?, updated = ?';
  const params = [item, item.ipfs, item.about, item.statement, item.created];

  await db.queryAsync(query, params);
}
