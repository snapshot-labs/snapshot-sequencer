import snapshot from '@snapshot-labs/snapshot.js';
import { capture } from '@snapshot-labs/snapshot-sentry';
import db from './mysql';
import { fetchWithKeepAlive } from './utils';

const sidekickURL = process.env.SIDEKICK_URL || 'https://sh5.co';
const moderationURL = `${sidekickURL}/api/moderation`;

export let flaggedIps: Array<string> = [];
export let flaggedAddresses: Array<string> = [];
export let flaggedProposalTitleKeywords: Array<string> = [];
export let flaggedProposalBodyKeywords: Array<string> = [];

export async function loadModerationData(url = moderationURL): Promise<boolean> {
  try {
    const res = await fetchWithKeepAlive(url, { timeout: 5e3 });
    const body = await res.json();

    if (body.error) {
      capture(body);
      return false;
    }

    flaggedIps = body.flaggedIps;
    flaggedAddresses = body.flaggedAddresses;
    flaggedProposalTitleKeywords = body.flaggedProposalTitleKeywords;
    flaggedProposalBodyKeywords = body.flaggedProposalBodyKeywords;

    return true;
  } catch (e: any) {
    capture(e);
    return false;
  }
}

export default async function run() {
  await loadModerationData();
  await snapshot.utils.sleep(20e3);
  run();
}

export function flagEntity({ type, action, value }) {
  if (!type || !action || !value)
    throw new Error(`missing params. 'type', 'action' and 'value' required`);
  if (!['proposal', 'space'].includes(type)) throw new Error('invalid type');
  if (type === 'proposal' && action !== 'flag') throw new Error('invalid action');
  if (type === 'space' && !['flag', 'verify'].includes(action)) throw new Error('invalid action');

  let query;
  switch (`${type}-${action}`) {
    case 'space-flag':
      query = `UPDATE spaces SET flagged = 1, verified = 0 WHERE id = ? LIMIT 1`;
      break;
    case 'space-verify':
      query = `UPDATE spaces SET verified = 1, flagged = 0 WHERE id = ? LIMIT 1`;
      break;
    case 'proposal-flag':
      query = `UPDATE proposals SET flagged = 1 WHERE id = ? LIMIT 1`;
      break;
  }

  if (!query) throw new Error('invalid query');

  return db.queryAsync(query, [value]);
}
