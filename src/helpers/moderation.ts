import snapshot from '@snapshot-labs/snapshot.js';
import { capture } from '@snapshot-labs/snapshot-sentry';
import db from './mysql';
import { fetchWithKeepAlive } from './utils';

const sidekickURL = process.env.SIDEKICK_URL || 'https://sh5.co';
const moderationURL = `${sidekickURL}/api/moderation?list=flaggedIps,flaggedAddresses,flaggedLinks`;

export let flaggedIps: Array<string> = [];
export let flaggedAddresses: Array<string> = [];
export let flaggedLinks: Array<string> = [];

export async function loadModerationData(
  url = moderationURL
): Promise<Record<string, string[]> | undefined> {
  try {
    const res = await fetchWithKeepAlive(url, { timeout: 5e3 });
    const body = await res.json();

    if (body.error) {
      capture(body);
      return;
    }

    return {
      flaggedIps: body.flaggedIps,
      flaggedLinks: body.flaggedLinks,
      flaggedAddresses: body.flaggedAddresses
    };
  } catch (e: any) {
    capture(e);
    return;
  }
}

export function setData(result?: Record<string, string[]>) {
  if (result) {
    flaggedIps = result.flaggedIps || [];
    flaggedAddresses = (result.flaggedAddresses || []).map((a: string) => a.toLowerCase());
    flaggedLinks = (result.flaggedLinks || []).filter((a: string) => a?.length > 0);
  }
}

export default async function run() {
  setData(await loadModerationData());

  await snapshot.utils.sleep(20e3);
  run();
}

export function containsFlaggedLinks(body: string): boolean {
  if (flaggedLinks.length === 0) return false;

  return new RegExp(flaggedLinks.join('|'), 'i').test(body);
}

export function flagEntity({ type, action, value }) {
  if (!type || !action || !value)
    throw new Error(`missing params. 'type', 'action' and 'value' required`);
  if (!['proposal', 'space'].includes(type)) throw new Error('invalid type');
  if (type === 'proposal' && !['flag', 'unflag'].includes(action))
    throw new Error('invalid action');
  if (type === 'space' && !['flag', 'unflag', 'verify', 'hibernate', 'reactivate'].includes(action))
    throw new Error('invalid action');

  let query;
  switch (`${type}-${action}`) {
    case 'space-flag':
      query = `UPDATE spaces SET flagged = 1, verified = 0 WHERE id = ? LIMIT 1`;
      break;
    case 'space-unflag':
      query = `UPDATE spaces SET flagged = 0 WHERE id = ? LIMIT 1`;
      break;
    case 'space-verify':
      query = `UPDATE spaces SET verified = 1, flagged = 0 WHERE id = ? LIMIT 1`;
      break;
    case 'proposal-flag':
      query = `UPDATE proposals SET flagged = 1 WHERE id = ? LIMIT 1`;
      break;
    case 'proposal-unflag':
      query = `UPDATE proposals SET flagged = 0 WHERE id = ? LIMIT 1`;
      break;
    case 'space-hibernate':
      query = `UPDATE spaces SET hibernated = 1 WHERE id = ? LIMIT 1`;
      break;
    case 'space-reactivate':
      query = `UPDATE spaces SET hibernated = 0 WHERE id = ? LIMIT 1`;
      break;
  }

  if (!query) throw new Error('invalid query');

  return db.queryAsync(query, [value]);
}
