import snapshot from '@snapshot-labs/snapshot.js';
import { getVpValueByStrategy } from './entityValue';
import log from './log';
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

let cursor = '';

async function getProposals(): Promise<Proposal[]> {
  const query = `
    SELECT id, network, start, strategies
    FROM proposals
    WHERE cb IN (?) AND start < UNIX_TIMESTAMP() AND id > ?
    ORDER BY id
    LIMIT ?
  `;
  const proposals = await db.queryAsync(query, [
    [CB.PENDING_SYNC, CB.ERROR_SYNC],
    cursor,
    BATCH_SIZE
  ]);

  if (proposals.length > 0) {
    cursor = proposals[proposals.length - 1].id;
  } else {
    cursor = '';
  }

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
      } catch (e: any) {
        log.error(e.message);
        const cb = e.status === 400 ? CB.INELIGIBLE : CB.ERROR_SYNC;
        return { proposal, values: [], cb };
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
    log.info('[proposalStrategiesValue] Fetching proposals values from overlord');
    const proposals = await getProposals();
    log.info(`[proposalStrategiesValue] Found ${proposals.length} proposals`);

    if (proposals.length) {
      await refreshVpByStrategy(proposals);
      log.info(
        `[proposalStrategiesValue] Refreshed from ${proposals[0].id} to ${
          proposals[proposals.length - 1].id
        }`
      );
    }

    if (proposals.length < BATCH_SIZE) {
      log.info(`[proposalStrategiesValue] Sleeping ${REFRESH_INTERVAL}ms`);
      await snapshot.utils.sleep(REFRESH_INTERVAL);
    }
  }
}
