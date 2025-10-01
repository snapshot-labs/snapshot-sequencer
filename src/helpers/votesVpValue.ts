import snapshot from '@snapshot-labs/snapshot.js';
import { getVoteValue } from './entityValue';
import db from './mysql';
import { CB } from '../constants';

const REFRESH_INTERVAL = 10 * 1000;
const BATCH_SIZE = 100;

type Datum = {
  id: string;
  vp_state: string;
  vp_by_strategy: number[];
  vp_value_by_strategy: number[];
};

async function getVotes(): Promise<Datum[]> {
  const query = `
    SELECT votes.id, votes.vp_state, votes.vp_by_strategy, proposals.vp_value_by_strategy
    FROM votes
    JOIN proposals ON votes.proposal = proposals.id
    WHERE proposals.cb IN (?) AND votes.cb IN (?)
    ORDER BY votes.created ASC
    LIMIT ?`;
  const results = await db.queryAsync(query, [
    [CB.PENDING_FINAL, CB.PENDING_COMPUTE, CB.FINAL],
    [CB.PENDING_SYNC, CB.PENDING_COMPUTE],
    BATCH_SIZE
  ]);

  return results.map((r: any) => {
    r.vp_value_by_strategy = JSON.parse(r.vp_value_by_strategy);
    r.vp_by_strategy = JSON.parse(r.vp_by_strategy);
    return r;
  });
}

async function refreshVotesVpValues(data: Datum[]) {
  const query: string[] = [];
  const params: any[] = [];

  for (const datum of data) {
    query.push('UPDATE votes SET vp_value = ?, cb = ? WHERE id = ? LIMIT 1');

    try {
      const value = getVoteValue(datum.vp_value_by_strategy, datum.vp_by_strategy);

      params.push(value, datum.vp_state === 'final' ? CB.FINAL : CB.PENDING_FINAL, datum.id);
    } catch (e) {
      console.log(e);
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
