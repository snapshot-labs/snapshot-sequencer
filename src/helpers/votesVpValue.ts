// import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import { getVoteValue } from './entityValue';
import db from './mysql';
import { CB } from '../constants';

const REFRESH_INTERVAL = 60 * 1000;
const BATCH_SIZE = 100;

type Datum = {
  id: string;
  vp_by_strategy: number[];
  vp_value_by_strategy: number[];
};

async function getVotes(): Promise<Datum[]> {
  const query = `
    SELECT votes.id, votes.vp_by_strategy, proposals.vp_value_by_strategy
    FROM votes
    JOIN proposals ON votes.proposal = proposals.id
    WHERE proposals.cb IN (?) AND votes.cb = ?
    ORDER BY votes.created DESC
    LIMIT ?`;
  const results = await db.queryAsync(query, [
    [CB.PENDING_CLOSE, CB.PENDING_COMPUTE],
    CB.PENDING_SYNC,
    BATCH_SIZE
  ]);

  return results.map((p: any) => {
    p.vp_value_by_strategy = JSON.parse(p.vp_value_by_strategy);
    p.vp_by_strategy = JSON.parse(p.vp_by_strategy);
    return p;
  });
}

async function refreshVotesVpValues(data: Datum[]) {
  const query: string[] = [];
  const params: any[] = [];

  for (const datum of data) {
    buildQuery(datum, query, params);
  }

  if (query.length) {
    await db.queryAsync(query.join(';'), params);
  }
}

function buildQuery(datum: Datum, query: string[], params: any[]) {
  try {
    const value = getVoteValue(datum.vp_value_by_strategy, datum.vp_by_strategy);

    query.push('UPDATE votes SET vp_value = ?, cb = ? WHERE id = ? LIMIT 1');
    params.push(value, CB.PENDING_CLOSE, datum.id);
  } catch (e) {
    // TODO: enable only after whole database is synced
    // capture(e, { extra: { proposal } });
  }
}

async function refreshPendingVotes() {
  while (true) {
    const votes = await getVotes();

    if (votes.length === 0) break;

    await refreshVotesVpValues(votes);

    if (votes.length < BATCH_SIZE) break;
  }
}

export default async function run() {
  await refreshPendingVotes();
  await snapshot.utils.sleep(REFRESH_INTERVAL);

  run();
}
