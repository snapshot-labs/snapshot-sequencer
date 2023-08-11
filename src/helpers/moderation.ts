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
export const flaggedIps: Array<string> = [
  '594c3796d3e139686d85fdfd48f58eb27748703689e93ac9404f8a6e3fe69488',
  'f38f87bfd58860fdb0dac0374ee6e1f4ef823867cd01286de4b031d762ceb18e',
  '516263be80d8ec183d89dbedf8093852775ed38ad2e2fff03f018522247651bd',
  'aed8ab2423772377b19170381d72d1d7b85bc741bc77700c0ff14c3e081e3605',
  '7d85f3c5a23d9773662ab276a04f064ed406215315a550dc337cf4276c22a747'
];

async function loadModerationData() {
  const res = await snapshot.utils.getJSON(moderationURL);
  flaggedSpaces = res?.flaggedSpaces;
  flaggedIps = res?.flaggedIps;
  flaggedAddresses = res?.flaggedAddresses;
  flaggedProposalTitleKeywords = res?.flaggedProposalTitleKeywords;
  flaggedProposalBodyKeywords = res?.flaggedProposalBodyKeywords;
  verifiedSpaces = res?.verifiedSpaces;
}

async function run() {
  try {
    await loadModerationData();
  } catch (e) {
    capture(e);
    log.error(`[moderation] failed to load ${JSON.stringify(e)}`);
  }
  await snapshot.utils.sleep(20e3);
  run();
}

run();
