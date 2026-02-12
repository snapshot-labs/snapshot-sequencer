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

const REFRESH_INTERVAL = 10 * 1000;
const BATCH_SIZE = 25;

async function getProposals(): Promise<Proposal[]> {
  const query = `
    SELECT id, network, start, strategies
    FROM proposals
    WHERE cb IN (?) AND start < UNIX_TIMESTAMP()
    ORDER BY cb DESC
    LIMIT ?
  `;
  const proposals = await db.queryAsync(query, [[CB.PENDING_SYNC, CB.ERROR_SYNC], BATCH_SIZE]);

  return proposals.map((p: any) => {
    p.strategies = JSON.parse(p.strategies);
    return p;
  });
}

async function refreshVpByStrategy(proposals: Proposal[]) {
  const query: string[] = [];
  const params: any[] = [];

  const results = await Promise.all(
    proposals.map(async proposal => {
      try {
        const values = await getVpValueByStrategy(proposal);
        return { proposal, values, cb: CB.PENDING_COMPUTE };
      } catch (e) {
        console.log(e);
        return { proposal, values: [], cb: CB.ERROR_SYNC };
      }
    })
  );

  for (const result of results) {
    query.push('UPDATE proposals SET vp_value_by_strategy = ?, cb = ? WHERE id = ? LIMIT 1');
    params.push(JSON.stringify(result.values), result.cb, result.proposal.id);
  }

  if (query.length) {
    await db.queryAsync(query.join(';'), params);
  }
}

export default async function run() {
  if (!process.env.OVERLORD_URL) return;
  while (true) {
    const proposals = await getProposals();

    if (proposals.length) {
      await refreshVpByStrategy(proposals);
    }

    if (proposals.length < BATCH_SIZE) {
      await snapshot.utils.sleep(REFRESH_INTERVAL);
    }
  }
}
