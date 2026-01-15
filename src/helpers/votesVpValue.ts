import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { z } from 'zod';
import db from './mysql';
import { CB } from '../constants';

type Datum = {
  id: string;
  vpState: string;
  vpByStrategy: number[];
  vpValueByStrategy: number[];
};

const REFRESH_INTERVAL = 10 * 1000;
const BATCH_SIZE = 100;

const datumSchema = z
  .object({
    id: z.string(),
    vpState: z.string(),
    vpValueByStrategy: z.array(z.number().finite()),
    vpByStrategy: z.array(z.number().finite())
  })
  .refine(data => data.vpValueByStrategy.length === data.vpByStrategy.length, {
    message: 'Array length mismatch: vpValueByStrategy and vpByStrategy must have the same length'
  });

async function getVotes(): Promise<Datum[]> {
  const query = `
    SELECT id, proposal, vp_state, vp_by_strategy
    FROM votes
    WHERE proposal IN (SELECT DISTINCT id FROM proposals WHERE cb IN (?)) AND cb = ?
    LIMIT ?`;
  const votesResult = await db.queryAsync(query, [
    [CB.PENDING_FINAL, CB.PENDING_COMPUTE, CB.FINAL],
    CB.PENDING_COMPUTE,
    BATCH_SIZE
  ]);

  if (!votesResult.length) return [];

  const proposalsId = [...new Set(votesResult.map((r: any) => r.proposal))];
  const proposalsResult = await db.queryAsync(
    'SELECT id, vp_value_by_strategy FROM proposals WHERE id IN (?)',
    [proposalsId]
  );

  const proposalsVpByStrategy: Record<string, number[]> = Object.fromEntries(
    proposalsResult.map((r: any) => [r.id, JSON.parse(r.vp_value_by_strategy)])
  );

  return votesResult.map((r: any) => {
    return {
      id: r.id,
      vpState: r.vp_state,
      vpValueByStrategy: proposalsVpByStrategy[r.proposal],
      vpByStrategy: JSON.parse(r.vp_by_strategy)
    };
  });
}

async function refreshVotesVpValues(data: Datum[]) {
  const query: string[] = [];
  const params: any[] = [];

  for (const datum of data) {
    query.push('UPDATE votes SET vp_value = ?, cb = ? WHERE id = ? LIMIT 1');

    try {
      const validatedDatum = datumSchema.parse(datum);
      const value = validatedDatum.vpValueByStrategy.reduce(
        (sum, value, index) => sum + value * validatedDatum.vpByStrategy[index],
        0
      );

      params.push(
        value,
        validatedDatum.vpState === 'final' ? CB.FINAL : CB.PENDING_FINAL,
        validatedDatum.id
      );
    } catch (e) {
      capture(e);
      params.push(0, CB.INELIGIBLE, datum.id);
    }
  }

  if (query.length) {
    await db.queryAsync(query.join(';'), params);
  }
}

export default async function run() {
  while (true) {
    const votes = await getVotes();

    if (votes.length) {
      await refreshVotesVpValues(votes);
    }

    if (votes.length < BATCH_SIZE) {
      await snapshot.utils.sleep(REFRESH_INTERVAL);
    }
  }
}
