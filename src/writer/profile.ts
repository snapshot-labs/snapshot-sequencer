import snapshot from '@snapshot-labs/snapshot.js';
import db from '../helpers/mysql';
import { jsonParse } from '../helpers/utils';
import log from '../helpers/log';
import { ProfileMessage } from '../schemas';

export async function verify(message: ProfileMessage): Promise<any> {
  const profile = jsonParse(message.profile, {});
  const schemaIsValid = snapshot.utils.validateSchema(snapshot.schemas.profile, profile);
  if (schemaIsValid !== true) {
    log.warn(`[writer] Wrong profile format ${JSON.stringify(schemaIsValid)}`);
    return Promise.reject('wrong profile format');
  }

  return true;
}

export async function action(message: ProfileMessage, ipfs: string): Promise<void> {
  const profile = jsonParse(message.profile, {});

  const params = {
    id: message.from,
    ipfs,
    created: message.timestamp,
    profile: JSON.stringify(profile)
  };

  await db.queryAsync('REPLACE INTO users SET ?', params);
}
