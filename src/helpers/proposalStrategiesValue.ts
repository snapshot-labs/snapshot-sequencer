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

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

const REFRESH_INTERVAL = 10 * 1000;
const BATCH_SIZE = 25;

async function getProposals(): Promise<Proposal[]> {
  const query = `
    SELECT id, network, start, strategies
    FROM proposals
    WHERE cb = ? AND start < UNIX_TIMESTAMP()
    ORDER BY created ASC
    LIMIT ?
  `;
  const proposals = await db.queryAsync(query, [CB.PENDING_SYNC, BATCH_SIZE]);

  return proposals.map((p: any) => {
    p.strategies = JSON.parse(p.strategies);
    return p;
  });
}

async function refreshVpByStrategy(proposals: Proposal[]) {
  const query: string[] = [];
  const params: any[] = [];
  let rateLimitHit = false;

  const results = await Promise.allSettled(
    proposals.map(async proposal => {
      try {
        const values = await getVpValueByStrategy(proposal);
        return { proposal, values, cb: CB.PENDING_COMPUTE };
      } catch (e: any) {
        console.log(e);
        if (e.message && e.message.includes('HTTP error: 429')) {
          rateLimitHit = true;
          throw e;
        }
        return { proposal, values: [], cb: CB.ERROR_SYNC };
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      query.push('UPDATE proposals SET vp_value_by_strategy = ?, cb = ? WHERE id = ? LIMIT 1');
      params.push(JSON.stringify(result.value.values), result.value.cb, result.value.proposal.id);
    }
  }

  if (query.length) {
    await db.queryAsync(query.join(';'), params);
  }

  if (rateLimitHit) {
    throw new RateLimitError('Rate limit hit (429)');
  }
}

export default async function run() {
  while (true) {
    const proposals = await getProposals();

    if (proposals.length) {
      try {
        await refreshVpByStrategy(proposals);
      } catch (e) {
        if (e instanceof RateLimitError) {
          console.log('Rate limit hit (429), sleeping for 1 minute...');
          await snapshot.utils.sleep(60 * 1000);
          continue;
        }
        throw e;
      }
    }

    if (proposals.length < BATCH_SIZE) {
      await snapshot.utils.sleep(REFRESH_INTERVAL);
    }
  }
}
