import snapshot from '@snapshot-labs/snapshot.js';
import log from './log';
import { capture } from '@snapshot-labs/snapshot-sentry';

const sidekickURL = process.env.SIDEKICK_URL || 'https://sh5.co';
const moderationURL = `${sidekickURL}/api/moderation`;

export let flaggedSpaces: Array<string> = [];
export let flaggedIps: Array<string> = [];
export let flaggedAddresses: Array<string> = [];
export let flaggedProposalTitleKeywords: Array<string> = [];
export let flaggedProposalBodyKeywords: Array<string> = [];
export let verifiedSpaces: Array<string> = [];

async function loadModerationData() {
  const res = await snapshot.utils.getJSON(moderationURL);
  flaggedSpaces = res?.flaggedSpaces;
  flaggedIps = res?.flaggedIps;
  flaggedAddresses = res?.flaggedAddresses;
  flaggedProposalTitleKeywords = res?.flaggedProposalTitleKeywords;
  flaggedProposalBodyKeywords = res?.flaggedProposalBodyKeywords;
  verifiedSpaces = res?.verifiedSpaces;
}

export default async function run() {
  try {
    await loadModerationData();
  } catch (e) {
    capture(e);
    log.error(`[moderation] failed to load ${JSON.stringify(e)}`);
  }
  await snapshot.utils.sleep(20e3);
  run();
}
