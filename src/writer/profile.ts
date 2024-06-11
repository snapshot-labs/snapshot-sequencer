import snapshot from '@snapshot-labs/snapshot.js';
import db from '../helpers/mysql';
import { jsonParse, clearStampCache } from '../helpers/utils';
import log from '../helpers/log';

export async function verify(body): Promise<any> {
  const profile = jsonParse(body.profile, {});
  const schemaIsValid = snapshot.utils.validateSchema(snapshot.schemas.profile, profile);
  if (schemaIsValid !== true) {
    log.warn(`[writer] Wrong profile format ${JSON.stringify(schemaIsValid)}`);
    return Promise.reject('wrong profile format');
  }

  return true;
}

export async function action(message, ipfs): Promise<void> {
  const profile = jsonParse(message.profile, {});

  const existingProfile = JSON.parse(
    (await db.queryAsync('SELECT profile FROM users WHERE id = ?', [message.from])?.[0]) || '{}'
  );

  const params = {
    id: message.from,
    ipfs,
    created: message.timestamp,
    profile: JSON.stringify(profile)
  };

  await db.queryAsync('REPLACE INTO users SET ?', params);

  if (profile.avatar !== existingProfile.avatar) clearStampCache('avatar', message.from);
}
