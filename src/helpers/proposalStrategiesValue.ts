// import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { getVpValueByStrategy } from './entityValue';
import db from './mysql';
import { CB } from '../constants';

type Proposal = {
  id: string;
  network: string;
  start: number;
  strategies: any[];
};

const REFRESH_INTERVAL = 60 * 1000;
const BATCH_SIZE = 100;

async function getProposals(): Promise<Proposal[]> {
  const query =
    'SELECT id, network, start, strategies FROM proposals WHERE cb = ? AND start < UNIX_TIMESTAMP() ORDER BY created DESC LIMIT ?';
  const proposals = await db.queryAsync(query, [CB.PENDING_SYNC, BATCH_SIZE]);

  return proposals.map((p: any) => {
    p.strategies = JSON.parse(p.strategies);
    return p;
  });
}

async function refreshProposalsVpValues(proposals: Proposal[]) {
  const query: string[] = [];
  const params: any[] = [];

  for (const proposal of proposals) {
    await buildQuery(proposal, query, params);
  }

  if (query.length) {
    await db.queryAsync(query.join(';'), params);
  }
}

async function buildQuery(proposal: Proposal, query: string[], params: any[]) {
  try {
    const values = await getVpValueByStrategy(proposal);

    query.push('UPDATE proposals SET vp_value_by_strategy = ?, cb = ? WHERE id = ? LIMIT 1');
    params.push(JSON.stringify(values), CB.PENDING_CLOSE, proposal.id);
  } catch (e) {
    // TODO: enable only after whole database is synced
    // capture(e, { extra: { proposal } });
  }
}

async function refreshPendingProposals() {
  while (true) {
    const proposals = await getProposals();

    if (proposals.length === 0) break;

    await refreshProposalsVpValues(proposals);

    if (proposals.length < BATCH_SIZE) break;
  }
}

export default async function run() {
  await refreshPendingProposals();
  await snapshot.utils.sleep(REFRESH_INTERVAL);

  run();
}
