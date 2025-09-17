import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { getVpValueByStrategy } from './entityValue';
import db from './mysql';
import { CB, CURRENT_CB } from '../constants';

type Proposal = {
  id: string;
  network: string;
  start: number;
  strategies: any[];
};

const REFRESH_INTERVAL = 60 * 1000;

async function getProposals(): Promise<Proposal[]> {
  const query =
    'SELECT id, network, start, strategies FROM proposals WHERE cb = ? AND start < UNIX_TIMESTAMP() LIMIT 500';
  const proposals = await db.queryAsync(query, [CB.PENDING_SYNC]);

  return proposals.map((p: any) => {
    p.strategies = JSON.parse(p.strategies);
    return p;
  });
}

async function refreshProposalVpValues(proposal: Proposal) {
  try {
    const values = await getVpValueByStrategy(proposal);
    const query = 'UPDATE proposals SET vp_value_by_strategy = ?, cb = ? WHERE id = ? LIMIT 1';
    await db.queryAsync(query, [JSON.stringify(values), CURRENT_CB, proposal.id]);
  } catch (e: any) {
    capture(e);
  }
}

async function refreshProposals() {
  const proposals = await getProposals();

  for (const proposal of proposals) {
    await refreshProposalVpValues(proposal);
  }
}

export default async function run() {
  await refreshProposals();
  await snapshot.utils.sleep(REFRESH_INTERVAL);

  run();
}
