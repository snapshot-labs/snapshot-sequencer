import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { z } from 'zod';
import db from './mysql';
import { CB } from '../constants';

type Datum = {
  id: string;
  voter: string;
  space: string;
  vpState: string;
  vpByStrategy: number[];
  vpValueByStrategy: number[];
};

const REFRESH_INTERVAL = 10 * 1000;
const BATCH_SIZE = 100;

const datumSchema = z
  .object({
    id: z.string(),
    voter: z.string(),
    space: z.string(),
    vpState: z.string(),
    vpValueByStrategy: z.array(z.number().finite()),
    vpByStrategy: z.array(z.number().finite())
  })
  .refine(data => data.vpValueByStrategy.length === data.vpByStrategy.length, {
    message: 'Array length mismatch: vpValueByStrategy and vpByStrategy must have the same length'
  });

async function getVotes(): Promise<Datum[]> {
  const query = `
    SELECT votes.id, votes.vp_state, votes.vp_by_strategy, votes.voter, votes.space, proposals.vp_value_by_strategy
    FROM proposals
    JOIN votes ON votes.proposal = proposals.id
    WHERE proposals.cb IN (?) AND votes.cb = ?
    ORDER BY proposals.votes DESC
    LIMIT ?`;
  const results = await db.queryAsync(query, [
    [CB.PENDING_FINAL, CB.PENDING_COMPUTE, CB.FINAL],
    CB.PENDING_COMPUTE,
    BATCH_SIZE
  ]);

  return results.map((r: any) => {
    return {
      id: r.id,
      voter: r.voter,
      space: r.space,
      vpState: r.vp_state,
      vpValueByStrategy: JSON.parse(r.vp_value_by_strategy),
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

      // Leaderboard update only for final votes
      if (validatedDatum.vpState === 'final') {
        query.push(
          'UPDATE leaderboard SET vp_value = vp_value + ? WHERE user = ? AND space = ? LIMIT 1'
        );
        params.push(value, validatedDatum.voter, validatedDatum.space);
      }
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
